import { BOUNDARY_ASSETS, type BoundaryAssetKey } from "./boundaryAssetManifest";
import { assetUrlForBase } from "./worldAssets";

type Entry = { status: "idle" | "loading" | "ready" | "missing"; image: HTMLImageElement | null };
// Browser image loading cache, not simulation state. Loading starts only when the V2 renderer first asks.
const entries = new Map<BoundaryAssetKey, Entry>(BOUNDARY_ASSETS.map(asset => [asset.key, { status: "idle", image: null }]));
let preload: Promise<void> | null = null;

export function preloadBoundaryAssets(): Promise<void> {
  if (typeof globalThis.Image !== "function") return Promise.resolve();
  preload ??= Promise.all(BOUNDARY_ASSETS.map(asset => new Promise<void>(resolve => {
    const entry = entries.get(asset.key) as Entry;
    entry.status = "loading";
    const image = new Image();
    image.onload = () => {
      const exact = image.naturalWidth === asset.width && image.naturalHeight === asset.height;
      entry.image = exact ? image : null;
      entry.status = exact ? "ready" : "missing";
      resolve();
    };
    image.onerror = () => { entry.status = "missing"; resolve(); };
    image.src = assetUrlForBase(asset.url, import.meta.env?.BASE_URL ?? "/");
  }))).then(() => undefined);
  return preload;
}

export function boundaryAsset(key: BoundaryAssetKey): HTMLImageElement | null {
  return entries.get(key)?.image ?? null;
}

/** One bit per asset; part of every ground chunk key so a chunk re-rasters when an image finishes loading. */
export function boundaryAssetReadiness(): number {
  let bits = 0;
  BOUNDARY_ASSETS.forEach((asset, index) => { if (entries.get(asset.key)?.status === "ready") bits |= 1 << index; });
  return bits;
}

export function boundaryAssetStatuses(): readonly { readonly key: BoundaryAssetKey; readonly status: Entry["status"] }[] {
  return BOUNDARY_ASSETS.map(asset => ({ key: asset.key, status: entries.get(asset.key)?.status ?? "idle" }));
}

/** Tests only: install decoded images (or clear them) without a browser. */
export function setBoundaryAssetsForTest(images: Partial<Record<BoundaryAssetKey, HTMLImageElement | null>>): void {
  for (const [key, image] of Object.entries(images) as [BoundaryAssetKey, HTMLImageElement | null][]) {
    entries.set(key, { status: image === null ? "idle" : "ready", image });
  }
}
