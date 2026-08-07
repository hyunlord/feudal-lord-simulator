import type { GameState } from "../engine/engine.types";
import { BUILDING_CONFIG_BY_KIND } from "../content/buildingConfig";
import type { Building } from "../economy/economy.types";
import type { Tile } from "../world/world.types";
import type { CameraState } from "./camera";
import { tileToScreen } from "./iso";
import { drawKindDetail } from "./drawBuildingDetails";
import {
  buildBuildingVisualState,
  buildingLodColor,
  buildingBodyProfile,
  renderDetailLevel,
  type BodyProfile,
} from "./buildingVisualState";
import { buildingSpriteKey, spriteOptionsFor } from "./buildingSprites";
import { buildObjectRenderItems, type WorldObjectRenderItem } from "./objectRenderOrder";
import { drawGroundCoverDescriptor, drawTreeDescriptor } from "./drawTrees";
import { drawWalker } from "./drawWalkers";
import type { TileRange, ViewportSize } from "./renderer";
import { applyInkOutline, shade, snapToPixel } from "./style";
import { drawWorldSprite, type WorldSpriteOptions } from "./worldSprite";

type ObjectRenderInput = {
  readonly state: GameState;
  readonly tiles: readonly Tile[];
  readonly range: TileRange;
  readonly zoom: number;
  readonly camera?: CameraState;
  readonly dpr?: number;
  readonly viewport?: ViewportSize;
  readonly objectRenderItems?: readonly WorldObjectRenderItem[];
};

type Point = { readonly x: number; readonly y: number };

type BuildingShapeInput = { readonly center: Point; readonly building: Building; readonly houseLevel: number; readonly zoom: number };

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
  const visualState = buildBuildingVisualState(building, input.state.houses);
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

function drawLodBlock(
  context: CanvasRenderingContext2D,
  input: BuildingShapeInput,
): void {
  const body = buildingBodyProfile(input.building.kind, input.houseLevel);
  const origin = { x: input.center.x - body.width / 2, y: input.center.y - 12 };
  context.fillStyle = buildingLodColor(input.building.kind);
  traceIsoFace(context, origin, body.width, 14, "front");
  context.fill();
  applyInkOutline(context, input.zoom);
  context.stroke();
}

function drawBody(
  context: CanvasRenderingContext2D,
  input: BuildingShapeInput,
): void {
  const body = buildingBodyProfile(input.building.kind, input.houseLevel);
  const origin = { x: input.center.x - body.width / 2, y: input.center.y - body.height };
  context.fillStyle = body.fill;
  traceIsoFace(context, origin, body.width, body.height, "front");
  context.fill();
  applyInkOutline(context, input.zoom);
  context.stroke();
  context.fillStyle = shade(body.fill, 0.92);
  traceIsoFace(context, origin, body.width, body.height, "left");
  context.fill();
  applyInkOutline(context, input.zoom);
  context.stroke();
  context.fillStyle = shade(body.fill, 0.8);
  traceIsoFace(context, origin, body.width, body.height, "right");
  context.fill();
  applyInkOutline(context, input.zoom);
  context.stroke();
}

function drawRoof(
  context: CanvasRenderingContext2D,
  input: BuildingShapeInput,
): void {
  const body = buildingBodyProfile(input.building.kind, input.houseLevel);
  if (body.roofShape === "none") {
    return;
  }
  context.fillStyle = body.roofColor;
  if (body.roofShape === "flat") {
    traceRect(context, { x: input.center.x - body.width / 2 - 4, y: input.center.y - body.height - 4 }, body.width + 8, 8);
  } else if (body.roofShape === "shed") {
    traceShedRoof(context, input.center, body);
  } else if (body.roofShape === "dome") {
    context.beginPath();
    context.ellipse(
      snapToPixel(input.center.x),
      snapToPixel(input.center.y - body.height + 2),
      body.width / 2 + 4,
      body.roof,
      0,
      Math.PI,
      Math.PI * 2,
    );
    context.closePath();
  } else {
    const peakLift = body.roofShape === "tower" ? body.roof + 8 : body.roof;
    traceTriangle(context, [
      { x: input.center.x, y: input.center.y - body.height - peakLift },
      { x: input.center.x + body.width / 2 + 5, y: input.center.y - body.height + 5 },
      { x: input.center.x - body.width / 2 - 5, y: input.center.y - body.height + 5 },
    ]);
  }
  context.fill();
  applyInkOutline(context, input.zoom);
  context.stroke();
}

