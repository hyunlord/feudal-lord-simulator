import { canvasBudget, type BudgetOwner, type CanvasBudget } from "./canvasBudget";
import type { CanvasTransform as StyleTransform } from "./style";
import { drawCroppedWorldSprite } from "./worldSprite";

// Offscreen rasters of 8x8-tile ground chunks (RENDER_BOUNDARY_V2 only).
//
// Cache (AGENTS rule 10):
// (a) Key per (layer, chunk): the chunk's content key (a hash of exactly the primitives it draws, see
//     groundBoundaryScene.ts) + asset readiness bits + zoom bucket (0.05) + device pixel ratio; the render scale
//     (B9 setting 0.75 / 1 / 1.25) is part of the raster scale and, when not 1, of the content key (drawTerrainBoundaryV2).
//     Only what the ground is goes in: terrain, roads, zones and field strips, and the season's picture of them
//     (SMOOTH-2R: nothing that moves per frame — weather, time of day, the cursor and the season's change itself are
//     drawn over the chunks; measured in docs/verification/smooth2r/: in a minute at 5x only season and crop-state
//     changes re-rastered chunks).
// (b) Camera pan is not in the key: a raster is in world units and only its device-pixel destination moves.
//     Zoom inside one 0.05 bucket reuses the raster with a slight resample; crossing a bucket re-rasters (at most
//     ZOOM_RERASTER_BUDGET chunks per frame; the rest are drawn from their previous zoom until their turn). A
//     content change is not deferred (that chunk re-rasters in the same frame), with one exception (C1d): a request
//     whose `deferKey` equals the held raster's (a zone-only edit or a season turn: same ground base, readiness, zoom
//     and scale) may show the held raster while this frame has already spent DEFER_BUDGET_MS rastering (or made
//     DEFERRABLE_RERASTERS_PER_FRAME of them) or is
//     FRAME_DEFER_AFTER_MS old; it re-rasters on a later frame (a chunk that waited MAX_DEFERRED_FRAMES frames takes
//     that frame's one over-budget raster, so every wait ends). Measured in docs/verification/c1d-yard/.
// (c) Memory (SMOOTH-2R): every raster is an entry of the page's canvas budget (canvasBudget.ts, one byte cap over
//     every canvas cache), ranked on screen / off screen / other zoom; the chunks drawn in the last two frames are
//     never evicted. A re-raster draws into the chunk's own canvas; a canvas that must change size, or that the budget
//     pushes out of an off-screen chunk, goes back to the pool for the next chunk (SMOOTH-G: 52 new 2052x1028
//     canvases a minute). Chunks in a one-chunk ring around the view are rastered ahead in idle time (prefetch) only
//     while the budget has room, so a camera drag reveals rasters that already exist.
// (d) Season turn (INSTALL-15, SMOOTH-2R): a request carries a turn token (the season). When the token changes, each
//     chunk keeps its old raster until its own moment in the turn (its id's phase × `fade.ms`) and then takes its new
//     raster, so the new season runs over the ground as a wave, like the trees and roofs (seasonForObject). In the
//     last seconds of a season the renderer rasters the next season's visible chunks in idle time (`stage`, ranked
//     "other season" in the budget, only while it has room); at its moment a chunk takes its staged raster as is and
//     its old canvas goes to the pool, otherwise it re-rasters in place. It used a crossfade: the staged set plus a
//     blend canvas per chunk — up to two extra full sets (84 canvases, ~700 MB in the biggest town at zoom 2, measured
//     in docs/verification/smooth2r/) that the budget cannot hold. At 5x (`ms` 0) every chunk's moment is the turn
//     itself and the deferral in (b) spreads the re-rasters that were not staged over frames.

export const GROUND_CHUNK_ZOOM_STEP = 0.05;
const OFFSCREEN_ENTRIES = 64;
const ZOOM_RERASTER_BUDGET = 2;
/** Deferrable (zone-only, season) re-rasters a frame may make, whatever their CPU time (SMOOTH-2R: the CPU time of a
 * raster is only its commands — the GPU draws a 2052x1028 chunk later; in a placement trace the ground pass took
 * 422 ms while the GPU process was busy 618 ms, docs/verification/smooth2r/). */
