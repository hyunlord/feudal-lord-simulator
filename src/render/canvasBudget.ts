// SMOOTH-2R: one byte budget over every canvas cache (ground chunks, composed walkers, world rasters, sprite tints).
//
// Why: SMOOTH-G measured 885–982 MB of live canvas pixels in the biggest town (docs/verification/smooth-g), 498–599 MB
// of it ground chunks, each cache bounded only by its own entry count; with that much held, V8's global allocation
// budget (JS + Blink) is near its limit and every burst of new canvases (a season turn: 84 chunk canvases in ~10 s)
// starts a major GC. Here every cache reports what it holds, in bytes (w × h × 4), and the total stays under
// CANVAS_BUDGET_BYTES.
//
// Cache (AGENTS rule 10):
// (a) Key: (owner, key) — the owner's own entry key. Each entry has a rank; eviction takes the lowest rank first,
//     then the least recently used: idle pooled canvases, then other-season rasters (staged or fading out), then
//     other-zoom rasters, then off-screen ones. Entries used in this frame or the one before are never evicted.
// (b) Invalidation is the owner's: it tracks an entry when it makes or reuses a canvas, touches it on use and forgets it
//     when it drops it itself; the manager calls the owner's `evict(key)` when over budget.
// (c) Bound: CANVAS_BUDGET_BYTES (400 MB, the SMOOTH-2 order's figure, under half of the SMOOTH-G measurement) over
//     every registered entry. `room(bytes)` lets optional work (prefetch, staging, warm-up) wait instead of evicting.
// The pool: a canvas an owner no longer needs goes back here (rank "pool") instead of being dropped, and the next
// request for the same size takes it — a chunk re-raster at a new zoom bucket or season reuses a canvas instead of
// allocating 8 MB.

export const CANVAS_BUDGET_BYTES = 400 * 1024 * 1024;

/** Eviction order, lowest first. */
export type BudgetRank = "pool" | "otherSeason" | "otherZoom" | "offscreen" | "onscreen";
const RANK_ORDER: Readonly<Record<BudgetRank, number>> = { pool: 0, otherSeason: 1, otherZoom: 2, offscreen: 3, onscreen: 4 };

export type BudgetOwner = { readonly name: string; evict(key: string): void };
type Tracked = { readonly owner: BudgetOwner; readonly key: string; bytes: number; rank: BudgetRank; usedFrame: number };

export type PooledCanvas = CanvasImageSource & { width: number; height: number };

export type CanvasBudget = {
  /** Records (or updates) an entry and marks it used this frame. */
  track(owner: BudgetOwner, key: string, bytes: number, rank: BudgetRank): void;
  /** Marks an entry used this frame, optionally with a new rank. */
  touch(owner: BudgetOwner, key: string, rank?: BudgetRank): void;
  /** Sets an entry's rank without marking it used (e.g. a raster the view left). */
  rank(owner: BudgetOwner, key: string, rank: BudgetRank): void;
  /** The owner dropped the entry itself. */
  forget(owner: BudgetOwner, key: string): void;
  /** Whether `bytes` more fit without evicting anything but pooled canvases. */
  room(bytes: number): boolean;
  /** Starts a frame and evicts down to the cap. */
  beginFrame(): void;
  /** A pooled canvas of exactly this size, or null. */
  take<T extends PooledCanvas>(width: number, height: number, accept: (canvas: PooledCanvas) => canvas is T): T | null;
  /** Returns a canvas to the pool (it may be evicted, and then released, when over budget). */
  give(canvas: PooledCanvas): void;
  stats(): Readonly<CanvasBudgetStats>;
  /** Tests and proof resets: forget everything (pooled canvases are released). */
  clear(): void;
};

export type CanvasBudgetStats = {
  bytes: number; capBytes: number; entries: number; evictions: number; pooled: number; poolBytes: number;
  poolHits: number; poolMisses: number; byOwner: Record<string, number>; frame: number;
};

const bytesOf = (canvas: { width: number; height: number }): number => canvas.width * canvas.height * 4;

