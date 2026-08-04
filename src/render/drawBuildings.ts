import type { GameState } from "../engine/engine.types";
import type { BuildingKind } from "../content/buildingConfig";
import { BUILDING_CONFIG_BY_KIND } from "../content/buildingConfig";
import { PALETTE, type PaletteColor } from "../content/palette";
import type { Building } from "../economy/economy.types";
import type { Tile } from "../world/world.types";
import { TILE_H, TILE_W, tileToScreen } from "./iso";
import { drawKindDetail } from "./drawBuildingDetails";
import { ambientOffset, objectPhase } from "./renderMotion";
import { buildObjectRenderItems } from "./objectRenderOrder";
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

type RoofShape = "none" | "triangle" | "flat" | "shed" | "tower";

type BodyProfile = {
  readonly width: number;
  readonly height: number;
  readonly roof: number;
  readonly fill: PaletteColor;
  readonly roofColor: PaletteColor;
  readonly roofShape: RoofShape;
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
  for (const item of items) {
    if (item.kind === "tree") {
      drawTree(context, input.state.tick, item.tile, input.zoom);
    } else {
      drawBuilding(context, input.state.tick, item.building, input.zoom);
    }
  }
}

function drawTree(context: CanvasRenderingContext2D, tick: number, tile: Tile, zoom: number): void {
  const base = tileCenter(tile.tx, tile.ty);
  const sway = ambientOffset({
    tick,
    amplitude: 2,
    frequency: 0.72,
    phase: objectPhase("tree", tile.tx, tile.ty),
  });
  drawFlatDiamondShadow(context, {
    centerX: base.x,
    centerY: base.y + 7,
    radiusX: 13,
    radiusY: 5,
  });
  context.fillStyle = PALETTE.earthDark;
  traceRect(context, { x: base.x - 2, y: base.y - 20 }, 4, 24);
  context.fill();
  applyInkOutline(context, zoom);
  context.stroke();
  context.fillStyle = PALETTE.forest;
  traceTriangle(context, [
    { x: base.x + sway, y: base.y - 42 },
    { x: base.x + 16 + sway, y: base.y - 11 },
    { x: base.x - 16 + sway, y: base.y - 11 },
  ]);
  context.fill();
  applyInkOutline(context, zoom);
  context.stroke();
}

function drawBuilding(context: CanvasRenderingContext2D, tick: number, building: Building, zoom: number): void {
  const center = buildingCenter(building);
  const config = BUILDING_CONFIG_BY_KIND[building.kind];
  drawFlatDiamondShadow(context, {
    centerX: center.x,
    centerY: center.y + 10,
    radiusX: config.width * TILE_W * 0.34,
    radiusY: config.height * TILE_H * 0.28,
  });
  drawBody(context, center, building.kind, zoom);
  drawRoof(context, center, building.kind, zoom);
  drawKindDetail(context, { tick, center, kind: building.kind, zoom });
}

function drawBody(context: CanvasRenderingContext2D, center: Point, kind: BuildingKind, zoom: number): void {
  const body = buildingBody(kind);
  const origin = { x: center.x - body.width / 2, y: center.y - body.height };
  context.fillStyle = body.fill;
  traceIsoFace(context, origin, body.width, body.height, "front");
  context.fill();
  applyInkOutline(context, zoom);
  context.stroke();
  context.fillStyle = shade(body.fill, 0.92);
  traceIsoFace(context, origin, body.width, body.height, "left");
  context.fill();
  applyInkOutline(context, zoom);
  context.stroke();
  context.fillStyle = shade(body.fill, 0.8);
  traceIsoFace(context, origin, body.width, body.height, "right");
  context.fill();
  applyInkOutline(context, zoom);
  context.stroke();
}

function drawRoof(context: CanvasRenderingContext2D, center: Point, kind: BuildingKind, zoom: number): void {
  const body = buildingBody(kind);
  if (body.roofShape === "none") {
    return;
  }
  context.fillStyle = body.roofColor;
  if (body.roofShape === "flat") {
    traceRect(context, { x: center.x - body.width / 2 - 4, y: center.y - body.height - 4 }, body.width + 8, 8);
  } else if (body.roofShape === "shed") {
    traceShedRoof(context, center, body);
  } else {
    const peakLift = body.roofShape === "tower" ? body.roof + 12 : body.roof;
    traceTriangle(context, [
      { x: center.x, y: center.y - body.height - peakLift },
      { x: center.x + body.width / 2 + 5, y: center.y - body.height + 5 },
      { x: center.x - body.width / 2 - 5, y: center.y - body.height + 5 },
    ]);
  }
  context.fill();
  applyInkOutline(context, zoom);
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

function tileCenter(tx: number, ty: number): Point {
  const center = tileToScreen(tx, ty);
  return { x: center.sx, y: center.sy };
}

function buildingCenter(building: Building): Point {
  const config = BUILDING_CONFIG_BY_KIND[building.kind];
  const center = tileToScreen(building.tx + (config.width - 1) / 2, building.ty + (config.height - 1) / 2);
  return { x: center.sx, y: center.sy };
}

function buildingBody(kind: BuildingKind): BodyProfile {
  switch (kind) {
    case "house":
      return { width: 30, height: 30, roof: 15, fill: PALETTE.parchmentDark, roofColor: PALETTE.earth, roofShape: "triangle" };
    case "well":
      return { width: 24, height: 16, roof: 0, fill: PALETTE.stone, roofColor: PALETTE.stoneDark, roofShape: "none" };
    case "storehouse":
      return { width: 60, height: 34, roof: 8, fill: PALETTE.parchmentDark, roofColor: PALETTE.earthDark, roofShape: "flat" };
    case "granary":
      return { width: 52, height: 40, roof: 14, fill: PALETTE.parchment, roofColor: PALETTE.goldDark, roofShape: "shed" };
    case "wheat_farm":
      return { width: 68, height: 14, roof: 0, fill: PALETTE.sageDark, roofColor: PALETTE.gold, roofShape: "none" };
    case "mill":
      return { width: 54, height: 58, roof: 20, fill: PALETTE.parchmentDark, roofColor: PALETTE.earthDark, roofShape: "tower" };
    case "logging_camp":
      return { width: 34, height: 22, roof: 10, fill: PALETTE.earth, roofColor: PALETTE.forest, roofShape: "shed" };
    case "sawmill":
      return { width: 62, height: 48, roof: 14, fill: PALETTE.parchmentDark, roofColor: PALETTE.earthDark, roofShape: "flat" };
  }
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