const DEFERRABLE_RERASTERS_PER_FRAME = 2;
/** Raster time a frame may spend before deferrable (zone-only, season) re-rasters wait for the next frame. */
const DEFER_BUDGET_MS = 4;
/** Deferrable re-rasters also wait once the frame itself is this old (e.g. it just rebuilt the zone layer). */
const FRAME_DEFER_AFTER_MS = 8;
/** After waiting this many frames a chunk may take the frame's one over-budget raster (so every wait ends). */
const MAX_DEFERRED_FRAMES = 3;
const EDGE_OVERLAP_PX = 1.5;
/** Budget key prefix of a staged (next-season) raster. */
const STAGE = "stage:";

export type ChunkCanvas = {
  readonly canvas: CanvasImageSource & { width: number; height: number };
  readonly context: CanvasRenderingContext2D;
};
export type ChunkCanvasFactory = (width: number, height: number) => ChunkCanvas | null;

export type ChunkRasterRequest = {
  readonly id: string;
  readonly contentKey: string;
  /** Device pixels per world unit for this frame's zoom bucket. */
  readonly scale: number;
  /** World-space diamond of the chunk (top, right, bottom, left). */
  readonly diamond: readonly [Point, Point, Point, Point];
  /** If the held raster has the same deferKey, the content change may wait for a later frame (see header). */
  readonly deferKey?: string;
  /** A content change under a different token waits for the chunk's moment in the turn, over `ms` (header (d)). */
  readonly fade?: { readonly token: string; readonly ms: number };
};
type Point = { readonly x: number; readonly y: number };
type Held = { readonly raster: ChunkCanvas; readonly left: number; readonly top: number; readonly scale: number };
type Entry = Held & { readonly contentKey: string; readonly deferKey: string | undefined; readonly fadeToken: string | undefined };

export type GroundChunkCacheStats = {
  hits: number;
  prefetched: number;
  contentRasters: number;
  zoomRasters: number;
  deferredZoom: number;
  deferredContent: number;
  evictions: number;
  rasterMs: number;
  entries: number;
  pixels: number;
  lastFrameRasters: number;
  lastFrameRasterMs: number;
  /** Season turns seen (header (d)). */
  fades: number;
  /** Frames a chunk showed its old season waiting for its moment in the turn. */
  waves: number;
  /** New canvases made, and canvases taken again (own re-raster, pool, an off-screen chunk). */
  canvasesMade: number;
  canvasesReused: number;
  /** Next-season rasters made ahead, and taken at the chunk's moment in the turn (header (d)). */
  staged: number;
  stagedUsed: number;
};

export type GroundChunkCache = {
  /** `frameStartMs`: when the live frame began; only then may deferrable re-rasters wait (never in tests and tools). */
  beginFrame(frameStartMs?: number): void;
  /** `transform`: the target's current transform when the caller has it (SMOOTH-2R: read once a frame, not per blit). */
  draw(target: CanvasRenderingContext2D, request: ChunkRasterRequest, paint: (context: CanvasRenderingContext2D) => void, transform?: StyleTransform | null): void;
  /** Rasters a chunk that is not on screen yet (idle time, only with budget room); no-op if an up-to-date raster exists. */
  prefetch(request: ChunkRasterRequest, paint: (context: CanvasRenderingContext2D) => void): boolean;
  /** Whether `prefetch` would raster anything for this request. */
  needs(request: ChunkRasterRequest): boolean;
  /** Rasters a chunk's next-season content ahead of the turn (idle time, only with budget room); no-op if staged. */
  stage(request: ChunkRasterRequest, paint: (context: CanvasRenderingContext2D) => void): boolean;
  /** Whether `stage` would raster anything for this request. */
  needsStage(request: ChunkRasterRequest): boolean;
  stats(): Readonly<GroundChunkCacheStats>;
  /** Chunks this frame drew from a held raster while their re-raster waits (deferKey, turn); a later frame must follow. */
  pending(): number;
  clear(): void;
  /** Tests: the raster currently held for a chunk id. */
  entry(id: string): { readonly contentKey: string; readonly scale: number; readonly raster: ChunkCanvas } | null;
};

/** The cache's clock (ms): raster timing, the frame's age and the turn. Tests pass a fake one (TEST-1). */
export type ChunkClock = () => number;
const performanceClock: ChunkClock = () => typeof performance === "undefined" ? 0 : performance.now();

let cacheSerial = 0;

