import { registerRuntimeAsset } from "./runtimeAssetCoordinates";
import { drawAnimatedMill } from "./animatedMill";
import { BUILDING_CONFIG_BY_KIND, type Building, type BuildingKind } from "../content/buildingConfig";
import { productionOperation } from "../economy/production";
import { buildingHasRequiredRoadAccess } from "../engine/roadAccess";
import type { GameState } from "../engine/engine.types";
import { marketHasSaleCandidate } from "../engine/marketSettlement";
import { buildingFootprint } from "../geometry/buildingFootprint";
import { historicalFacilityManifest, type HistoricalFacilityAssetId } from "./historicalFacilityManifest";
import { tileToScreen, TILE_H } from "./iso";
import { assetUrlForBase } from "./worldAssets";
import { drawCroppedWorldSprite } from "./worldSprite";
import { rasterizeWorldSprite, type RasterizedWorldSprite } from "./worldSpriteRaster";
import { frameBuildingVariant, type BuildingVariant } from "./buildingVariants";
import { variantSprite } from "./buildingVariantAssets";

type Meta = typeof historicalFacilityManifest[number];
type Asset = { readonly meta: Meta; readonly url: string; status: "idle" | "loading" | "ready" | "missing"; image: HTMLImageElement | null; raster: RasterizedWorldSprite | null; rasterError: string | null };
const assets: Asset[] = historicalFacilityManifest.map(meta => ({ meta,
  url: assetUrlForBase(meta.url, import.meta.env?.BASE_URL ?? "/"), status: "idle", image: null, raster: null, rasterError: null,
}));
let preload: Promise<void> | null = null;
const marketActivity = new WeakMap<GameState, WeakMap<Building, boolean>>();

function marketIsActive(state: GameState, building: Building): boolean {
  let byBuilding = marketActivity.get(state);
  if (byBuilding === undefined) {
    byBuilding = new WeakMap<Building, boolean>();
    marketActivity.set(state, byBuilding);
  }
  const cached = byBuilding.get(building);
  if (cached !== undefined) return cached;
  const active = marketHasSaleCandidate(state, building);
  byBuilding.set(building, active);
  return active;
}

export function preloadHistoricalFacilityAssets(): Promise<void> {
  if (typeof globalThis.Image !== "function") return Promise.resolve();
  preload ??= Promise.all(assets.map(asset => new Promise<void>(resolve => {
    asset.status = "loading";
    try {
      const image = new Image();
      image.onload = () => {
        try {
          if (registerRuntimeAsset(image, asset.url, asset.meta.width, asset.meta.height)) {
            asset.image = image;
            asset.status = "ready";
            asset.raster = rasterizeWorldSprite(image, asset.meta.source,
              Math.ceil(asset.meta.displayWidth * asset.meta.source.height / asset.meta.source.width * 3));
          } else asset.status = "missing";
        } catch (error) {
          asset.raster = null;
          asset.rasterError = error instanceof Error ? error.message : String(error);
        } finally {
          resolve();
        }
      };
      image.onerror = () => { asset.status = "missing"; resolve(); };
      image.src = asset.url;
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      asset.status = "missing";
      resolve();
    }
  }))).then(() => undefined);
  return preload;
}

export function historicalFacilityAssetStatuses() {
  return assets.map(({ meta, url, status, rasterError }) => ({ id: meta.id, url, status, rasterError }));
}

export function historicalFacilityReady(building: Building, state?: GameState): boolean {
  const id = historicalFacilityAssetId(building, state);
  return assets.some(asset => asset.meta.id === id && asset.status === "ready");
}

export function historicalFacilityAssetId(building: Building, state?: GameState): HistoricalFacilityAssetId | null {
  switch (building.kind) {
    case "mill": case "masonry": case "sawmill": case "chapel": case "church": case "keep":
      return building.kind;
    case "market":
      return state !== undefined && marketIsActive(state, building) ? "market_active" : "market_quiet";
    case "quarry": {
      const definition = BUILDING_CONFIG_BY_KIND.quarry;
      return productionOperation(building, definition, state !== undefined && buildingHasRequiredRoadAccess(state, building)) === "working"
        ? "quarry_active" : "quarry_idle";
    }
    case "house": case "well": case "storehouse": case "granary": case "wheat_farm": case "farmstead": case "logging_camp":
      return null;
  }
}

export function getHistoricalFacilityPresentation(kind: BuildingKind) {
  const asset = assets.find(candidate => candidate.meta.kind === kind);
  return asset === undefined ? null : { url: asset.url, width: asset.meta.width, height: asset.meta.height, crop: asset.meta.source };
}

export function historicalFacilitySpriteRect(building: Building) {
  const meta = assets.find(asset => asset.meta.kind === building.kind)?.meta;
  if (meta === undefined) return null;
  const size = buildingFootprint(building);
  const center = tileToScreen(building.tx + (size.width - 1) / 2, building.ty + (size.height - 1) / 2);
  const height = meta.displayWidth * meta.source.height / meta.source.width;
  return { x: center.sx - meta.displayWidth / 2,
    y: center.sy + TILE_H / 2 - height,
    width: meta.displayWidth, height };
}

export function drawHistoricalFacility(context: CanvasRenderingContext2D, building: Building, state: GameState): boolean {
  const variant = frameBuildingVariant(building);
  // The windmill variant is one static painting (sails included) in the mill-v2 frame, so it skips the animated mill.
  if (variant?.id !== "windmill" && drawAnimatedMill(context, building)) return true;
  const id = historicalFacilityAssetId(building, state);
  if (id === null) return false;
  void preloadHistoricalFacilityAssets();
  const asset = assets.find(candidate => candidate.meta.id === id);
  const rect = historicalFacilitySpriteRect(building);
  if (asset?.status !== "ready" || asset.image === null || rect === null) return false;
  const url = facilityVariantUrl(variant, id);
  const sprite = url === null ? null : variantSprite(url, asset.meta.width, asset.meta.height, asset.meta.source,
    Math.ceil(asset.meta.displayWidth * asset.meta.source.height / asset.meta.source.width * 3));
  drawCroppedWorldSprite(context, sprite?.image ?? asset.raster?.image ?? asset.image, sprite?.source ?? asset.raster?.source ?? asset.meta.source, rect, false, true);
  return true;
}

/** A market keeps its variant between active and quiet; a variant without a quiet painting shows the base quiet stalls. */
function facilityVariantUrl(variant: BuildingVariant | null, id: HistoricalFacilityAssetId): string | null {
  if (variant === null) return null;
  if (id === "market_quiet") return "quiet" in variant ? variant.quiet.url : null;
  return variant.url;
}
