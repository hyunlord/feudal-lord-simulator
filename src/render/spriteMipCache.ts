import { canvasBudget, type BudgetOwner } from "./canvasBudget";

// NAT-2 QA-008: pre-shrunk copies (mip levels 0.5 and 0.25) of the world sprites, so the zoomed-out town keeps its
// painted look. Before, zoom <= 0.7 drew houses as white line drawings and forests as green circles (Astra, QA-008);
// now the same art is drawn there, each draw from the smallest level at least as large as its device scale, so no
// draw samples an image down by more than 2x (under 0.25 it takes the 0.25 level).
//
// Cache (AGENTS rule 10):
// (a) Key: the image object (a WeakMap, so a mip goes with its image) and the level. Only images that never change are
//     mipped: loaded <img> elements and canvases marked with markSpriteImmutable (the runtime thumbnails of
//     rasterizeWorldSprite, the render-scale copies of scaledWorldAssetSource). A pooled or redrawn canvas has none.
// (b) Invalidation: none needed (the image never changes); the canvas budget may evict a level, made again on use.
// (c) Bound: every level is an entry of the canvas budget (canvasBudget.ts, owner "sprite-mip"); a 0.5 level holds a
//     quarter of its image's bytes, a 0.25 level a sixteenth. At most MIPS_PER_FRAME levels are made in one frame
//     (the rest draw from their image that frame), so the first wide view after a load does not stall on them.

export type MipLevel = 1 | 0.5 | 0.25;
type Crop = Readonly<{ x: number; y: number; width: number; height: number }>;
type Sized = CanvasImageSource & { readonly width: number; readonly height: number };
type MipCanvas = OffscreenCanvas | HTMLCanvasElement;

export const MIPS_PER_FRAME = 12;
/** A level whose crop would fall under this many pixels on a side is not used (sheets' cells would bleed together). */
const MIN_MIP_CROP_PX = 12;

/** The smallest level at least as large as the draw's device scale (destination device px per image px). */
export function spriteMipLevel(deviceScale: number): MipLevel {
  if (!(deviceScale < 0.5)) return 1;
  return deviceScale < 0.25 ? 0.25 : 0.5;
}

const immutable = new WeakSet<object>();
/** Marks a canvas that is drawn once and never again, so it may be mipped. */
export function markSpriteImmutable<T extends object>(canvas: T): T { immutable.add(canvas); return canvas; }

// One record per image seen at a mip scale: its pixel size (null: not mippable) and its levels.
type MipRecord = { readonly width: number; readonly height: number; readonly key: string; half: MipCanvas | null; quarter: MipCanvas | null;
  touched: number };
const records = new WeakMap<object, MipRecord | null>();
const budgetEntries = new Map<string, { readonly record: WeakRef<MipRecord>; readonly level: 0.5 | 0.25 }>();
let serial = 0;
let frame = 0;
let madeThisFrame = 0;
const stats = { made: 0, hits: 0, deferred: 0 };
const owner: BudgetOwner = {
  name: "sprite-mip",
  evict(key) {
    const entry = budgetEntries.get(key);
    budgetEntries.delete(key);
    const record = entry?.record.deref();
    if (entry === undefined || record === undefined) return;
    if (entry.level === 0.5) record.half = null; else record.quarter = null;
  },
};

// The world scale (device px per world unit) of the context whose object pass is drawing, for drawCroppedWorldSprite.
let frameContext: object | null = null;
let frameScale = 1;
/** Starts an object pass on `context` at `worldScale`; its world blits may then draw from mips. */
export function beginSpriteMipFrame(context: object, worldScale: number): void {
  frameContext = worldScale > 0 && Number.isFinite(worldScale) ? context : null; frameScale = worldScale;
  frame += 1; madeThisFrame = 0;
}
export function endSpriteMipFrame(): void { frameContext = null; }
/** The world scale when `context` is in its object pass, else null (offscreen rasters and other passes draw as before). */
export function spriteMipWorldScale(context: object): number | null { return context === frameContext ? frameScale : null; }

