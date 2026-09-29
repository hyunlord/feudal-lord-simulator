import { recordDrawExtent, type RecordedExtent } from "./rasterDrawBounds";
type Transform = Readonly<{ a: number; b: number; c: number; d: number; e: number; f: number }>;
export type RasterBounds = Readonly<{ left: number; top: number; right: number; bottom: number }>;
type Entry = Readonly<{ canvas: HTMLCanvasElement; x: number; y: number; pixels: number }>;
const caches = new WeakMap<CanvasRenderingContext2D, Map<string, Entry>>();
const MAX_PIXELS = 8_000_000;
// Counters describe this context's bounded cache, not simulation state.
type CacheStats = { hits: number; misses: number; evictions: number; pixels: number; rasterMs: number };
const diagnostics = new WeakMap<CanvasRenderingContext2D, CacheStats>();
export function worldRasterCacheDiagnostics(context: CanvasRenderingContext2D): Readonly<CacheStats> {
  return { ...(diagnostics.get(context) ?? { hits: 0, misses: 0, evictions: 0, pixels: 0, rasterMs: 0 }) };
}

export function rasterCacheKey(content: string, t: Transform): string {
  return `${content}|${t.a},${t.b},${t.c},${t.d}`;
}

/** Cache one complete queue item; translation only changes its integer device-pixel destination. */
export function drawCachedWorldRaster(context: CanvasRenderingContext2D, content: string,
  bounds: RasterBounds, draw: (paint: CanvasRenderingContext2D) => void): void {
  if (typeof document === "undefined" || typeof context.getTransform !== "function"
    || context.globalCompositeOperation !== "source-over" || context.globalAlpha !== 1) {
    draw(context); return;
  }
  const transform = context.getTransform();
  const key = rasterCacheKey(`${content}|${bounds.left},${bounds.top},${bounds.right},${bounds.bottom}|${context.imageSmoothingEnabled}:${context.imageSmoothingQuality}`, transform);
  let cache = caches.get(context);
  if (cache === undefined) { cache = new Map(); caches.set(context, cache); }
  let stats = diagnostics.get(context);
  if (stats === undefined) {
    stats = { hits: 0, misses: 0, evictions: 0, pixels: 0, rasterMs: 0 };
    diagnostics.set(context, stats);
  }
  let entry = cache.get(key);
  if (entry === undefined) {
    stats.misses++;
    const started = performance.now();
    const points = ([[bounds.left, bounds.top], [bounds.right, bounds.top],
      [bounds.left, bounds.bottom], [bounds.right, bounds.bottom]] as const).map(([x, y]) => ({
        x: transform.a * x + transform.c * y, y: transform.b * x + transform.d * y,
      }));
    const x = Math.floor(Math.min(...points.map(point => point.x)));
    const y = Math.floor(Math.min(...points.map(point => point.y)));
    const width = Math.ceil(Math.max(...points.map(point => point.x))) - x;
    const height = Math.ceil(Math.max(...points.map(point => point.y))) - y;
    const pixels = width * height;
    if (!Number.isFinite(pixels) || width <= 0 || height <= 0 || pixels > MAX_PIXELS) {
      draw(context); return;
    }
    let canvas: HTMLCanvasElement;
    let paint: CanvasRenderingContext2D | null;
    try {
      canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
      paint = canvas.getContext("2d");
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      draw(context); return;
    }
    if (paint === null) { draw(context); return; }
    paint.setTransform(transform.a, transform.b, transform.c, transform.d, -x, -y);
    paint.imageSmoothingEnabled = context.imageSmoothingEnabled;
    paint.imageSmoothingQuality = context.imageSmoothingQuality;
    const drawn = recordDrawExtent(paint, [transform.a, transform.b, transform.c, transform.d, -x, -y], draw);
    entry = trimToDrawnExtent(canvas, drawn, x, y) ?? { canvas, x, y, pixels };
    let total = entry.pixels;
    for (const existing of cache.values()) total += existing.pixels;
    for (const [oldKey, old] of cache) {
      if (total <= MAX_PIXELS) break;
      total -= old.pixels; cache.delete(oldKey); stats.evictions++;
    }
    cache.set(key, entry);
    stats.pixels = total; stats.rasterMs += performance.now() - started;
  } else { stats.hits++; cache.delete(key); cache.set(key, entry); }
  context.save();
  try {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.drawImage(entry.canvas, Math.round(entry.x + transform.e), Math.round(entry.y + transform.f));
  } finally { context.restore(); }
}

/** Trim transparent padding once so small wall pieces cannot churn the pixel budget. SMOOTH-2R: to the drawn pieces'
 * recorded extent (rasterDrawBounds.ts) and one device pixel more, as the pixel scan did — no pixel is read back. */
function trimToDrawnExtent(canvas: HTMLCanvasElement, drawn: RecordedExtent, x: number, y: number): Entry | null {
  if (drawn === null || drawn === "unbounded") return null;
  const { width, height } = canvas;
  const left = Math.max(0, Math.floor(drawn.left) - 1); const top = Math.max(0, Math.floor(drawn.top) - 1);
  const right = Math.min(width, Math.ceil(drawn.right) + 1); const bottom = Math.min(height, Math.ceil(drawn.bottom) + 1);
  if (right <= left || bottom <= top) return null;
  if (left === 0 && top === 0 && right === width && bottom === height) return null;
  try {
    const trimmed = document.createElement("canvas");
    trimmed.width = right - left; trimmed.height = bottom - top;
    const target = trimmed.getContext("2d");
    if (target === null) return null;
    target.drawImage(canvas, left, top, trimmed.width, trimmed.height, 0, 0, trimmed.width, trimmed.height);
    return { canvas: trimmed, x: x + left, y: y + top, pixels: trimmed.width * trimmed.height };
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    return null;
  }
}
