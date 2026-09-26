import { outlinesOccludingBuilding } from "./selectionOcclusion";
import { drawBuildingContactShadowV2 } from "./buildingContactShadow";
import { boundaryV2Enabled } from "./renderBoundaryFlag";
import { drawHouseCompoundSprite } from "./houseCompoundAssets";
import { drawHistoricalHouse } from "./historicalHouseAssets";
import { drawHistoricalFacility } from "./historicalFacilityAssets";
import { drawHouseCondition } from "./houseConditionOverlay";
import { drawHouseCompound } from "./houseCompound";
import { buildingFootprint } from "../geometry/buildingFootprint";
import type { GameState } from "../engine/engine.types";
import type { Building } from "../economy/economy.types";
import { PALETTE } from "../content/palette";
import type { Tile } from "../world/world.types";
import type { TileCoordinate } from "../world/grid";
import type { CameraState } from "./camera";
import { tileToScreen } from "./iso";
import { spriteMeta } from "./worldAssets";
import { drawKindDetail } from "./drawBuildingDetails";
import { buildBuildingVisualState, renderDetailLevel } from "./buildingVisualState";
import { houseMaterialEraFromEra, type HouseMaterialWave } from "./buildingMaterialWave";
import { buildingSpriteKey, spriteOptionsFor } from "./buildingSprites";
import { buildObjectRenderItems, type WorldObjectRenderItem } from "./objectRenderOrder";
import { drawGroundCoverDescriptor, drawStumpDescriptor, drawTreeDescriptor } from "./drawTrees";
import { drawWalker } from "./drawWalkers";
import { drawZoneProp } from "./zonePropSprites";
import type { TileRange, ViewportSize } from "./renderer";
import type { WorldSpriteOptions } from "./worldSprite";
import { drawBuildingSprite } from "./buildingSpriteFit";
import { drawBuildingOverlays } from "./buildingOverlays";
import { drawFarmsteadSprite } from "./farmsteadArt";
import { drawFarmProp } from "./farmProps";
import { drawBody, drawLodBlock, drawRoof } from "./buildingFallbackShapes";
import { applyInkOutline, snapToPixel } from "./style";
import type { ObjectRenderViewMode } from "./objectRenderViewMode";
import { OBJECT_OUTLINE_ALPHA } from "./occlusionModel";
import { drawHouseRoofSmoke, drawMillOvenSmoke, smokeClockMs } from "./roofSmoke";

type ObjectRenderInput = {
  readonly state: GameState;
  readonly tiles: readonly Tile[];
  readonly range: TileRange;
  readonly zoom: number;
  readonly camera?: CameraState;
  readonly dpr?: number;
  readonly viewport?: ViewportSize;
  readonly objectRenderItems?: readonly WorldObjectRenderItem[];
  readonly houseMaterialWave?: HouseMaterialWave | null;
  readonly nowMs?: number;
  readonly hoveredTile?: TileCoordinate | null;
  readonly selectionMode?: boolean;
  readonly viewMode?: ObjectRenderViewMode;
};

type Point = { readonly x: number; readonly y: number };

export function drawBuildings(
  context: CanvasRenderingContext2D,
  input: ObjectRenderInput,
): void {
  const items = input.objectRenderItems ?? buildObjectRenderItems({
    tiles: input.tiles,
    worldTiles: input.state.tiles,
    buildings: input.state.buildings,
    walkers: input.state.walkers,
    range: input.range,
    seed: input.state.seed,
    includeGroundCover: renderDetailLevel(input.zoom) === "full",
  });
  const spriteOptions = spriteOptionsFor(input);
  for (const item of items) {
    if (item.kind === "tree") {
      drawTreeDescriptor(context, {
        tick: input.state.tick,
        tree: item.descriptor,
        zoom: input.zoom,
        spriteOptions,
      });
    } else if (item.kind === "groundCover") {
      drawGroundCoverDescriptor(context, {
        descriptor: item.descriptor,
        zoom: input.zoom,
        spriteOptions,
      });
    } else if (item.kind === "stump") {
      drawStumpDescriptor(context, {
        descriptor: item.descriptor,
        zoom: input.zoom,
        spriteOptions,
      });
    } else if (item.kind === "walker") {
      drawWalker(context, item.walker, input.zoom, input.viewMode ?? "normal", input.state);
    } else if (item.kind === "zone_prop") {
      if ((input.viewMode ?? "normal") === "normal") drawZoneProp(context, item.prop);
    } else if (item.kind === "farm_prop") {
      if ((input.viewMode ?? "normal") === "normal") drawFarmProp(context, item.prop);
    } else if (item.kind === "building") {
      drawBuilding(context, input, item.building, spriteOptions);
    }
  }
}