function recordFor(image: CanvasImageSource): MipRecord | null {
  const known = records.get(image);
  if (known !== undefined) return known;
  let size: { readonly width: number; readonly height: number } | null = null;
  if (typeof HTMLImageElement !== "undefined" && image instanceof HTMLImageElement) {
    // Not recorded until it has loaded (a loading image has no pixels to shrink yet).
    if (!image.complete || image.naturalWidth === 0) return null;
    size = { width: image.naturalWidth, height: image.naturalHeight };
  } else if (immutable.has(image)) {
    const sized = image as Sized;
    if (sized.width > 0 && sized.height > 0) size = { width: sized.width, height: sized.height };
  }
  const record = size === null ? null : { ...size, key: `m${serial++}`, half: null, quarter: null, touched: -1 };
  records.set(image, record);
  return record;
}

/**
 * The image and crop (in the image's pixels) to draw from at `deviceScale`: a mip level with the crop scaled to it, or
 * the image itself (level 1, an image that may change, a crop too small, a level not made yet).
 */
export function mippedSprite(image: CanvasImageSource, crop: Crop, deviceScale: number): { readonly image: CanvasImageSource; readonly crop: Crop } {
  let level = spriteMipLevel(deviceScale);
  while (level < 1 && Math.min(crop.width, crop.height) * level < MIN_MIP_CROP_PX) level = level === 0.25 ? 0.5 : 1;
  if (level === 1) return { image, crop };
  const record = recordFor(image);
  const mip = record === null ? null : mipCanvas(image, record, level);
  if (record === null || mip === null) return { image, crop };
  const kx = mip.width / record.width; const ky = mip.height / record.height;
  return { image: mip, crop: { x: crop.x * kx, y: crop.y * ky, width: crop.width * kx, height: crop.height * ky } };
}

function mipCanvas(image: CanvasImageSource, record: MipRecord, level: 0.5 | 0.25): MipCanvas | null {
  const cached = level === 0.5 ? record.half : record.quarter;
  if (cached !== null) {
    stats.hits += 1;
    // Once a frame is enough for the budget's "used in this frame" (a forest draws one tree image hundreds of times).
    if (record.touched !== frame) { record.touched = frame; canvasBudget.touch(owner, `${record.key}:0.5`, "onscreen"); canvasBudget.touch(owner, `${record.key}:0.25`, "onscreen"); }
    return cached;
  }
  if (madeThisFrame >= MIPS_PER_FRAME) { stats.deferred += 1; return null; }
  // The 0.25 level is halved from the 0.5 one: each step filters 2x, as a mip chain does.
  const parent = level === 0.25 ? mipCanvas(image, record, 0.5) : image;
  if (parent === null) return null;
  const width = Math.max(1, Math.round(record.width * level)); const height = Math.max(1, Math.round(record.height * level));
  const canvas = createMipCanvas(width, height);
  const paint = canvas?.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null | undefined;
  if (canvas === null || paint === null || paint === undefined) return null;
  paint.imageSmoothingEnabled = true;
  paint.imageSmoothingQuality = "high";
  paint.drawImage(parent, 0, 0, width, height);
  if (level === 0.5) record.half = canvas; else record.quarter = canvas;
  budgetEntries.set(`${record.key}:${level}`, { record: new WeakRef(record), level });
  canvasBudget.track(owner, `${record.key}:${level}`, width * height * 4, "onscreen");
  madeThisFrame += 1; stats.made += 1;
  return canvas;
}

function createMipCanvas(width: number, height: number): MipCanvas | null {
  if (typeof globalThis.OffscreenCanvas === "function") return new OffscreenCanvas(width, height);
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  return canvas;
}

/** Levels made, served from the cache, and put off to a later frame (proof and tests). */
export function spriteMipStats(): Readonly<typeof stats> { return { ...stats }; }
