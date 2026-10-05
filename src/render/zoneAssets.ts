import { ZONE_ASSETS, type ZoneAssetKey } from "./zoneAssetManifest";
import { assetUrlForBase } from "./worldAssets";
import { rasterizeWorldSprite, type RasterizedWorldSprite } from "./worldSpriteRaster";

import { FIELD_TEXTURE_IDS, fieldTextures, legacyFieldTextureId, setFieldTextureImagesForTest } from "./art/fieldTextures";

type Entry = { status: "idle" | "loading" | "ready" | "missing"; image: HTMLImageElement | null; raster: RasterizedWorldSprite | null };
// Browser image loading cache, not simulation state. Loading starts the first time a zone is drawn.
const entries = new Map<ZoneAssetKey, Entry>(ZONE_ASSETS.filter(asset => legacyFieldTextureId(asset.key) === null).map(asset => [asset.key, { status: "idle", image: null, raster: null }]));
let preload: Promise<void> | null = null;

export function preloadZoneAssets(): Promise<void> {
  if (typeof globalThis.Image !== "function") return Promise.resolve();
  preload ??= Promise.all([...ZONE_ASSETS.map(asset => {
    const id = legacyFieldTextureId(asset.key);
    if (id !== null) return fieldTextures().loadSettled(id).then(() => undefined);
    return new Promise<void>(resolve => {
      const entry = entries.get(asset.key) as Entry;
      entry.status = "loading";
      const image = new Image();
      image.onload = () => {
        const exact = image.naturalWidth === asset.width && image.naturalHeight === asset.height;
        entry.image = exact ? image : null;
        entry.status = exact ? "ready" : "missing";
        if (exact && "displayWidth" in asset) {
          // Props, decals and modules shrink 4x or more; one high-quality downscale at twice the display size keeps them clean.
          try { entry.raster = rasterizeWorldSprite(image, { x: 0, y: 0, width: asset.width, height: asset.height }, Math.ceil(asset.displayWidth * asset.height / asset.width * 2)); }
          catch (error) { if (!(error instanceof Error)) throw error; entry.raster = null; }
        }
        resolve();
      };
      image.onerror = () => { entry.status = "missing"; resolve(); };
      image.src = assetUrlForBase(asset.url, import.meta.env?.BASE_URL ?? "/");
    });
  }), ...FIELD_TEXTURE_IDS.filter(id => !ZONE_ASSETS.some(asset => legacyFieldTextureId(asset.key) === id))
    .map(id => fieldTextures().loadSettled(id))]).then(() => undefined);
  return preload;
}

export function zoneAsset(key: ZoneAssetKey): HTMLImageElement | null {
  const id = legacyFieldTextureId(key);
  return id === null ? entries.get(key)?.image ?? null : fieldTextures().status(id).status === "ready" ? fieldTextures().image(id) : null;
}

export function zoneAssetRaster(key: ZoneAssetKey): RasterizedWorldSprite | null {
  return entries.get(key)?.raster ?? null;
}

/**
 * One character per asset (1 = ready), for `keys` or every zone asset; part of the ground chunk key of chunks that
 * draw zone or yard art (a string: there are more assets than bits in a number).
 */
export function zoneAssetReadiness(keys?: readonly ZoneAssetKey[]): string {
  return (keys ?? ZONE_ASSETS.map(asset => asset.key)).map(key => zoneStatus(key) === "ready" ? "1" : "0").join("");
}

export function zoneAssetStatuses(): readonly { readonly key: ZoneAssetKey; readonly status: Entry["status"] }[] {
  return ZONE_ASSETS.map(asset => ({ key: asset.key, status: zoneStatus(asset.key) }));
}

function zoneStatus(key: ZoneAssetKey): Entry["status"] {
  const id = legacyFieldTextureId(key);
  if (id === null) return entries.get(key)?.status ?? "idle";
  const status = fieldTextures().status(id).status;
  return status === "unavailable" ? "idle" : status;
}

/** Tests only. */
export function setZoneAssetsForTest(images: Partial<Record<ZoneAssetKey, HTMLImageElement | null>>): void {
  const fieldImages = new Map<string, HTMLImageElement | null>();
  for (const [key, image] of Object.entries(images) as [ZoneAssetKey, HTMLImageElement | null][]) {
    const id = legacyFieldTextureId(key);
    if (id !== null) { fieldImages.set(id, image); continue; }
    entries.set(key, { status: image === null ? "idle" : "ready", image, raster: null });
  }
  if (fieldImages.size > 0) setFieldTextureImagesForTest(fieldImages);
}