function traceShedRoof(context: CanvasRenderingContext2D, center: Point, body: BodyProfile): void {
  context.beginPath();
  context.moveTo(snapToPixel(center.x - body.width / 2 - 5), snapToPixel(center.y - body.height + 2));
  context.lineTo(snapToPixel(center.x + body.width / 2 + 6), snapToPixel(center.y - body.height - body.roof));
  context.lineTo(snapToPixel(center.x + body.width / 2 + 8), snapToPixel(center.y - body.height + 4));
  context.lineTo(snapToPixel(center.x - body.width / 2 - 3), snapToPixel(center.y - body.height + body.roof * 0.5));
  context.closePath();
}

function buildingCenter(building: Building): Point {
  const config = BUILDING_CONFIG_BY_KIND[building.kind];
  const center = tileToScreen(building.tx + (config.width - 1) / 2, building.ty + (config.height - 1) / 2);
  return { x: center.sx, y: center.sy };
}

function traceIsoFace(
  context: CanvasRenderingContext2D,
  origin: Point,
  width: number,
  height: number,
  face: "front" | "left" | "right",
): void {
  const inset = height * 0.28;
  context.beginPath();
  if (face === "front") {
    context.moveTo(snapToPixel(origin.x), snapToPixel(origin.y + inset));
    context.lineTo(snapToPixel(origin.x + width), snapToPixel(origin.y + inset));
    context.lineTo(snapToPixel(origin.x + width), snapToPixel(origin.y + height));
    context.lineTo(snapToPixel(origin.x), snapToPixel(origin.y + height));
  } else if (face === "left") {
    context.moveTo(snapToPixel(origin.x), snapToPixel(origin.y + inset));
    context.lineTo(snapToPixel(origin.x + width * 0.18), snapToPixel(origin.y));
    context.lineTo(snapToPixel(origin.x + width * 0.18), snapToPixel(origin.y + height - inset));
    context.lineTo(snapToPixel(origin.x), snapToPixel(origin.y + height));
  } else {
    context.moveTo(snapToPixel(origin.x + width), snapToPixel(origin.y + inset));
    context.lineTo(snapToPixel(origin.x + width * 0.82), snapToPixel(origin.y));
    context.lineTo(snapToPixel(origin.x + width * 0.82), snapToPixel(origin.y + height - inset));
    context.lineTo(snapToPixel(origin.x + width), snapToPixel(origin.y + height));
  }
  context.closePath();
}

function traceRect(context: CanvasRenderingContext2D, origin: Point, width: number, height: number): void {
  context.beginPath();
  context.moveTo(snapToPixel(origin.x), snapToPixel(origin.y));
  context.lineTo(snapToPixel(origin.x + width), snapToPixel(origin.y));
  context.lineTo(snapToPixel(origin.x + width), snapToPixel(origin.y + height));
  context.lineTo(snapToPixel(origin.x), snapToPixel(origin.y + height));
  context.closePath();
}

function traceTriangle(context: CanvasRenderingContext2D, points: readonly [Point, Point, Point]): void {
  context.beginPath();
  context.moveTo(snapToPixel(points[0].x), snapToPixel(points[0].y));
  context.lineTo(snapToPixel(points[1].x), snapToPixel(points[1].y));
  context.lineTo(snapToPixel(points[2].x), snapToPixel(points[2].y));
  context.closePath();
}
