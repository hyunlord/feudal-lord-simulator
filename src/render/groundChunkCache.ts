import { drawCroppedWorldSprite } from "./worldSprite";

// Offscreen rasters of 8x8-tile ground chunks (RENDER_BOUNDARY_V2 only).
//
// Cache (AGENTS rule 10):
// (a) Key per (layer, chunk): the chunk's content key (a hash of exactly the primitives it draws, see
//     groundBoundaryScene.ts) + asset readiness bits + zoom bucket (0.05) + device pixel ratio; the render scale
//     (B9 setting 0.75 / 1 / 1.25) is part of the raster scale and, when not 1, of the content key (drawTerrainBoundaryV2).
// (b) Camera pan is not in the key: a raster is in world units and only its device-pixel destination moves.
//     Zoom inside one 0.05 bucket reuses the raster with a slight resample; crossing a bucket re-rasters (at most
//     ZOOM_RERASTER_BUDGET chunks per frame; the rest are drawn from their previous zoom until their turn). A
//     content change is not deferred (that chunk re-rasters in the same frame), with one exception (C1d): a request
//     whose `deferKey` equals the held raster's (a zone-only edit: same ground base, readiness, zoom and scale) may
//     show the held raster while this frame has already spent DEFER_BUDGET_MS rastering or is FRAME_DEFER_AFTER_MS
//     old; it re-rasters on a later frame (a chunk that waited MAX_DEFERRED_FRAMES frames takes that frame's one
//     over-budget raster, so every wait ends). Measured in docs/verification/c1d-yard/: stroke-end frames 23-35 ms -> see REPORT.md.
// (c) Memory bound: the chunks drawn this frame plus OFFSCREEN_ENTRIES more (least recently drawn evicted first).
//     Chunks in a one-chunk ring around the view are rastered ahead in idle time (prefetch), so a camera drag
//     reveals rasters that already exist. Measured fill cost, hit rates and pixel totals: docs/verification/d1a.

export const GROUND_CHUNK_ZOOM_STEP = 0.05;
const OFFSCREEN_ENTRIES = 64;
const ZOOM_RERASTER_BUDGET = 6;
/** Raster time a frame may spend before deferrable (zone-only) re-rasters wait for the next frame. */
const DEFER_BUDGET_MS = 4;
/** Deferrable re-rasters also wait once the frame itself is this old (e.g. it just rebuilt the zone layer). */
const FRAME_DEFER_AFTER_MS = 8;
/** After waiting this many frames a chunk may take the frame's one over-budget raster (so every wait ends). */
const MAX_DEFERRED_FRAMES = 3;
const EDGE_OVERLAP_PX = 1.5;

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
};
type Point = { readonly x: number; readonly y: number };
type Entry = {
  readonly contentKey: string;
  readonly deferKey: string | undefined;
  readonly scale: number;
  readonly raster: ChunkCanvas;
  readonly left: number;
  readonly top: number;
};

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
};

export type GroundChunkCache = {
  /** `frameStartMs`: when the live frame began; only then may zone-only re-rasters wait (never in tests and tools). */
  beginFrame(frameStartMs?: number): void;
  draw(target: CanvasRenderingContext2D, request: ChunkRasterRequest, paint: (context: CanvasRenderingContext2D) => void): void;
  /** Rasters a chunk that is not on screen yet (idle time); no-op if an up-to-date raster exists. */
  prefetch(request: ChunkRasterRequest, paint: (context: CanvasRenderingContext2D) => void): boolean;
  /** Whether `prefetch` would raster anything for this request. */
  needs(request: ChunkRasterRequest): boolean;
  stats(): Readonly<GroundChunkCacheStats>;
  /** Chunks this frame drew from a held raster while their re-raster waits (deferKey); a later frame must follow. */
  pending(): number;
  clear(): void;
  /** Tests: the raster currently held for a chunk id. */
  entry(id: string): { readonly contentKey: string; readonly scale: number; readonly raster: ChunkCanvas } | null;
};

