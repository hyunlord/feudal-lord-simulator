import type { GameState } from "../engine/engine.types";
import { BUILDING_CONFIG_BY_KIND } from "../content/buildingConfig";
import { PALETTE } from "../content/palette";
import type { Building } from "../economy/economy.types";
import type { Tile } from "../world/world.types";
import { TILE_H, TILE_W, tileToScreen } from "./iso";
import { drawKindDetail } from "./drawBuildingDetails";
import {
  buildBuildingVisualState,
  buildingBodyProfile,
  type BodyProfile,
} from "./buildingVisualState";
import { ambientOffset } from "./renderMotion";
import { buildObjectRenderItems } from "./objectRenderOrder";
import { buildForestLookup, buildTreeCluster, type ForestLookup, type TreeDescriptor } from "./treeLayout";
import type { TileRange } from "./renderer";
import { applyInkOutline, drawFlatDiamondShadow, shade, snapToPixel } from "./style";

type ObjectRenderInput = {
  readonly state: GameState;
  readonly tiles: readonly Tile[];
  readonly range: TileRange;
  readonly zoom: number;
};

type Point = {
  readonly x: number;
  readonly y: number;
};

type BuildingShapeInput = {
  readonly center: Point;
  readonly building: Building;
  readonly houseLevel: number;
  readonly zoom: number;
};

export function drawBuildings(
  context: CanvasRenderingContext2D,
  input: ObjectRenderInput,
): void {
  const items = buildObjectRenderItems({
    tiles: input.tiles,
    buildings: input.state.buildings,
    range: input.range,
  });
  const forestLookup = buildForestLookup(input.state.tiles);
  for (const item of items) {
    if (item.kind === "tree") {
      drawTreeCluster(context, input.state.tick, item.tile, forestLookup, input.state.seed, input.zoom);
    } else {
      drawBuilding(context, input, item.building);
    }
  }
}

function drawTreeCluster(
  context: CanvasRenderingContext2D,
  tick: number,
  tile: Tile,
  forestLookup: ForestLookup,
  seed: number,
  zoom: number,
): void {
  for (const tree of buildTreeCluster({ tile, forestLookup, seed })) {
    drawTree(context, tick, tree, zoom);
  }
}

function drawTree(context: CanvasRenderingContext2D, tick: number, tree: TreeDescriptor, zoom: number): void {
  const sway = ambientOffset({
    tick,
    amplitude: 2 * tree.scale,
    frequency: 0.72,
    phase: tree.phase,
  });
  drawFlatDiamondShadow(context, {
    centerX: tree.x,
    centerY: tree.y + 7 * tree.scale,
    radiusX: 13 * tree.scale,
    radiusY: 5 * tree.scale,
  });
  context.fillStyle = PALETTE.earthDark;
  traceRect(
    context,
    { x: tree.x - 2 * tree.scale, y: tree.y - 20 * tree.scale },
    4 * tree.scale,
    24 * tree.scale,
  );
  context.fill();
  applyInkOutline(context, zoom);
  context.stroke();
  context.fillStyle = PALETTE[tree.tone];
  traceTreeCanopy(context, tree, sway);
  context.fill();
  applyInkOutline(context, zoom);
  context.stroke();
}

function traceTreeCanopy(context: CanvasRenderingContext2D, tree: TreeDescriptor, sway: number): void {
  if (tree.silhouette === "rounded") {
    context.beginPath();
    context.ellipse(
      snapToPixel(tree.x + sway),
      snapToPixel(tree.y - 28 * tree.scale),
      17 * tree.scale,
      14 * tree.scale,
      0,
      0,
      Math.PI * 2,
    );
    return;
  }
  const width = tree.silhouette === "broad" ? 19 : 13;
  const lift = 42;
  const baseLift = tree.silhouette === "narrow" ? 10 : 12;
  traceTriangle(context, [
    { x: tree.x + sway, y: tree.y - lift * tree.scale },
    { x: tree.x + width * tree.scale + sway, y: tree.y - baseLift * tree.scale },
    { x: tree.x - width * tree.scale + sway, y: tree.y - baseLift * tree.scale },
  ]);
}

function drawBuilding(
  context: CanvasRenderingContext2D,
  input: ObjectRenderInput,
  building: Building,
): void {
  const center = buildingCenter(building);
  const config = BUILDING_CONFIG_BY_KIND[building.kind];
  const visualState = buildBuildingVisualState(building, input.state.houses);
  drawFlatDiamondShadow(context, {
    centerX: center.x,
    centerY: center.y + 10,
    radiusX: config.width * TILE_W * 0.34,
    radiusY: config.height * TILE_H * 0.28,
  });
  const shape = {
    center,
    building,
    houseLevel: visualState.houseLevel,
    zoom: input.zoom,
  };
  drawBody(context, shape);
  drawRoof(context, shape);
  drawKindDetail(context, {
    tick: input.state.tick,
    center,
    kind: building.kind,
    zoom: input.zoom,
    visualState,
  });
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
  } else {
    const peakLift = body.roofShape === "tower" ? body.roof + 12 : body.roof;
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