function drawBuilding(
  context: CanvasRenderingContext2D,
  input: ObjectRenderInput,
  building: Building,
  spriteOptions: WorldSpriteOptions,
): void {
  if ((input.viewMode ?? "normal") === "normal" && input.hoveredTile !== null && input.hoveredTile !== undefined && outlinesOccludingBuilding({
    state: input.state, building, houseLevel: buildBuildingVisualState(building, input.state.houses).houseLevel,
    hoveredTile: input.hoveredTile, selectionMode: input.selectionMode ?? false, camera: input.camera, dpr: input.dpr,
  })) {
    drawSelectionOutline(context, building, input.zoom);
    return;
  }
  if ((input.viewMode ?? "normal") === "outlines") {
    if (building.kind === "house" && building.houseLot !== undefined) {
      const level = buildBuildingVisualState(building, input.state.houses).houseLevel;
      drawWithAlpha(context, OBJECT_OUTLINE_ALPHA, () => drawHouseCompound(context, building, level, "blocks", true));
    } else drawBuildingSilhouette(context, building, input.zoom);
    return;
  }
  // Curved ground (C1d): the contact shadow sits directly under the body, drawn here rather than baked into the ground.
  if (boundaryV2Enabled()) drawBuildingContactShadowV2(context, building);
  drawBuildingDetail(context, input, building, spriteOptions);
  if (renderDetailLevel(input.zoom) === "full") drawBuildingOverlays(context, input.state, building); // INSTALL-7 snow, boards, piles
}

function drawBuildingDetail(
  context: CanvasRenderingContext2D,
  input: ObjectRenderInput,
  building: Building,
  spriteOptions: WorldSpriteOptions,
): void {
  const center = buildingCenter(building);
  const visualState = buildBuildingVisualState(building, input.state.houses, {
    era: houseMaterialEraFromEra(input.state.era),
    wave: input.houseMaterialWave ?? null,
    nowMs: input.nowMs ?? 0,
  });
  const detailLevel = renderDetailLevel(input.zoom);
  // The 2x2 wheat farm is retired (C1c-2: v9 -> v10 saves turn farms into arable fields and a farmstead; C1f: its art
  // left the runtime). Only an unmigrated test state can still hold one, and it draws nothing.
  if (building.kind === "wheat_farm") return;
  if (building.kind === "house" && building.houseLot !== undefined) {
    if (detailLevel !== "full" || !drawHouseCompoundSprite(context, building, visualState.houseLevel)) {
      drawHouseCompound(context, building, visualState.houseLevel, detailLevel);
    } else drawHouseCondition(context, building, visualState.houseLevel, visualState.houseCondition);
    if (detailLevel === "full") drawHouseRoofSmoke(context, input.state, building, visualState.houseLevel, smokeClockMs(input.state.tick));
    drawKindDetail(context, { hideProblemMarker: true, architecture: "baked", tick: input.state.tick, center, kind: building.kind, zoom: input.zoom, visualState });
    return;
  }
  if (detailLevel === "full" && building.kind === "farmstead" && drawFarmsteadSprite(context, building, input.state, spriteOptions)) {
    drawKindDetail(context, { hideProblemMarker: true, architecture: "baked", tick: input.state.tick, center, kind: building.kind, zoom: input.zoom, visualState });
    return;
  }
  if (detailLevel === "full") {
    const historical = building.kind === "house"
      ? drawHistoricalHouse(context, building, visualState.houseLevel)
      : drawHistoricalFacility(context, building, input.state);
    if (historical) {
      if (building.kind === "house") drawHouseCondition(context, building, visualState.houseLevel, visualState.houseCondition);
      // F0-V: roof smoke of a lived-in house, the mill oven's smoke while it runs.
      if (building.kind === "house") drawHouseRoofSmoke(context, input.state, building, visualState.houseLevel, smokeClockMs(input.state.tick));
      if (building.kind === "mill") drawMillOvenSmoke(context, building, smokeClockMs(input.state.tick));
      drawKindDetail(context, { hideProblemMarker: true, architecture: "baked", tick: input.state.tick, center,
        kind: building.kind, zoom: input.zoom, visualState });
      return;
    }
    const spriteKey = buildingSpriteKey(building, visualState.houseLevel);
    const spriteDrawn = drawBuildingSprite(context, building, spriteKey, spriteOptions);
    if (spriteDrawn) {
      drawKindDetail(context, { hideProblemMarker: true,
        architecture: spriteMeta(spriteKey)?.bakedArchitecture === true ? "baked" : "procedural",
        tick: input.state.tick,
        center,
        kind: building.kind,
        zoom: input.zoom,
        visualState,
      });
      return;
    }
  }
  const shape = {
    center,
    building,
    houseLevel: visualState.houseLevel,
    houseMaterialEra: visualState.houseMaterialEra,
    zoom: input.zoom,
  };
  if (detailLevel === "blocks") {
    drawLodBlock(context, shape);
    return;
  }
  drawBody(context, shape);
  drawRoof(context, shape);
  if (detailLevel === "full") {
    drawKindDetail(context, { hideProblemMarker: true,
      tick: input.state.tick,
      center,
      kind: building.kind,
      zoom: input.zoom,
      visualState,
    });
  }
}

