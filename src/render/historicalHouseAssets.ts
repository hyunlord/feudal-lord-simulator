import type { Building } from "../content/buildingConfig";
import { assetUrlForBase } from "./worldAssets";
import { drawCroppedWorldSprite } from "./worldSprite";
import { rasterizeWorldSprite, type RasterizedWorldSprite } from "./worldSpriteRaster";
import { tileToScreen, TILE_W, TILE_H } from "./iso";
import { historicalHouseAssetManifest } from "./historicalHouseAssetManifest.generated";

export type HistoricalHouseAssetMeta = Readonly<{
  level: 0 | 1 | 2 | 3 | 4;
  url: string;
  width: number;
  height: number;
  alphaBounds: Readonly<{ x: number; y: number; width: number; height: number }>;
}>;
type AssetRecord = {
  readonly meta: HistoricalHouseAssetMeta;
  status: "idle" | "loading" | "ready" | "missing";
  image: HTMLImageElement | null;
  raster: RasterizedWorldSprite | null;
  rasterError: string | null;
};
const records: AssetRecord[] = historicalHouseAssetManifest.map(meta => ({
  meta: { ...meta, url: assetUrlForBase(meta.url, import.meta.env?.BASE_URL ?? "/") },
  status: "idle", image: null, raster: null, rasterError: null,
}));
let preloadPromise: Promise<void> | null = null;

export function preloadHistoricalHouseAssets(): Promise<void> {
  if (typeof globalThis.Image !== "function") return Promise.resolve();
  preloadPromise ??= Promise.all(records.map(record => new Promise<void>(resolve => {
    record.status = "loading";
    try {
      const image = new Image();
      image.onload = () => {
        try {
          if (image.naturalWidth === record.meta.width && image.naturalHeight === record.meta.height) {
            record.image = image;
            record.status = "ready";
            const height = TILE_W * 0.88 * record.meta.alphaBounds.height / record.meta.alphaBounds.width;
            record.raster = rasterizeWorldSprite(image, record.meta.alphaBounds, Math.ceil(height * 2));
          } else record.status = "missing";
        } catch (error) {
          record.raster = null;
          record.rasterError = error instanceof Error ? error.message : String(error);
        } finally { resolve(); }
      };
      image.onerror = () => { record.status = "missing"; resolve(); };
      image.src = record.meta.url;
    } catch (error) {
      record.status = "missing";
      resolve();
      if (!(error instanceof Error)) console.warn("Historical house image initialization failed", error);
    }
  }))).then(() => undefined);
  return preloadPromise;
}

export function historicalHouseAssetStatuses() {
  return records.map(({ meta, status, rasterError }) => ({ rasterError, level: meta.level, url: meta.url, status }));
}

export function historicalHouseAssetMeta(level: number): HistoricalHouseAssetMeta | null {
  return records.find(record => record.meta.level === level)?.meta ?? null;
}

export function historicalHouseReady(level: number): boolean {
  return records.some(record => record.meta.level === level && record.status === "ready");
}

export function historicalHouseSpriteRect(building: Pick<Building, "tx" | "ty">, meta: HistoricalHouseAssetMeta) {
  const center = tileToScreen(building.tx, building.ty);
  const width = TILE_W * 0.88;
  const height = width * meta.alphaBounds.height / meta.alphaBounds.width;
  return { x: center.sx - width / 2, y: center.sy + TILE_H / 2 - height, width, height };
}

export function drawHistoricalHouse(context: CanvasRenderingContext2D, building: Building, builtLevel: number): boolean {
  if (building.kind !== "house" || building.houseLot !== undefined) return false;
  void preloadHistoricalHouseAssets();
  const record = records.find(candidate => candidate.meta.level === builtLevel);
  if (record?.status !== "ready" || record.image === null) return false;
  drawCroppedWorldSprite(context, record.raster?.image ?? record.image, record.raster?.source ?? record.meta.alphaBounds,
    historicalHouseSpriteRect(building, record.meta), false, true);
  return true;
}
