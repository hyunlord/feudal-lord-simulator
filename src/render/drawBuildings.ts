import type { GameState } from "../engine/engine.types";
import { BUILDING_CONFIG_BY_KIND } from "../content/buildingConfig";
import type { Building } from "../economy/economy.types";
import type { Tile } from "../world/world.types";
import type { CameraState } from "./camera";
import { tileToScreen } from "./iso";
import { drawKindDetail } from "./drawBuildingDetails";
import { buildBuildingVisualState, renderDetailLevel } from "./buildingVisualState";
import type { HouseMaterialWave } from "./buildingMaterialWave";
import { buildingSpriteKey, spriteOptionsFor } from "./buildingSprites";
import { buildObjectRenderItems, type WorldObjectRenderItem } from "./objectRenderOrder";
import { drawGroundCoverDescriptor, drawStumpDescriptor, drawTreeDescriptor } from "./drawTrees";
import { drawStartingLandmark } from "./drawStartingLandmarks";
import { drawWalker } from "./drawWalkers";
import type { TileRange, ViewportSize } from "./renderer";
import { drawWorldSprite, type WorldSpriteOptions } from "./worldSprite";
import { drawBody, drawLodBlock, drawRoof } from "./buildingFallbackShapes";

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
      drawWalker(context, item.walker, input.zoom);
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
  const center = buildingCenter(building);
  const visualState = buildBuildingVisualState(building, input.state.houses, {
    era: input.state.era,
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

function buildingCenter(building: Building): Point {
  const config = BUILDING_CONFIG_BY_KIND[building.kind];
  const center = tileToScreen(building.tx + (config.width - 1) / 2, building.ty + (config.height - 1) / 2);
  return { x: center.sx, y: center.sy };
}