function drawBuildingSilhouette(
  context: CanvasRenderingContext2D,
  building: Building,
  zoom: number,
): void {
  const config = buildingFootprint(building);
  const rear = tileToScreen(building.tx, building.ty);
  const front = tileToScreen(building.tx + config.width - 1, building.ty + config.height - 1);
  context.fillStyle = PALETTE.ink;
  context.beginPath();
  context.moveTo(snapToPixel(rear.sx), snapToPixel(rear.sy - 22));
  context.lineTo(snapToPixel(front.sx + 28), snapToPixel(front.sy - 8));
  context.lineTo(snapToPixel(front.sx), snapToPixel(front.sy + 16));
  context.lineTo(snapToPixel(rear.sx - 28), snapToPixel(rear.sy + 2));
  context.closePath();
  drawWithAlpha(context, OBJECT_OUTLINE_ALPHA, () => {
    context.fill();
    applyInkOutline(context, zoom);
    context.stroke();
  });
}

function drawWithAlpha(
  context: CanvasRenderingContext2D,
  alpha: number,
  draw: () => void,
): void {
  const previousAlpha = context.globalAlpha;
  context.save();
  context.globalAlpha = previousAlpha * alpha;
  draw();
  context.globalAlpha = previousAlpha;
  context.restore();
}

function buildingCenter(building: Building): Point {
  const config = buildingFootprint(building);
  const center = tileToScreen(building.tx + (config.width - 1) / 2, building.ty + (config.height - 1) / 2);
  return { x: center.sx, y: center.sy };
}

function drawSelectionOutline(context: CanvasRenderingContext2D, building: Building, zoom: number): void {
  const size = buildingFootprint(building);
  const points = [[building.tx - 0.5, building.ty - 0.5], [building.tx + size.width - 0.5, building.ty - 0.5],
    [building.tx + size.width - 0.5, building.ty + size.height - 0.5], [building.tx - 0.5, building.ty + size.height - 0.5]];
  context.save();
  context.beginPath();
  points.forEach(([tx, ty], index) => {
    if (tx === undefined || ty === undefined) return;
    const point = tileToScreen(tx, ty);
    if (index === 0) context.moveTo(point.sx, point.sy); else context.lineTo(point.sx, point.sy);
  });
  context.closePath();
  applyInkOutline(context, zoom);
  context.stroke();
  context.restore();
}
