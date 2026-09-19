import { rasterizeWorldSprite, type RasterizedWorldSprite } from "./worldSpriteRaster";
import { assetUrlForBase } from "./worldAssets";
import { STONE_WALL_SOURCES, type StoneWallAxis } from "./stoneWallGeometry";

type Asset = { readonly axis: StoneWallAxis; readonly url: string; status: "idle" | "loading" | "ready" | "missing"; image: HTMLImageElement | null; loadError: string | null };
const assets: Asset[] = (["descending", "ascending"] as const).map(axis => ({
  axis, url: assetUrlForBase(`assets/buildings/historical-wall/${STONE_WALL_SOURCES[axis].filename}`, import.meta.env?.BASE_URL ?? "/"), status: "idle", image: null, loadError: null,
}));
let preload: Promise<void> | null = null;
let material: RasterizedWorldSprite | null = null;
export function preloadStoneWallAssets(): Promise<void> {
  if (typeof globalThis.Image !== "function") return Promise.resolve();
  preload ??= Promise.all(assets.map(asset => new Promise<void>(resolve => {
    asset.status = "loading";
    try {
      const image = new Image();
      image.onload = () => {
        try {
          asset.status = image.naturalWidth === 1254 && image.naturalHeight === 1254 ? "ready" : "missing";
          if (asset.status === "ready") {
            asset.image = image;
            if (asset.axis === "descending") material = rasterizeWorldSprite(image, { x: 360, y: 570, width: 60, height: 180 }, 180);
          }
        } catch (error) {
          asset.status = asset.image === null ? "missing" : "ready";
          if (asset.axis === "descending") material = null;
          asset.loadError = error instanceof Error ? error.message : String(error);
        } finally {
          resolve();
        }
      };
      image.onerror = () => { asset.status = "missing"; resolve(); };
      image.src = asset.url;
    } catch (error) {
      asset.status = "missing";
      asset.loadError = error instanceof Error ? error.message : String(error);
      resolve();
    }
  }))).then(() => undefined);
  return preload;
}
export function stoneWallAssetStatuses() {
  return assets.map(({ axis, url, status, loadError }) => ({ axis, url, status, loadError }));
}
export function stoneWallImage(axis: StoneWallAxis): HTMLImageElement | null {
  return assets.find(asset => asset.axis === axis)?.image ?? null;
}

export function stoneWallMaterial(): RasterizedWorldSprite | null { return material; }
