import { registerRuntimeAsset } from "./runtimeAssetCoordinates";
import type { Building } from "../content/buildingConfig";
import { drawFarmSoilTexture, farmSoilTextureStatus, preloadFarmSoilTexture } from "./farmSoilTexture";
import { assetUrlForBase } from "./worldAssets";
import { FARM_REGISTRATION, farmGroundCenter, farmGrowthStage, farmBoundary, type FarmGrowthStage } from "./farmGeometry";
import { tileToScreen } from "./iso";
import { drawCroppedWorldSprite } from "./worldSprite";
import { rasterizeWorldSprite, type RasterizedWorldSprite } from "./worldSpriteRaster";
import { createFarmCanopyCache } from "./farmCanopyCache";
import { CROP_REGISTRATION, FARM_SOIL_SAMPLE, cropDestination, farmCropRoots, farmSoilTiles, type CropStage } from "./farmCropLayout";
import { frameBuildingVariant } from "./buildingVariants";
import { variantImage } from "./buildingVariantAssets";

const farmFiles = {
  worked: "wheat_farm_worked-v3.png",
  seedling: "wheat_farm_seedling-v3.png",
  growing: "wheat_farm_growing-v3.png",
  ripe: "wheat_farm_ripe-v4.png",
} as const satisfies Record<FarmGrowthStage, string>;
type Asset = {
  readonly stage: FarmGrowthStage;
  readonly url: string;
  readonly width: number;
  readonly height: number;
  status: "idle" | "loading" | "ready" | "missing";
  image: HTMLImageElement | null;
  buffer: RasterizedWorldSprite | null;
};
const stages: readonly FarmGrowthStage[] = ["worked", "seedling", "growing", "ripe"];
// These records are the mutable browser image loading cache, not simulation state.
const assets: Asset[] = stages.map(stage => ({
  stage, url: assetUrlForBase(`assets/buildings/historical-farm/${farmFiles[stage]}`, import.meta.env?.BASE_URL ?? "/"),
  width: FARM_REGISTRATION.width, height: FARM_REGISTRATION.height, status: "idle", image: null, buffer: null,
}));
const cropStages: readonly CropStage[] = ["seedling", "growing", "ripe"];
const cropAssets: Asset[] = cropStages.map(stage => ({
  stage, url: assetUrlForBase(`assets/buildings/historical-farm/layers/crop_${stage}-v1.png`, import.meta.env?.BASE_URL ?? "/"),
  width: CROP_REGISTRATION[stage].width, height: CROP_REGISTRATION[stage].height,
  status: "idle", image: null, buffer: null,
}));
let preload: Promise<void> | null = null;
const canopyCache = createFarmCanopyCache();

export function farmCanopyCacheStats() { return canopyCache.stats(); }
export function beginFarmCanopyFrame() { canopyCache.beginFrame(); }

export function preloadFarmAssets(): Promise<void> {
  if (typeof globalThis.Image !== "function") return Promise.resolve();
  preload ??= Promise.all([preloadFarmSoilTexture(), ...[...assets, ...cropAssets].map(asset => new Promise<void>(resolve => {
    asset.status = "loading";
    const image = new Image();
    image.onload = () => {
      if (registerRuntimeAsset(image, asset.url, asset.width, asset.height)) {
        asset.image = image;
        if (cropAssets.includes(asset) && asset.stage !== "worked") {
          asset.buffer = rasterizeWorldSprite(image, CROP_REGISTRATION[asset.stage].source, 64);
        }
        asset.status = "ready";
      } else asset.status = "missing";
      resolve();
    };
    image.onerror = () => { asset.status = "missing"; resolve(); };
    image.src = asset.url;
  }))]).then(() => undefined);
  return preload;
}

export function farmAssetStatuses() {
  return [...[...assets, ...cropAssets].map(({ stage, url, status, buffer }) => ({ stage, url, status, buffer: buffer?.source ?? null })), farmSoilTextureStatus()];
}

