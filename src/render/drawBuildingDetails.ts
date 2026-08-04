import type { BuildingKind } from "../content/buildingConfig";
import { PALETTE } from "../content/palette";
import { ambientOffset, objectPhase } from "./renderMotion";
import { applyInkOutline, shade, snapToPixel } from "./style";

type Point = {
  readonly x: number;
  readonly y: number;
};

type RectShape = {
  readonly origin: Point;
  readonly width: number;
  readonly height: number;
  readonly zoom: number;
};

export type BuildingDetailInput = {
  readonly tick: number;
  readonly center: Point;
  readonly kind: BuildingKind;
  readonly zoom: number;
};

export function drawKindDetail(
  context: CanvasRenderingContext2D,
  input: BuildingDetailInput,
): void {
  switch (input.kind) {
    case "house":
      drawDoor(context, input.center, input.zoom);
      return;
    case "well":
      drawWellRim(context, input.center, input.zoom);
      return;
    case "storehouse":
      drawCrates(context, input.center, input.zoom);
      return;
    case "granary":
      drawStilts(context, input.center, input.zoom);
      return;
    case "wheat_farm":
      drawFieldRows(context, input.center, input.zoom);
      return;
    case "mill":
      drawWheel(context, input.center, input.zoom);
      drawFlag(context, input.tick, input.center, input.zoom);
      return;
    case "logging_camp":
      drawLogs(context, input.center, input.zoom);
      return;
    case "sawmill":
      drawSaw(context, input.center, input.zoom);
      return;
  }
}

function drawDoor(context: CanvasRenderingContext2D, center: Point, zoom: number): void {
  context.fillStyle = PALETTE.inkLight;
  fillOutlinedRect(context, { origin: { x: center.x - 5, y: center.y - 15 }, width: 10, height: 15, zoom });
}

function drawWellRim(context: CanvasRenderingContext2D, center: Point, zoom: number): void {
  context.fillStyle = shade(PALETTE.stone, 0.8);
  fillOutlinedRect(context, { origin: { x: center.x - 12, y: center.y - 23 }, width: 24, height: 10, zoom });
}

function drawCrates(context: CanvasRenderingContext2D, center: Point, zoom: number): void {
  context.fillStyle = PALETTE.goldDark;
  fillOutlinedRect(context, { origin: { x: center.x - 18, y: center.y - 14 }, width: 12, height: 10, zoom });
  fillOutlinedRect(context, { origin: { x: center.x + 6, y: center.y - 14 }, width: 12, height: 10, zoom });
}

function drawStilts(context: CanvasRenderingContext2D, center: Point, zoom: number): void {
  context.fillStyle = PALETTE.earthDark;
  fillOutlinedRect(context, { origin: { x: center.x - 18, y: center.y - 6 }, width: 5, height: 16, zoom });
  fillOutlinedRect(context, { origin: { x: center.x + 13, y: center.y - 6 }, width: 5, height: 16, zoom });
}

function drawFieldRows(context: CanvasRenderingContext2D, center: Point, zoom: number): void {
  context.fillStyle = PALETTE.gold;
  for (let row = 0; row < 3; row += 1) {
    fillOutlinedRect(context, { origin: { x: center.x - 26, y: center.y - 8 + row * 7 }, width: 52, height: 3, zoom });
  }
}

function drawFlag(context: CanvasRenderingContext2D, tick: number, center: Point, zoom: number): void {
  const sway = ambientOffset({
    tick,
    amplitude: 3,
    frequency: 1.1,
    phase: objectPhase("flag", center.x, center.y),
  });
  context.fillStyle = PALETTE.vermilion;
  traceTriangle(context, [
    { x: center.x, y: center.y - 62 },
    { x: center.x + 18 + sway, y: center.y - 55 },
    { x: center.x, y: center.y - 48 },
  ]);
  context.fill();
  applyInkOutline(context, zoom);
  context.stroke();
}

function drawWheel(context: CanvasRenderingContext2D, center: Point, zoom: number): void {
  context.fillStyle = PALETTE.stoneDark;
  context.beginPath();
  context.arc(snapToPixel(center.x + 24), snapToPixel(center.y - 24), snapToPixel(11), 0, Math.PI * 2);
  context.fill();
  applyInkOutline(context, zoom);
  context.stroke();
  context.fillStyle = PALETTE.water;
  fillOutlinedRect(context, { origin: { x: center.x + 22, y: center.y - 35 }, width: 4, height: 22, zoom });
  fillOutlinedRect(context, { origin: { x: center.x + 13, y: center.y - 26 }, width: 22, height: 4, zoom });
}

function drawLogs(context: CanvasRenderingContext2D, center: Point, zoom: number): void {
  context.fillStyle = PALETTE.earthDark;
  fillOutlinedRect(context, { origin: { x: center.x - 20, y: center.y - 10 }, width: 40, height: 5, zoom });
  fillOutlinedRect(context, { origin: { x: center.x - 16, y: center.y - 4 }, width: 32, height: 5, zoom });
}

function drawSaw(context: CanvasRenderingContext2D, center: Point, zoom: number): void {
  context.fillStyle = PALETTE.stoneDark;
  traceTriangle(context, [
    { x: center.x - 18, y: center.y - 12 },
    { x: center.x + 18, y: center.y - 12 },
    { x: center.x, y: center.y - 28 },
  ]);
  context.fill();
  applyInkOutline(context, zoom);
  context.stroke();
}

function fillOutlinedRect(
  context: CanvasRenderingContext2D,
  shape: RectShape,
): void {
  traceRect(context, shape.origin, shape.width, shape.height);
  context.fill();
  applyInkOutline(context, shape.zoom);
  context.stroke();
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
