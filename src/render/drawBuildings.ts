import type { GameState } from "../engine/engine.types";
import { BUILDING_CONFIG_BY_KIND } from "../content/buildingConfig";
import type { Building } from "../economy/economy.types";
import { PALETTE } from "../content/palette";
import type { Tile } from "../world/world.types";
import type { TileCoordinate } from "../world/grid";
import type { CameraState } from "./camera";
import { tileToScreen } from "./iso";
import { drawKindDetail } from "./drawBuildingDetails";
import { buildBuildingVisualState, renderDetailLevel } from "./buildingVisualState";
import { houseMaterialEraFromEra, type HouseMaterialWave } from "./buildingMaterialWave";
import { buildingSpriteKey, spriteOptionsFor } from "./buildingSprites";
import { buildObjectRenderItems, type WorldObjectRenderItem } from "./objectRenderOrder";
import { drawGroundCoverDescriptor, drawStumpDescriptor, drawTreeDescriptor } from "./drawTrees";
import { drawStartingLandmark } from "./drawStartingLandmarks";
import { drawWalker } from "./drawWalkers";
import type { TileRange, ViewportSize } from "./renderer";
import { drawWorldSprite, type WorldSpriteOptions } from "./worldSprite";
import { drawBody, drawLodBlock, drawRoof } from "./buildingFallbackShapes";
import { applyInkOutline, snapToPixel } from "./style";
import type { ObjectRenderViewMode } from "./objectRenderViewMode";
import {
  buildingSpriteOverlapsCursorTile,
  denseBuildingClusterIds,
  normalBuildingAlpha,
  OBJECT_OUTLINE_ALPHA,
} from "./occlusionModel";

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
  readonly viewMode?: ObjectRenderViewMode;
  readonly denseBuildingIds?: ReadonlySet<string>;
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
  const denseIds = input.denseBuildingIds ?? denseBuildingClusterIds(input.state.buildings);
  for (const item of items) {
    if (item.kind === "starting_landmark") {
      drawStartingLandmark(context, item.landmark, input.zoom);
    } else if (item.kind === "tree") {
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
      drawWalker(context, item.walker, input.zoom, input.viewMode ?? "normal");
    } else if (item.kind === "building") {
      drawBuilding(context, input, item.building, spriteOptions, denseIds);
    }
  }
}

function drawBuilding(
  context: CanvasRenderingContext2D,
  input: ObjectRenderInput,
  building: Building,
  spriteOptions: WorldSpriteOptions,
  denseBuildingIds: ReadonlySet<string>,
): void {
  if ((input.viewMode ?? "normal") === "outlines") {
    drawBuildingSilhouette(context, building, input.zoom);
    return;
  }
  const visualState = buildBuildingVisualState(building, input.state.houses, {
    era: houseMaterialEraFromEra(input.state.era),
    wave: input.houseMaterialWave ?? null,
    nowMs: input.nowMs ?? 0,
  });
  const alpha = normalBuildingAlpha({
    cursorOverlaps: input.hoveredTile !== undefined && input.hoveredTile !== null && buildingSpriteOverlapsCursorTile({
      building,
      houseLevel: visualState.houseLevel,
      hoveredTile: input.hoveredTile,
      camera: input.camera,
      dpr: input.dpr,
    }),
    dense: denseBuildingIds.has(building.id),
  });
  if (alpha !== 1) {
    drawWithAlpha(context, alpha, () => {
      drawBuildingDetail(context, input, building, spriteOptions);
    });
    return;
  }
  drawBuildingDetail(context, input, building, spriteOptions);
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
  if (detailLevel === "full") {
    const spriteDrawn = drawWorldSprite(context, buildingSpriteKey(building, visualState.houseLevel), building.tx, building.ty, spriteOptions);
    if (spriteDrawn) {
      drawKindDetail(context, {
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
    drawKindDetail(context, {
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
  const config = BUILDING_CONFIG_BY_KIND[building.kind];
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
  const config = BUILDING_CONFIG_BY_KIND[building.kind];
  const center = tileToScreen(building.tx + (config.width - 1) / 2, building.ty + (config.height - 1) / 2);
  return { x: center.sx, y: center.sy };
}