export function createGroundChunkCache(factory: ChunkCanvasFactory | null = browserChunkCanvas): GroundChunkCache {
  const entries = new Map<string, Entry>();
  const stats: GroundChunkCacheStats = { hits: 0, prefetched: 0, contentRasters: 0, zoomRasters: 0, deferredZoom: 0, deferredContent: 0, evictions: 0,
    rasterMs: 0, entries: 0, pixels: 0, lastFrameRasters: 0, lastFrameRasterMs: 0 };
  let zoomBudget = ZOOM_RERASTER_BUDGET;
  let pendingThisFrame = 0;
  let frameStart: number | undefined;
  let forcedThisFrame = false;
  const deferredFrames = new Map<string, number>();
  const drawnThisFrame = new Set<string>();
  const now = (): number => typeof performance === "undefined" ? 0 : performance.now();

  const raster = (request: ChunkRasterRequest, paint: (context: CanvasRenderingContext2D) => void): Entry | null => {
    if (factory === null) return null;
    const started = now();
    const xs = request.diamond.map(point => point.x); const ys = request.diamond.map(point => point.y);
    const pad = 2 / request.scale;
    const left = Math.min(...xs) - pad; const top = Math.min(...ys) - pad;
    const width = Math.ceil((Math.max(...xs) + pad - left) * request.scale);
    const height = Math.ceil((Math.max(...ys) + pad - top) * request.scale);
    const reused = entries.get(request.id);
    const target = reused !== undefined && reused.raster.canvas.width === width && reused.raster.canvas.height === height
      ? reused.raster : factory(width, height);
    if (target === null) return null;
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
    const entry = { contentKey: request.contentKey, deferKey: request.deferKey, scale: request.scale, raster: target, left, top };
    const elapsed = now() - started;
    stats.rasterMs += elapsed; stats.lastFrameRasterMs += elapsed; stats.lastFrameRasters += 1;
    return entry;
  };

  const store = (id: string, entry: Entry): void => {
    entries.delete(id);
    entries.set(id, entry);
    stats.entries = entries.size;
    stats.pixels = [...entries.values()].reduce((sum, value) => sum + value.raster.canvas.width * value.raster.canvas.height, 0);
  };
  // Runs between frames: keep every chunk the last frame drew plus the OFFSCREEN_ENTRIES most recently used others.
  const evict = (): void => {
    for (const oldest of [...entries.keys()]) {
      if (entries.size <= drawnThisFrame.size + OFFSCREEN_ENTRIES) break;
      if (drawnThisFrame.has(oldest)) continue;
      entries.delete(oldest); stats.evictions += 1;
    }
    stats.entries = entries.size;
    stats.pixels = [...entries.values()].reduce((sum, value) => sum + value.raster.canvas.width * value.raster.canvas.height, 0);
  };

  return {
    beginFrame(startedAt) { evict(); zoomBudget = ZOOM_RERASTER_BUDGET; pendingThisFrame = 0; frameStart = startedAt; forcedThisFrame = false; stats.lastFrameRasters = 0; stats.lastFrameRasterMs = 0; drawnThisFrame.clear(); },
    pending: () => pendingThisFrame,
    needs(request) {
      const entry = entries.get(request.id);
      return entry === undefined || entry.contentKey !== request.contentKey || entry.scale !== request.scale;
    },
    prefetch(request, paint) {
      if (!this.needs(request)) return false;
      const started = stats.lastFrameRasterMs; const count = stats.lastFrameRasters;
      const next = raster(request, paint);
      // Idle work is not frame work: keep the per-frame counters about frames.
      stats.lastFrameRasterMs = started; stats.lastFrameRasters = count;
      if (next === null) return false;
      stats.prefetched += 1;
      store(request.id, next);
      return true;
    },
    draw(target, request, paint) {
      drawnThisFrame.add(request.id);
      let entry = entries.get(request.id);
      if (entry !== undefined && entry.contentKey === request.contentKey && entry.scale === request.scale) {
        stats.hits += 1;
        store(request.id, entry);
      } else if (entry !== undefined && entry.contentKey === request.contentKey && zoomBudget <= 0) {
        stats.deferredZoom += 1;
      } else if (frameStart !== undefined && entry !== undefined && entry.scale === request.scale && request.deferKey !== undefined
        && entry.deferKey === request.deferKey && (stats.lastFrameRasterMs >= DEFER_BUDGET_MS || now() - frameStart >= FRAME_DEFER_AFTER_MS)
        && (forcedThisFrame || (deferredFrames.get(request.id) ?? 0) < MAX_DEFERRED_FRAMES)) {
        stats.deferredContent += 1;
        pendingThisFrame += 1;
        deferredFrames.set(request.id, (deferredFrames.get(request.id) ?? 0) + 1);
      } else {
        if ((deferredFrames.get(request.id) ?? 0) >= MAX_DEFERRED_FRAMES) forcedThisFrame = true;
        deferredFrames.delete(request.id);
        const zoomOnly = entry !== undefined && entry.contentKey === request.contentKey;
        const next = raster(request, paint);
        if (next === null) { paint(target); return; }
        if (zoomOnly) { stats.zoomRasters += 1; zoomBudget -= 1; } else stats.contentRasters += 1;
        entry = next;
        store(request.id, entry);
      }
      const canvas = entry.raster.canvas;
      drawCroppedWorldSprite(target, canvas, { x: 0, y: 0, width: canvas.width, height: canvas.height },
        { x: entry.left, y: entry.top, width: canvas.width / entry.scale, height: canvas.height / entry.scale }, true, true);
    },
    stats: () => ({ ...stats }),
    clear() { entries.clear(); stats.entries = 0; stats.pixels = 0; },
    entry(id) { const value = entries.get(id); return value === undefined ? null : { contentKey: value.contentKey, scale: value.scale, raster: value.raster }; },
  };
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