export function createCanvasBudget(capBytes = CANVAS_BUDGET_BYTES): CanvasBudget {
  const entries = new Map<BudgetOwner, Map<string, Tracked>>();
  let total = 0; let frame = 0; let evictions = 0; let poolHits = 0; let poolMisses = 0; let poolSerial = 0;
  const pool = new Map<string, PooledCanvas>();
  const poolOwner: BudgetOwner = {
    name: "pool",
    evict(key) {
      const canvas = pool.get(key);
      pool.delete(key);
      // Release the backing store now rather than at the next GC.
      if (canvas !== undefined) { canvas.width = 0; canvas.height = 0; }
    },
  };

  const find = (owner: BudgetOwner, key: string): Tracked | undefined => entries.get(owner)?.get(key);
  const drop = (owner: BudgetOwner, key: string): void => {
    const map = entries.get(owner); const entry = map?.get(key);
    if (map === undefined || entry === undefined) return;
    map.delete(key); total -= entry.bytes;
  };
  const evictDownTo = (limit: number, minRank: number): void => {
    if (total <= limit) return;
    const candidates: Tracked[] = [];
    for (const map of entries.values()) for (const entry of map.values()) {
      if (RANK_ORDER[entry.rank] >= minRank && entry.rank !== "pool") continue;
      if (entry.rank !== "pool" && entry.usedFrame >= frame - 1) continue;
      candidates.push(entry);
    }
    // "On screen" holds while an entry is drawn: one not drawn in the last two frames ranks as off screen.
    const order = (entry: Tracked): number => entry.rank === "onscreen" && entry.usedFrame < frame - 1 ? RANK_ORDER.offscreen : RANK_ORDER[entry.rank];
    candidates.sort((a, b) => order(a) - order(b) || a.usedFrame - b.usedFrame);
    for (const entry of candidates) {
      if (total <= limit) break;
      drop(entry.owner, entry.key); evictions += 1;
      entry.owner.evict(entry.key);
    }
  };

  const budget: CanvasBudget = {
    track(owner, key, bytes, rank) {
      let map = entries.get(owner);
      if (map === undefined) { map = new Map(); entries.set(owner, map); }
      const entry = map.get(key);
      if (entry === undefined) { map.set(key, { owner, key, bytes, rank, usedFrame: frame }); total += bytes; return; }
      total += bytes - entry.bytes; entry.bytes = bytes; entry.rank = rank; entry.usedFrame = frame;
    },
    touch(owner, key, rank) {
      const entry = find(owner, key);
      if (entry === undefined) return;
      entry.usedFrame = frame; if (rank !== undefined) entry.rank = rank;
    },
    rank(owner, key, rank) { const entry = find(owner, key); if (entry !== undefined) entry.rank = rank; },
    forget: drop,
    room(bytes) {
      let pooled = 0;
      for (const entry of entries.get(poolOwner)?.values() ?? []) pooled += entry.bytes;
      return total - pooled + bytes <= capBytes;
    },
    beginFrame() { frame += 1; evictDownTo(capBytes, RANK_ORDER.onscreen + 1); },
    take(width, height, accept) {
      for (const [key, canvas] of pool) {
        if (canvas.width !== width || canvas.height !== height || !accept(canvas)) continue;
        pool.delete(key); drop(poolOwner, key); poolHits += 1;
        return canvas;
      }
      poolMisses += 1;
      return null;
    },
    give(canvas) {
      if (canvas.width === 0 || canvas.height === 0) return;
      const key = `p${poolSerial++}`;
      pool.set(key, canvas);
      budget.track(poolOwner, key, bytesOf(canvas), "pool");
      // Idle canvases never push the total over the cap: the oldest go first.
      evictDownTo(capBytes, 0);
    },
    stats() {
      const byOwner: Record<string, number> = {};
      let count = 0;
      for (const [owner, map] of entries) {
        let sum = 0; for (const entry of map.values()) sum += entry.bytes;
        byOwner[owner.name] = (byOwner[owner.name] ?? 0) + sum; count += map.size;
      }
      return { bytes: total, capBytes, entries: count, evictions, pooled: pool.size, poolBytes: byOwner.pool ?? 0, poolHits, poolMisses, byOwner, frame };
    },
    clear() {
      for (const key of [...pool.keys()]) poolOwner.evict(key);
      entries.clear(); total = 0;
    },
  };
  return budget;
}

/** The page's one budget: every canvas cache registers here. */
export const canvasBudget: CanvasBudget = createCanvasBudget();
