import { registerRuntimeAssetVariant } from "./runtimeAssetCoordinates";
import type { Building } from "../content/buildingConfig";
import { frameBuildingVariant } from "./buildingVariants";
import { BUILDING_VARIANT_POOLS } from "./buildingVariantManifest";
import { historicalFacilityManifest } from "./historicalFacilityManifest";
import { historicalHouseAssetManifest } from "./historicalHouseAssetManifest.generated";
import { houseCompoundAssetManifest } from "./houseCompoundAssetManifest.generated";
import { assetUrlForBase, spriteMeta } from "./worldAssets";
import { rasterizeWorldSprite, type RasterizedWorldSprite } from "./worldSpriteRaster";

// Browser image cache for Wave 2 variants (not simulation state). A variant image is registered in its base's
// authored frame, so every draw keeps using the base's crop and destination rectangle. Rasters are made once per
// (url, crop, height) exactly like the base sprites, so a variant costs no more per frame than its base.
type Crop = Readonly<{ x: number; y: number; width: number; height: number }>;
// Rasters are keyed by the caller's crop object (a stable manifest record) and the raster height: no per-draw strings.
type Record = { status: "loading" | "ready" | "missing"; image: HTMLImageElement | null; rasters: Map<Crop, Map<number, RasterizedWorldSprite | null>>; loaded: Promise<void> };
const records = new Map<string, Record>();

function record(url: string, originalWidth: number, originalHeight: number): Record | null {
  if (typeof globalThis.Image !== "function") return null;
  let entry = records.get(url);
  if (entry !== undefined) return entry;
  let settle: () => void = () => undefined;
  const created: Record = { status: "loading", image: null, rasters: new Map(), loaded: new Promise<void>(resolve => { settle = resolve; }) };
  records.set(url, created);
  const image = new Image();
  image.onload = () => {
    created.status = registerRuntimeAssetVariant(image, originalWidth, originalHeight) ? "ready" : "missing";
    created.image = created.status === "ready" ? image : null;
    settle();
  };
  image.onerror = () => { created.status = "missing"; settle(); };
  image.src = assetUrlForBase(url, import.meta.env?.BASE_URL ?? "/");
  entry = created;
  return entry;
}

/** The variant image once loaded (null while loading or in Node), registered in the base frame. */
export function variantImage(url: string, originalWidth: number, originalHeight: number): HTMLImageElement | null {
  const entry = record(url, originalWidth, originalHeight);
  return entry?.status === "ready" ? entry.image : null;
}

/** Variant image + its cached raster for one crop, mirroring how the base sprite of that kind is rasterized. */
export function variantSprite(url: string, originalWidth: number, originalHeight: number, source: Crop, rasterHeight: number): { readonly image: CanvasImageSource; readonly source: Crop } | null {
  const image = variantImage(url, originalWidth, originalHeight);
  if (image === null) return null;
  const entry = records.get(url) as Record;
  let byHeight = entry.rasters.get(source);
  if (byHeight === undefined) { byHeight = new Map(); entry.rasters.set(source, byHeight); }
  let raster = byHeight.get(rasterHeight);
  if (raster === undefined) {
    raster = null;
    try { raster = rasterizeWorldSprite(image, source, rasterHeight); } catch (error) { if (!(error instanceof Error)) throw error; }
    byHeight.set(rasterHeight, raster);
  }
  return raster === null ? { image, source } : { image: raster.image, source: raster.source };
}

export function buildingVariantAssetStatuses(): readonly { readonly url: string; readonly status: Record["status"] }[] {
  return [...records].map(([url, entry]) => ({ url, status: entry.status }));
}

/** Same-size replacement for a world-manifest sprite (well, storehouse variants), or null for the base sprite. */
export function worldSpriteVariantImage(building: Pick<Building, "id">, key: string): HTMLImageElement | null {
  const url = frameBuildingVariant(building)?.url ?? null;
  const meta = spriteMeta(key);
  return url === null || meta === null ? null : variantImage(url, meta.width, meta.height);
}

/** Starts loading every variant with its base frame size (the same sizes the draw functions pass). */
export function preloadBuildingVariantAssets(): Promise<void> {
  const loads: Promise<void>[] = [];
  for (const pool of BUILDING_VARIANT_POOLS) for (const variant of pool.variants) {
    const images = [variant, ...("quiet" in variant ? [variant.quiet] : [])];
    for (const image of images) {
      if (image.url === null) continue;
      const frame = baseFrame(pool, image);
      const entry = record(image.url, frame.width, frame.height);
      if (entry !== null) loads.push(entry.loaded);
    }
  }
  return Promise.all(loads).then(() => undefined);
}

function baseFrame(pool: (typeof BUILDING_VARIANT_POOLS)[number], image: { readonly width: number; readonly height: number }): { width: number; height: number } {
  if (pool.kind === "house" && "level" in pool) {
    const meta = pool.lot === "single" ? historicalHouseAssetManifest.find(entry => entry.level === pool.level)
      : houseCompoundAssetManifest.find(entry => entry.level === pool.level && entry.axis === pool.lot);
    if (meta !== undefined) return meta;
  }
  const facility = historicalFacilityManifest.find(entry => entry.kind === pool.kind);
  // Wells and storehouses replace world-manifest sprites of the same pixel size.
  return facility ?? image;
}
