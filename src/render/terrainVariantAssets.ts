import { TERRAIN_VARIANT_ASSETS, SHORE_ASSET_KEYS, type ShoreAssetKey } from "./terrainVariantManifest";
import { assetUrlForBase } from "./worldAssets";
import { rasterizeWorldSprite, type RasterizedWorldSprite } from "./worldSpriteRaster";

// Browser image cache for the D3a shore pieces (not simulation state). Loading starts the first time a frame with
// water is drawn; the bridge abutments get one high-quality downscale at twice their display size.

type Entry = { status: "idle" | "loading" | "ready" | "missing"; image: HTMLImageElement | null; raster: RasterizedWorldSprite | null };
const entries = new Map<ShoreAssetKey, Entry>(SHORE_ASSET_KEYS.map(key => [key, { status: "idle", image: null, raster: null }]));
let preload: Promise<void> | null = null;
/** Screen width of a 256x192 abutment at zoom 1: it is authored at 256 source px per tile (projected width 128x64 per tile edge). */
export const ABUTMENT_DISPLAY_WIDTH = 64;

export function preloadShoreAssets(): Promise<void> {
  if (typeof globalThis.Image !== "function") return Promise.resolve();
  preload ??= Promise.all(SHORE_ASSET_KEYS.map(key => new Promise<void>(resolve => {
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
  return preload;
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
export function setShoreAssetsForTest(images: Partial<Record<ShoreAssetKey, HTMLImageElement | null>>): void {
  for (const [key, image] of Object.entries(images) as [ShoreAssetKey, HTMLImageElement | null][]) {
    entries.set(key, { status: image === null ? "idle" : "ready", image, raster: null });
  }
}
