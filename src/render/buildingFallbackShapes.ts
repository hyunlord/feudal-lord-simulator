import { buildingBodyProfile, buildingLodColor, type BodyProfile } from "./buildingVisualState";
import type { Building } from "../economy/economy.types";
import { applyInkOutline, shade, snapToPixel } from "./style";
import type { HouseMaterialEra } from "./buildingMaterialWave";

type Point = { readonly x: number; readonly y: number };

type BuildingShapeInput = {
  readonly center: Point;
  readonly building: Building;
  readonly houseLevel: number;
  readonly houseMaterialEra: HouseMaterialEra;
  readonly zoom: number;
};

export function drawLodBlock(
  context: CanvasRenderingContext2D,
  input: BuildingShapeInput,
): void {
  const body = buildingBodyProfile(input.building.kind, input.houseLevel, input.houseMaterialEra);
  const origin = { x: input.center.x - body.width / 2, y: input.center.y - 12 };
  context.fillStyle = buildingLodColor(input.building.kind);
  traceIsoFace(context, origin, body.width, 14, "front");
  context.fill();
  applyInkOutline(context, input.zoom);
  context.stroke();
}

export function drawBody(
  context: CanvasRenderingContext2D,
  input: BuildingShapeInput,
): void {
  const body = buildingBodyProfile(input.building.kind, input.houseLevel, input.houseMaterialEra);
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

export function drawRoof(
  context: CanvasRenderingContext2D,
  input: BuildingShapeInput,
): void {
  const body = buildingBodyProfile(input.building.kind, input.houseLevel, input.houseMaterialEra);
  if (body.roofShape === "none") return;
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