export function createGroundChunkCache(factory: ChunkCanvasFactory | null = browserChunkCanvas, clock: ChunkClock = performanceClock,
  budget: CanvasBudget = canvasBudget): GroundChunkCache {
  const entries = new Map<string, Entry>();
  const staged = new Map<string, Entry>();
  const stats: GroundChunkCacheStats = { hits: 0, prefetched: 0, contentRasters: 0, zoomRasters: 0, deferredZoom: 0, deferredContent: 0, evictions: 0,
    rasterMs: 0, entries: 0, pixels: 0, lastFrameRasters: 0, lastFrameRasterMs: 0, fades: 0, waves: 0, canvasesMade: 0, canvasesReused: 0, staged: 0, stagedUsed: 0 };
  let zoomBudget = ZOOM_RERASTER_BUDGET;
  let deferrableBudget = DEFERRABLE_RERASTERS_PER_FRAME;
  let pendingThisFrame = 0;
  let frameStart: number | undefined;
  let forcedThisFrame = false;
  let lastScale: number | null = null;
  const deferredFrames = new Map<string, number>();
  const drawnThisFrame = new Set<string>();
  const drawnLastFrame = new Set<string>();
  /** When each turn token was first asked for (header (d)). */
  const turns = new Map<string, number>();
  /** The canvases this cache made, to take its own back from the shared pool. */
  const made = new WeakMap<object, ChunkCanvas>();
  const now = clock;
  const bytes = (raster: ChunkCanvas): number => raster.canvas.width * raster.canvas.height * 4;
  const release = (raster: ChunkCanvas): void => budget.give(raster.canvas);
  const owner: BudgetOwner = {
    name: `ground-chunks#${cacheSerial++}`,
    evict(key) {
      const stagedId = key.startsWith(STAGE) ? key.slice(STAGE.length) : null;
      const map = stagedId === null ? entries : staged; const id = stagedId ?? key;
      const entry = map.get(id);
      if (entry === undefined) return;
      map.delete(id); stats.evictions += 1; recount();
      entry.raster.canvas.width = 0; entry.raster.canvas.height = 0;
    },
  };
  const recount = (): void => {
    stats.entries = entries.size;
    stats.pixels = [...entries.values()].reduce((sum, value) => sum + value.raster.canvas.width * value.raster.canvas.height, 0);
  };

  /** A canvas of this size: the pool first, then (over budget) an off-screen chunk's, then a new one; null to skip. */
  const acquire = (width: number, height: number, optional: boolean): ChunkCanvas | null => {
    const pooled = budget.take(width, height, (canvas): canvas is ChunkCanvas["canvas"] => made.has(canvas));
    if (pooled !== null) { stats.canvasesReused += 1; return made.get(pooled) ?? null; }
    if (!budget.room(width * height * 4)) {
      for (const [id, entry] of entries) {
        if (drawnThisFrame.has(id) || drawnLastFrame.has(id) || entry.raster.canvas.width !== width || entry.raster.canvas.height !== height) continue;
        entries.delete(id); budget.forget(owner, id); stats.evictions += 1; stats.canvasesReused += 1;
        return entry.raster;
      }
      if (optional) return null;
    }
    const next = factory?.(width, height) ?? null;
    if (next !== null) { made.set(next.canvas, next); stats.canvasesMade += 1; }
    return next;
  };

  const raster = (request: ChunkRasterRequest, paint: (context: CanvasRenderingContext2D) => void, optional: boolean, fresh = false): Entry | null => {
    if (factory === null) return null;
    const started = now();
    const xs = request.diamond.map(point => point.x); const ys = request.diamond.map(point => point.y);
    const pad = 2 / request.scale;
    const left = Math.min(...xs) - pad; const top = Math.min(...ys) - pad;
    const width = Math.ceil((Math.max(...xs) + pad - left) * request.scale);
    const height = Math.ceil((Math.max(...ys) + pad - top) * request.scale);
    const held = entries.get(request.id);
    const own = !fresh && held !== undefined && held.raster.canvas.width === width && held.raster.canvas.height === height;
    const target = own ? held.raster : acquire(width, height, optional);
    if (target === null) return null;
    if (own) stats.canvasesReused += 1;
    const context = target.context;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, width, height);
    context.setTransform(request.scale, 0, 0, request.scale, -left * request.scale, -top * request.scale);
    context.save();
    // Clip to the chunk's own tiles, grown by ~1.5 device px so neighbouring rasters overlap instead of leaving an
    // antialiased hairline. Both sides of the overlap paint identical ground, so the overlap is invisible.
    const grow = EDGE_OVERLAP_PX / request.scale;
    const [topPoint, right, bottom, leftPoint] = request.diamond;
    context.beginPath();
    context.moveTo(topPoint.x, topPoint.y - grow * 1.12); context.lineTo(right.x + grow * 2.24, right.y);
    context.lineTo(bottom.x, bottom.y + grow * 1.12); context.lineTo(leftPoint.x - grow * 2.24, leftPoint.y);
    context.closePath();
    context.clip();
    paint(context);
    context.restore();
    const elapsed = now() - started;
    stats.rasterMs += elapsed; stats.lastFrameRasterMs += elapsed; stats.lastFrameRasters += 1;
    return { contentKey: request.contentKey, deferKey: request.deferKey, fadeToken: request.fade?.token, scale: request.scale, raster: target, left, top };
  };

  const store = (id: string, entry: Entry, onScreen: boolean): void => {
    const previous = entries.get(id);
    if (previous !== undefined && previous.raster !== entry.raster) release(previous.raster);
    entries.delete(id);
    entries.set(id, entry);
    budget.track(owner, id, bytes(entry.raster), onScreen ? "onscreen" : "offscreen");
    recount();
  };
  // Runs between frames: every chunk the last frame drew stays; beyond OFFSCREEN_ENTRIES others, the oldest go to the
  // pool; the rest are ranked for the budget (off screen, or another zoom's raster).
  const settle = (): void => {
    drawnLastFrame.clear();
    for (const id of drawnThisFrame) drawnLastFrame.add(id);
    for (const [id, entry] of [...entries]) {
      if (drawnLastFrame.has(id)) continue;
      if (entries.size > drawnLastFrame.size + OFFSCREEN_ENTRIES) {
        entries.delete(id); budget.forget(owner, id); release(entry.raster); stats.evictions += 1; continue;
      }
      budget.rank(owner, id, lastScale !== null && entry.scale !== lastScale ? "otherZoom" : "offscreen");
    }
    recount();
  };
  const dropStaged = (id: string, entry: Entry): void => { staged.delete(id); budget.forget(owner, STAGE + id); release(entry.raster); };
  const turnStart = (token: string): number => {
    let started = turns.get(token);
    if (started === undefined) {
      started = now(); turns.set(token, started); stats.fades += 1;
      for (const old of [...turns.keys()]) if (turns.size > 4 && old !== token) turns.delete(old);
    }
    return started;
  };

  return {
    beginFrame(startedAt) {
      settle(); zoomBudget = ZOOM_RERASTER_BUDGET; deferrableBudget = DEFERRABLE_RERASTERS_PER_FRAME; pendingThisFrame = 0; frameStart = startedAt; forcedThisFrame = false;
      stats.lastFrameRasters = 0; stats.lastFrameRasterMs = 0; drawnThisFrame.clear();
    },
    pending: () => pendingThisFrame,
    needsStage(request) {
      const entry = staged.get(request.id);
      return request.fade !== undefined && (entry === undefined || entry.contentKey !== request.contentKey || entry.scale !== request.scale);
    },
    stage(request, paint) {
      if (!this.needsStage(request) || request.fade === undefined) return false;
      for (const [id, entry] of [...staged]) if (entry.fadeToken !== request.fade.token || id === request.id) dropStaged(id, entry);
      const started = stats.lastFrameRasterMs; const count = stats.lastFrameRasters;
      const next = raster(request, paint, true, true);
      stats.lastFrameRasterMs = started; stats.lastFrameRasters = count;
      if (next === null) return false;
      staged.set(request.id, next); stats.staged += 1;
      budget.track(owner, STAGE + request.id, bytes(next.raster), "otherSeason");
      return true;
    },
    needs(request) {
      const entry = entries.get(request.id);
      return entry === undefined || entry.contentKey !== request.contentKey || entry.scale !== request.scale;
    },
    prefetch(request, paint) {
      if (!this.needs(request)) return false;
      const started = stats.lastFrameRasterMs; const count = stats.lastFrameRasters;
      const next = raster(request, paint, true);
      // Idle work is not frame work: keep the per-frame counters about frames.
      stats.lastFrameRasterMs = started; stats.lastFrameRasters = count;
      if (next === null) return false;
      stats.prefetched += 1;
      store(request.id, next, false);
      return true;
    },
    draw(target, request, paint, transform) {
      drawnThisFrame.add(request.id);
      lastScale = request.scale;
      const entry = entries.get(request.id);
      if (entry !== undefined && entry.contentKey === request.contentKey && entry.scale === request.scale) {
        stats.hits += 1;
        entries.delete(request.id); entries.set(request.id, entry);
        budget.touch(owner, request.id, "onscreen");
        blit(target, entry, transform); return;
      }
      if (entry !== undefined && entry.contentKey === request.contentKey && zoomBudget <= 0) {
        stats.deferredZoom += 1;
        budget.touch(owner, request.id, "onscreen");
        blit(target, entry, transform); return;
      }
      const turning = entry !== undefined && request.fade !== undefined && entry.fadeToken !== undefined && entry.fadeToken !== request.fade.token;
      if (turning && request.fade !== undefined && entry.scale === request.scale && request.fade.ms > 0
        && now() - turnStart(request.fade.token) < fadePhase(request.id) * request.fade.ms) {
        // The old season until this chunk's moment in the turn (header (d)).
        stats.waves += 1; pendingThisFrame += 1;
        budget.touch(owner, request.id, "onscreen");
        blit(target, entry, transform); return;
      }
      if (turning && request.fade !== undefined) {
        turnStart(request.fade.token);
        const ready = staged.get(request.id);
        if (ready !== undefined && ready.contentKey === request.contentKey && ready.scale === request.scale) {
          // Made ahead in idle time: taken as is; the old season's canvas goes to the pool.
          staged.delete(request.id); budget.forget(owner, STAGE + request.id); stats.stagedUsed += 1;
          store(request.id, ready, true);
          blit(target, ready, transform); return;
        }
      }
      if (frameStart !== undefined && entry !== undefined && entry.scale === request.scale && request.deferKey !== undefined
        && entry.deferKey === request.deferKey && (stats.lastFrameRasterMs >= DEFER_BUDGET_MS || deferrableBudget <= 0 || now() - frameStart >= FRAME_DEFER_AFTER_MS)
        && (forcedThisFrame || (deferredFrames.get(request.id) ?? 0) < MAX_DEFERRED_FRAMES)) {
        stats.deferredContent += 1;
        pendingThisFrame += 1;
        deferredFrames.set(request.id, (deferredFrames.get(request.id) ?? 0) + 1);
        budget.touch(owner, request.id, "onscreen");
        blit(target, entry, transform); return;
      }
      if ((deferredFrames.get(request.id) ?? 0) >= MAX_DEFERRED_FRAMES) forcedThisFrame = true;
      deferredFrames.delete(request.id);
      const zoomOnly = entry !== undefined && entry.contentKey === request.contentKey;
      const next = raster(request, paint, false);
      if (next === null) { paint(target); return; }
      if (zoomOnly) { stats.zoomRasters += 1; zoomBudget -= 1; } else stats.contentRasters += 1;
      if (!zoomOnly && entry !== undefined && entry.deferKey === request.deferKey) deferrableBudget -= 1;
      store(request.id, next, true);
      blit(target, next, transform);
    },
    stats: () => ({ ...stats }),
    clear() {
      for (const [id, entry] of entries) { budget.forget(owner, id); release(entry.raster); }
      for (const [id, entry] of [...staged]) dropStaged(id, entry);
      entries.clear(); turns.clear(); stats.entries = 0; stats.pixels = 0;
    },
    entry(id) { const value = entries.get(id); return value === undefined ? null : { contentKey: value.contentKey, scale: value.scale, raster: value.raster }; },
  };
}

function fadePhase(id: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < id.length; index += 1) hash = Math.imul(hash ^ id.charCodeAt(index), 16_777_619);
  return ((hash >>> 0) % 1_000) / 1_000;
}

function blit(target: CanvasRenderingContext2D, held: Held, transform?: StyleTransform | null): void {
  const canvas = held.raster.canvas;
  drawCroppedWorldSprite(target, canvas, { x: 0, y: 0, width: canvas.width, height: canvas.height },
    { x: held.left, y: held.top, width: canvas.width / held.scale, height: canvas.height / held.scale }, true, true, transform ?? undefined);
}

export function groundChunkZoomBucket(zoom: number): number {
  return Math.max(GROUND_CHUNK_ZOOM_STEP, Math.round(zoom / GROUND_CHUNK_ZOOM_STEP) * GROUND_CHUNK_ZOOM_STEP);
}

function browserChunkCanvas(width: number, height: number): ChunkCanvas | null {
  if (typeof document === "undefined") return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext("2d");
    return context === null ? null : { canvas, context };
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    return null;
  }
}