export function drawFarmDetail(context: CanvasRenderingContext2D, building: Building, buildings: readonly Building[] = []): boolean {
  if (building.kind !== "wheat_farm") return false;
  void preloadFarmAssets();
  const stage = farmGrowthStage(building);
  // Mixed farm (V1 variant): one painting per growth stage in the wheat-farm frame, drawn like the full-farm fallback.
  const variant = frameBuildingVariant(building);
  const mixed = variant !== null && "stages" in variant ? variantImage(variant.stages[stage].url, FARM_REGISTRATION.width, FARM_REGISTRATION.height) : null;
  if (mixed !== null) { drawFullFarm(context, building, buildings, mixed); return true; }
  if (farmLayersReady()) {
    if (stage === "worked") return true;
    const crop = cropAssets.find(candidate => candidate.stage === stage);
    if (crop?.image !== null && crop?.image !== undefined) {
      const registration = CROP_REGISTRATION[stage];
      const sprite = crop.buffer ?? { image: crop.image, source: registration.source };
      const canopy = canopyCache.get(building, stage, sprite);
      if (canopy !== null) {
        drawCroppedWorldSprite(context, canopy.image, canopy.source, canopy.destination, false, true);
        return true;
      }
      for (const root of farmCropRoots(building)) {
        drawCroppedWorldSprite(context, crop.buffer?.image ?? crop.image,
          crop.buffer?.source ?? registration.source,
          cropDestination(root, registration), false, true);
      }
      return true;
    }
  }
  const asset = assets.find(candidate => candidate.stage === stage);
  if (asset?.status !== "ready" || asset.image === null) return false;
  drawFullFarm(context, building, buildings, asset.image);
  return true;
}

function drawFullFarm(context: CanvasRenderingContext2D, building: Building, buildings: readonly Building[], image: HTMLImageElement): void {
  const center = farmGroundCenter(building);
  const r = FARM_REGISTRATION;
  context.save();
  // Every contour point remains inside the owned ground; adjacent farms keep their common edge.
  context.beginPath();
  farmBoundary(building, buildings).forEach((point, index) => {
    const { sx, sy } = tileToScreen(point.tx, point.ty);
    if (index === 0) context.moveTo(sx, sy);
    else context.lineTo(sx, sy);
  });
  context.closePath();
  context.clip();
  for (const section of [
    { start: 0, height: r.anchorY, scale: r.upperScaleY },
    { start: r.anchorY, height: r.height - r.anchorY, scale: r.lowerScaleY },
  ]) {
    drawCroppedWorldSprite(context, image,
      { x: 0, y: section.start, width: r.width, height: section.height },
      { x: center.x - r.anchorX * r.scaleX, y: center.y + (section.start - r.anchorY) * section.scale,
        width: r.width * r.scaleX, height: section.height * section.scale }, false);
  }
  context.restore();
}


function farmLayersReady(): boolean {
  return assets[0]?.status === "ready" && cropAssets.every(asset => asset.status === "ready");
}

/** Ground is drawn before the object queue, so adjacent soil cannot erase crop tips. */
export function drawFarmSoil(context: CanvasRenderingContext2D, building: Building, buildings: readonly Building[]): boolean {
  if (building.kind !== "wheat_farm") return false;
  void preloadFarmAssets();
  const soil = assets[0];
  if (!farmLayersReady() || soil?.image === null || soil?.image === undefined) return false;
  context.save();
  context.beginPath();
  farmBoundary(building, buildings).forEach((point, index) => {
    const { sx, sy } = tileToScreen(point.tx, point.ty);
    if (index === 0) context.moveTo(sx, sy);
    else context.lineTo(sx, sy);
  });
  context.closePath();
  context.clip();
  drawFarmSoilMaterial(context, building, soil.image);
  context.restore();
  return true;
}

function drawFarmSoilMaterial(context: CanvasRenderingContext2D, building: Pick<Building, "tx" | "ty">, sample: HTMLImageElement): void {
  if (!drawFarmSoilTexture(context, building)) {
    for (const tile of farmSoilTiles(building)) {
      drawCroppedWorldSprite(context, sample, FARM_SOIL_SAMPLE, tile, false);
    }
  }
}

/** Field soil for a caller that has already clipped to its own outline (RENDER_BOUNDARY_V2 field clusters). */
export function drawFarmSoilInClip(context: CanvasRenderingContext2D, building: Pick<Building, "tx" | "ty">): boolean {
  void preloadFarmAssets();
  const soil = assets[0];
  if (!farmLayersReady() || soil?.image === null || soil?.image === undefined) return false;
  drawFarmSoilMaterial(context, building, soil.image);
  return true;
}

/** Bits that change what field soil looks like while art loads; part of the V2 ground chunk key. */
export function farmSoilReadiness(): number {
  return (farmLayersReady() ? 1 : 0) | (farmSoilTextureStatus().status === "ready" ? 2 : 0);
}


export function drawFarmSprite(context: CanvasRenderingContext2D, building: Building, buildings: readonly Building[] = []): boolean {
  drawFarmSoil(context, building, buildings);
  return drawFarmDetail(context, building, buildings);
}
