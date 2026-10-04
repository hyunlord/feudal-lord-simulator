import { contractHouseArt, type ContractHouseDraw, type ContractHouseInput } from './art/contractHouseArt';
import { registerRuntimeAsset } from "./runtimeAssetCoordinates";
import type { Building } from "../content/buildingConfig";
import { assetUrlForBase } from "./worldAssets";
import { drawCroppedWorldSprite } from "./worldSprite";
import { rasterizeWorldSprite, type RasterizedWorldSprite } from "./worldSpriteRaster";
import { tileToScreen, TILE_W, TILE_H } from "./iso";
import { historicalHouseAssetManifest } from "./historicalHouseAssetManifest.generated";
import { frameBuildingVariant } from "./buildingVariants";
import { variantSprite } from "./buildingVariantAssets";
import { alehouseArt } from "./aleWorldArt";
import { WAVE3_ALE_IMAGES } from "./wave3AleManifest.generated";
import { drawWave26House, shownHouseVariant } from "./wave26HouseArt";

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
          if (registerRuntimeAsset(image, record.meta.url, record.meta.width, record.meta.height)) {
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

/**
 * A single-lot house's painting at its level: a Wave 2 visual variant painted in the level's frame, or (INSTALL-3) the
 * Wave 3 alehouse with its ale-stake, an edit of house L2 on the same 137 px canvas and pivot (alehouseArt), drawn
 * through the same variant path (its coordinates are the L2 frame's). INSTALL-26: or the household's Wave 26 painting
 * (houseVariantChoice.ts; never on an alehouse under its stake), through its own crop in the same frame.
 */
function drawLegacyHistoricalHouse(context: CanvasRenderingContext2D, building: Building, builtLevel: number,
  state?: ContractHouseInput['state']): boolean {
  if (building.kind !== "house" || building.houseLot !== undefined) return false;
  void preloadHistoricalHouseAssets();
  const record = records.find(candidate => candidate.meta.level === builtLevel);
  if (record?.status !== "ready" || record.image === null) return false;
  const rect = historicalHouseSpriteRect(building, record.meta);
  const wave26 = shownHouseVariant(building, builtLevel);
  if (wave26 !== null && drawWave26House(context, wave26, record.meta.alphaBounds, rect)) return true;
  const alehouse = state === undefined ? null : alehouseArt(state, building, state.houses.find(house => house.buildingId === building.id), builtLevel);
  const url = alehouse !== null ? WAVE3_ALE_IMAGES[alehouse].url : frameBuildingVariant(building)?.url ?? null;
  const variant = url === null ? null : variantSprite(url, record.meta.width, record.meta.height, record.meta.alphaBounds, Math.ceil(rect.height * 2));
  drawCroppedWorldSprite(context, variant?.image ?? record.raster?.image ?? record.image,
    variant?.source ?? record.raster?.source ?? record.meta.alphaBounds, rect, false, true);
  return true;
}


/** Preserve the existing boolean API for ghosts and direct callers without discarding the frame receipt in the world pass. */
export function drawHistoricalHouse(context: CanvasRenderingContext2D, building: Building, builtLevel: number,
  state?: ContractHouseInput['state']): boolean {
  return drawHistoricalHouseBody(context, building, builtLevel, state).drawn;
}

export function drawHistoricalHouseBody(context: CanvasRenderingContext2D, building: Building, builtLevel: number,
  state?: ContractHouseInput['state']): { readonly drawn: boolean; readonly contract: ContractHouseDraw | null } {
  const contract = contractHouseArt.drawBody(context, { state, building, level: builtLevel });
  return { drawn: contract !== null || drawLegacyHistoricalHouse(context, building, builtLevel, state), contract };
}
