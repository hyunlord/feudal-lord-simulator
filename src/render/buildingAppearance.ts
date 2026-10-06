import type { ContractHouseDraw } from './art/contractHouseArt';
import { buildingAttachmentArt } from './art/buildingAttachmentArt';
import { drawHouseCompoundSprite } from "./houseCompoundAssets";
import { drawHistoricalHouseBody } from "./historicalHouseAssets";
import { drawHistoricalFacility } from "./historicalFacilityAssets";
import { drawHouseCondition } from "./houseConditionOverlay";
import { stateCalendar } from "../engine/scenarioState";
import { spriteMeta } from "./worldAssets";
import { drawKindDetail } from "./drawBuildingDetails";
import { drawBuildingSprite } from "./buildingSpriteFit";
import { drawBuildingOverlays } from "./buildingOverlays";
import { drawFarmsteadSprite } from "./farmsteadArt";
import { drawBody, drawLodBlock, drawRoof } from "./buildingFallbackShapes";
import { drawHouseRoofSmoke, drawWorkFireSmoke, smokeTimeMs } from "./roofSmoke";
import type { GameState } from "../engine/engine.types";
import type { Building } from "../economy/economy.types";
import { buildingFootprint } from "../geometry/buildingFootprint";
import { tileToScreen } from "./iso";
import { drawHouseCompound } from "./houseCompound";
import { buildBuildingVisualState, renderDetailLevel } from "./buildingVisualState";
import { houseMaterialEraFromEra, type HouseMaterialWave } from "./buildingMaterialWave";
import { buildingSpriteKey } from "./buildingSprites";
import type { WorldSpriteOptions } from "./worldSprite";
import type { ObjectRenderViewMode } from "./objectRenderViewMode";

type BuildingAppearanceInput = {
  readonly state: GameState;
  readonly zoom: number;
  readonly houseMaterialWave?: HouseMaterialWave | null;
  readonly nowMs?: number;
  readonly viewMode?: ObjectRenderViewMode;
};
type Point = { readonly x: number; readonly y: number };

export function drawBuildingAppearance(
  context: CanvasRenderingContext2D,
  input: BuildingAppearanceInput,
  building: Building,
  spriteOptions: WorldSpriteOptions,
): void {
  const contract = drawBuildingDetail(context, input, building, spriteOptions);
  // INSTALL-7 snow, boards, piles; NAT-2: the snow, boards and fire on the painted houses of the status view too (the
  // boards are a state), without the door piles and story props (a speck there; the piles were ~0.37 ms a frame in
  // the 1380 town at zoom 0.6, 5x: CPU profile, 20 ms/s at ~55 frames/s).
  const detail = renderDetailLevel(input.zoom); if (detail !== "blocks") drawBuildingOverlays(context, input.state, building, detail === "full", contract);
  if ((input.viewMode ?? 'normal') === 'normal' && contract !== null) {
    buildingAttachmentArt.draw(context, { state: input.state, building, drawn: contract, zoom: input.zoom });
  }
}

function drawBuildingDetail(
  context: CanvasRenderingContext2D,
  input: BuildingAppearanceInput,
  building: Building,
  spriteOptions: WorldSpriteOptions,
): ContractHouseDraw | null {
  const center = buildingCenter(building);
  const visualState = buildBuildingVisualState(building, input.state.houses, {
    era: houseMaterialEraFromEra(input.state.era),
    wave: input.houseMaterialWave ?? null,
    nowMs: input.nowMs ?? 0,
  });
  // NAT-2 QA-008: the painted art above block detail (from mip levels when small); the smoke only at full detail.
  const detailLevel = renderDetailLevel(input.zoom); const painted = detailLevel !== "blocks";
  // The 2x2 wheat farm is retired (C1c-2: v9 -> v10 saves turn farms into arable fields and a farmstead; C1f: its art
  // left the runtime). Only an unmigrated test state can still hold one, and it draws nothing.
  if (building.kind === "wheat_farm") return null;
  if (building.kind === "house" && building.houseLot !== undefined) {
    if (!painted || !drawHouseCompoundSprite(context, building, visualState.houseLevel)) {
      drawHouseCompound(context, building, visualState.houseLevel, detailLevel);
    } else drawHouseCondition(context, building, visualState.houseLevel, visualState.houseCondition);
    if (detailLevel === "full") drawHouseRoofSmoke(context, input.state, building, visualState.houseLevel, smokeTimeMs(input));
    drawKindDetail(context, { hideProblemMarker: true, architecture: "baked", tick: input.state.tick, center, kind: building.kind, zoom: input.zoom, visualState });
    return null;
  }
  if (painted && building.kind === "farmstead" && drawFarmsteadSprite(context, building, input.state, spriteOptions)) {
    drawKindDetail(context, { hideProblemMarker: true, architecture: "baked", tick: input.state.tick, center, kind: building.kind, zoom: input.zoom, visualState });
    return null;
  }
  if (painted) {
    const historical = building.kind === "house"
      ? drawHistoricalHouseBody(context, building, visualState.houseLevel, input.state)
      : { drawn: drawHistoricalFacility(context, building, input.state), contract: null };
    if (historical.drawn) {
      if (building.kind === "house") drawHouseCondition(context, building, visualState.houseLevel, visualState.houseCondition, historical.contract);
      // F0-V: roof smoke of a lived-in house, the mill oven's smoke while it runs.
      if (building.kind === "house" && detailLevel === "full") drawHouseRoofSmoke(context, input.state, building, visualState.houseLevel, smokeTimeMs(input));
      if (detailLevel === "full") drawWorkFireSmoke(context, building, input.state, smokeTimeMs(input)); // the mill's oven, the kiln's flue (INSTALL-3)
      drawKindDetail(context, { hideProblemMarker: true, architecture: "baked", tick: input.state.tick, center,
        kind: building.kind, zoom: input.zoom, visualState });
      return historical.contract;
    }
    const spriteKey = buildingSpriteKey(building, visualState.houseLevel);
    const spriteDrawn = drawBuildingSprite(context, building, spriteKey, spriteOptions);
    if (spriteDrawn) {
      drawKindDetail(context, { hideProblemMarker: true,
        architecture: spriteMeta(spriteKey)?.bakedArchitecture === true ? "baked" : "procedural",
        tick: input.state.tick, nowMs: input.nowMs ?? 0, // NAT-2: the flag and the wheel on the wall clock
        center,
        kind: building.kind,
        zoom: input.zoom,
        visualState,
      });
      return null;
    }
  }
  const shape = {
    center,
    building,
    houseLevel: visualState.houseLevel,
    houseMaterialEra: visualState.houseMaterialEra, zoom: input.zoom, winter: stateCalendar(input.state).season === 3,
  };
  if (detailLevel === "blocks") {
    drawLodBlock(context, shape);
    return null;
  }
  drawBody(context, shape);
  drawRoof(context, shape);
  if (detailLevel === "full") {
    drawKindDetail(context, { hideProblemMarker: true,
      tick: input.state.tick, nowMs: input.nowMs ?? 0,
      center,
      kind: building.kind,
      zoom: input.zoom,
      visualState,
    });
  }
  return null;
}

function buildingCenter(building: Building): Point {
  const config = buildingFootprint(building);
  const center = tileToScreen(building.tx + (config.width - 1) / 2, building.ty + (config.height - 1) / 2);
  return { x: center.sx, y: center.sy };
}

