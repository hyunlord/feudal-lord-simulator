import { registerRuntimeAsset } from "./runtimeAssetCoordinates";
import { drawCroppedWorldSprite } from "./worldSprite";
import { rasterizeWorldSprite, type RasterizedWorldSprite } from "./worldSpriteRaster";
import { assetUrlForBase } from "./worldAssets";
import type { Building } from "../content/buildingConfig";
import { buildingFootprint } from "../geometry/buildingFootprint";
import { tileToScreen, TILE_W, TILE_H } from "./iso";
import { houseCompoundAssetManifest } from "./houseCompoundAssetManifest.generated";

type Axis = "horizontal" | "vertical";
export type HouseCompoundAssetMeta = Readonly<{
  level: 2 | 3 | 4;
  axis: Axis;
  url: string;
  width: number;
  height: number;
  alphaBounds: Readonly<{ x: number; y: number; width: number; height: number }>;
}>;
type Status = "idle" | "loading" | "ready" | "missing";
type Record = { meta: HouseCompoundAssetMeta; status: Status; image: HTMLImageElement | null; raster: RasterizedWorldSprite | null; rasterError: string | null };
const records: Record[] = houseCompoundAssetManifest.map(meta => ({ meta: { ...meta, url: assetUrlForBase(meta.url, import.meta.env?.BASE_URL ?? "/") }, status: "idle", image: null, raster: null, rasterError: null }));
let preloadPromise: Promise<void> | null = null;

export function preloadHouseCompoundAssets(): Promise<void> {
  if (typeof globalThis.Image !== "function") return Promise.resolve();
  preloadPromise ??= Promise.all(records.map(record => new Promise<void>(resolve => {
    record.status = "loading";
    try {
      const image = new Image();
      image.onload = () => {
        try {
          if (registerRuntimeAsset(image, record.meta.url, record.meta.width, record.meta.height)) {
            record.image = image; record.status = "ready";
            const height = TILE_W * 1.5 * 0.88 * record.meta.alphaBounds.height / record.meta.alphaBounds.width;
            record.raster = rasterizeWorldSprite(image, record.meta.alphaBounds, Math.ceil(height * 2));
          } else record.status = "missing";
        } catch (error) {
          record.raster = null;
          record.rasterError = error instanceof Error ? error.message : String(error);
        } finally { resolve(); }
      };
      image.onerror = () => { record.status = "missing"; resolve(); };
      image.src = record.meta.url;
    } catch { record.status = "missing"; resolve(); }
  }))).then(() => undefined);
  return preloadPromise;
}

export function houseCompoundAssetStatuses() {
  return records.map(({ meta, status, rasterError }) => ({ rasterError, level: meta.level, axis: meta.axis, url: meta.url, status }));
}

export function houseCompoundSpriteRect(building: Building, meta: HouseCompoundAssetMeta) {
  const size = buildingFootprint(building);
  const center = tileToScreen(building.tx + (size.width - 1) / 2, building.ty + (size.height - 1) / 2);
  const width = (size.width + size.height) * TILE_W / 2 * 0.88;
  const height = width * meta.alphaBounds.height / meta.alphaBounds.width;
  return { x: center.sx - width / 2, y: center.sy + TILE_H / 2 - height, width, height };
}

export function houseCompoundAssetMeta(building: Building, level: number): HouseCompoundAssetMeta | null {
  return records.find(record => record.meta.level === level && record.meta.axis === building.houseLot)?.meta ?? null;
}

export function drawHouseCompoundSprite(context: CanvasRenderingContext2D, building: Building, level: number): boolean {
  void preloadHouseCompoundAssets();
  const record = records.find(candidate => candidate.meta.level === level && candidate.meta.axis === building.houseLot);
  if (record?.status !== "ready" || record.image === null) return false;
  const rect = houseCompoundSpriteRect(building, record.meta);
  const bounds = record.meta.alphaBounds;
  drawCroppedWorldSprite(context, record.raster?.image ?? record.image, record.raster?.source ?? bounds, rect, false, true);
  return true;
}
