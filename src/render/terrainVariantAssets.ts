import { RAMPS } from "../content/palette";
import { withAlpha } from "./style";
import { drawCroppedWorldSprite } from "./worldSprite";
import { TERRAIN_VARIANT_ASSETS, TERRAIN_VARIANTS, SHORE_ASSET_KEYS, WALL_FACE_KEYS, type ShoreAssetKey, type WallFaceKey } from "./terrainVariantManifest";
import { assetUrlForBase } from "./worldAssets";
import { rasterizeWorldSprite, type RasterizedWorldSprite } from "./worldSpriteRaster";

// Browser image cache for the D3a shore pieces and the D3b wall faces (not simulation state). Loading starts the first
// time a frame with water (or a completed wall) is drawn; the bridge abutments get one high-quality downscale at twice
// their display size.

type Entry = { status: "idle" | "loading" | "ready" | "missing"; image: HTMLImageElement | null; raster: RasterizedWorldSprite | null; tinted?: CanvasImageSource | null };
type LoadedKey = ShoreAssetKey | WallFaceKey;
const entries = new Map<LoadedKey, Entry>([...SHORE_ASSET_KEYS, ...WALL_FACE_KEYS].map(key => [key, { status: "idle", image: null, raster: null }]));
let preload: Promise<void> | null = null;
let wallPreload: Promise<void> | null = null;
/** Screen width of a 256x192 abutment at zoom 1: it is authored at 256 source px per tile (projected width 128x64 per tile edge). */
export const ABUTMENT_DISPLAY_WIDTH = 64;

export function preloadShoreAssets(): Promise<void> {
  preload ??= loadAll(SHORE_ASSET_KEYS);
  return preload;
}

export function preloadWallFaceAssets(): Promise<void> {
  wallPreload ??= loadAll(WALL_FACE_KEYS);
  return wallPreload;
}

function loadAll(keys: readonly LoadedKey[]): Promise<void> {
  if (typeof globalThis.Image !== "function") return Promise.resolve();
  return Promise.all(keys.map(key => new Promise<void>(resolve => {
    const asset = TERRAIN_VARIANT_ASSETS.find(candidate => candidate.key === key);
    const entry = entries.get(key) as Entry;
    if (asset === undefined) { entry.status = "missing"; resolve(); return; }
    entry.status = "loading";
    const image = new Image();
    image.onload = () => {
      const exact = image.naturalWidth === asset.width && image.naturalHeight === asset.height;
      entry.image = exact ? image : null;
      entry.status = exact ? "ready" : "missing";
      if (exact && asset.role === "module") {
        try { entry.raster = rasterizeWorldSprite(image, { x: 0, y: 0, width: asset.width, height: asset.height }, Math.ceil(ABUTMENT_DISPLAY_WIDTH * asset.height / asset.width * 2)); }
        catch (error) { if (!(error instanceof Error)) throw error; entry.raster = null; }
      }
      resolve();
    };
    image.onerror = () => { entry.status = "missing"; resolve(); };
    image.src = assetUrlForBase(asset.url, import.meta.env?.BASE_URL ?? "/");
  }))).then(() => undefined);
}

export function wallFaceAsset(key: WallFaceKey): HTMLImageElement | null {
  return entries.get(key)?.image ?? null;
}

/** One character per wall face (1 = ready); part of the wall raster key. */
export function wallFaceReadiness(): string {
  return WALL_FACE_KEYS.map(key => entries.get(key)?.status === "ready" ? "1" : "0").join("");
}

/**
 * Shallow water and shore strips as drawn (D3b colour correction): the Wave 4b shallows (97/135/143) and the strips'
 * water half (94/123/124) are lighter and bluer than the old deep water surface (88/95/81, mean of its drawn crop), so
 * they are pulled toward it once per image, in this cache: shallows by SHALLOW_TINT, the strip's water rows by a ramp
 * from 0 at the waterline to STRIP_TINT two tiles' worth of rows below it. The tint colour is the palette stone ramp's
 * second step (86/86/84), the palette colour nearest the deep mean. Browser only; the raw image in Node.
 */
export const SHALLOW_TINT = 0.45;
export const STRIP_TINT = 0.45;
const STRIP_WATERLINE_ROW = 42;
const STRIP_TINT_FULL_ROW = 60;
export function shoreSurface(key: ShoreAssetKey): CanvasImageSource | null {
  const entry = entries.get(key);
  if (entry === undefined || entry.image === null) return null;
  if (entry.tinted !== undefined) return entry.tinted ?? entry.image;
  const shallow = (TERRAIN_VARIANTS.shallowWater as readonly string[]).includes(key);
  const strip = (TERRAIN_VARIANTS.shoreline as readonly string[]).includes(key);
  if ((!shallow && !strip) || typeof document === "undefined") { entry.tinted = null; return entry.image; }
  const image = entry.image;
  const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const paint = canvas.getContext("2d");
  if (paint === null) { entry.tinted = null; return image; }
  drawCroppedWorldSprite(paint, image, { x: 0, y: 0, width: canvas.width, height: canvas.height }, { x: 0, y: 0, width: canvas.width, height: canvas.height }, false, false);
  paint.globalCompositeOperation = "source-atop";
  if (shallow) {
    paint.fillStyle = withAlpha(RAMPS.stone[1], SHALLOW_TINT); paint.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    for (let row = STRIP_WATERLINE_ROW; row < canvas.height; row += 1) {
      const amount = STRIP_TINT * Math.min(1, (row - STRIP_WATERLINE_ROW) / (STRIP_TINT_FULL_ROW - STRIP_WATERLINE_ROW));
      paint.fillStyle = withAlpha(RAMPS.stone[1], amount); paint.fillRect(0, row, canvas.width, 1);
    }
  }
  paint.globalCompositeOperation = "source-over";
  entry.tinted = canvas;
  return canvas;
}

export function shoreAsset(key: ShoreAssetKey): HTMLImageElement | null {
  return entries.get(key)?.image ?? null;
}

export function shoreAssetRaster(key: ShoreAssetKey): RasterizedWorldSprite | null {
  return entries.get(key)?.raster ?? null;
}

/** One character per asset (1 = ready); part of the ground chunk key of chunks that draw water. */
export function shoreAssetReadiness(): string {
  return SHORE_ASSET_KEYS.map(key => entries.get(key)?.status === "ready" ? "1" : "0").join("");
}

export function shoreAssetStatuses(): readonly { readonly key: ShoreAssetKey; readonly status: Entry["status"] }[] {
  return SHORE_ASSET_KEYS.map(key => ({ key, status: entries.get(key)?.status ?? "idle" }));
}

/** Tests only. */
export function setShoreAssetsForTest(images: Partial<Record<LoadedKey, HTMLImageElement | null>>): void {
  for (const [key, image] of Object.entries(images) as [LoadedKey, HTMLImageElement | null][]) {
    entries.set(key, { status: image === null ? "idle" : "ready", image, raster: null });
  }
}
