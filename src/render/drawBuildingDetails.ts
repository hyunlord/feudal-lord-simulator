import type { BuildingKind } from "../content/buildingConfig";
import { PALETTE, SEMANTIC_PALETTE } from "../content/palette";
import type { BuildingVisualState } from "./buildingVisualState";
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

type ProblemMarkerKind = "water" | "bread" | "labour" | "storage";

export type BuildingDetailInput = {
  readonly tick: number;
  readonly center: Point;
  readonly kind: BuildingKind;
  readonly zoom: number;
  readonly visualState: BuildingVisualState;
};

export function drawKindDetail(
  context: CanvasRenderingContext2D,
  input: BuildingDetailInput,
): void {
  drawBaseKindDetail(context, input);
  const marker = problemMarkerKind(input);
  if (marker !== null) {
    drawProblemMarker(context, {
      center: input.center,
      kind: marker,
      pulse: markerPulse(input.tick),
      zoom: input.zoom,
    });
  }
}

function drawBaseKindDetail(
  context: CanvasRenderingContext2D,
  input: BuildingDetailInput,
): void {
  switch (input.kind) {
    case "house":
      drawHouseDetails(context, input);
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
    case "chapel":
      drawFlag(context, input.tick, input.center, input.zoom);
      return;
    case "wheat_farm":
      drawFieldRows(context, input.center, input.zoom);
      return;
    case "mill":
      drawWheel(context, input.tick, input.center, input.zoom);
      if (input.visualState.production === "working") {
        drawFlag(context, input.tick, input.center, input.zoom);
      }
      return;
    case "logging_camp":
      drawLoggingRack(context, input.center, input.zoom);
      return;
    case "sawmill":
      drawSaw(context, input.tick, input.center, input.zoom);
      drawPlanks(context, input.center, input.zoom);
      return;
    case "quarry":
    case "masonry":
    case "market":
      drawCrates(context, input.center, input.zoom);
      return;
  }
}

function drawHouseDetails(
  context: CanvasRenderingContext2D,
  input: BuildingDetailInput,
): void {
  drawDoor(context, input.center, input.zoom);
  if (input.visualState.houseLevel >= 2) {
    context.fillStyle = SEMANTIC_PALETTE.water;
    for (const offset of [-15, 0, 15]) {
      fillOutlinedRect(context, {
        origin: { x: input.center.x + offset - 3, y: input.center.y - 28 },
        width: 6,
        height: 7,
        zoom: input.zoom,
      });
    }
  }
  if (input.visualState.houseLevel >= 3) {
    context.fillStyle = SEMANTIC_PALETTE.stone;
    fillOutlinedRect(context, {
      origin: { x: input.center.x + 12, y: input.center.y - 68 },
      width: 14,
      height: 30,
      zoom: input.zoom,
    });
  }
}

function problemMarkerKind(input: BuildingDetailInput): ProblemMarkerKind | null {
  if (input.visualState.houseProblem !== null) return input.visualState.houseProblem;
  switch (input.visualState.production) {
    case "no_workers":
      return "labour";
    case "storage_full":
      return "storage";
    case "no_input":
      return input.kind === "mill" ? "bread" : null;
    case "idle":
    case "working":
      return null;
  }
}

function markerPulse(tick: number): number {
  return 1 + Math.sin(tick * 0.18) * 0.18;
}

function drawProblemMarker(
  context: CanvasRenderingContext2D,
  input: {
    readonly center: Point;
    readonly kind: ProblemMarkerKind;
    readonly pulse: number;
    readonly zoom: number;
  },
): void {
  const markerCenter = {
    x: input.center.x + 16,
    y: input.center.y - 39,
  };
  context.fillStyle = PALETTE.vermilion;
  if (input.kind === "water") {
    traceWaterDrop(context, markerCenter, input.pulse);
  } else if (input.kind === "bread") {
    traceBreadLoaf(context, markerCenter, input.pulse);
  } else if (input.kind === "labour") {
    traceWorkerFigure(context, markerCenter, input.pulse);
  } else {
    traceFullCrate(context, markerCenter, input.pulse);
  }
  applyInkOutline(context, input.zoom);
  context.stroke();
}

function traceWaterDrop(context: CanvasRenderingContext2D, center: Point, pulse: number): void {
  const width = 7 * pulse;
  const height = 14 * pulse;
  context.beginPath();
  context.moveTo(snapToPixel(center.x), snapToPixel(center.y - height));
  context.lineTo(snapToPixel(center.x + width), snapToPixel(center.y - 2 * pulse));
  context.arc(snapToPixel(center.x), snapToPixel(center.y), snapToPixel(width), 0, Math.PI);
  context.lineTo(snapToPixel(center.x - width), snapToPixel(center.y - 2 * pulse));
  context.closePath();
  context.fill();
}

function traceBreadLoaf(context: CanvasRenderingContext2D, center: Point, pulse: number): void {
  context.beginPath();
  context.ellipse(
    snapToPixel(center.x),
    snapToPixel(center.y),
    snapToPixel(10 * pulse),
    snapToPixel(7 * pulse),
    0,
    0,
    Math.PI * 2,
  );
  context.fill();
  applyInkOutline(context, 1);
  context.stroke();
  context.fillStyle = SEMANTIC_PALETTE.gold;
  for (const offset of [-4, 0, 4]) {
    fillOutlinedRect(context, {
      origin: { x: center.x + offset * pulse - pulse, y: center.y - 3 * pulse },
      width: 2 * pulse,
      height: 6 * pulse,
      zoom: 1,
    });
  }
  context.fillStyle = PALETTE.vermilion;
}

function traceWorkerFigure(context: CanvasRenderingContext2D, center: Point, pulse: number): void {
  context.beginPath();
  context.arc(
    snapToPixel(center.x),
    snapToPixel(center.y - 4 * pulse),
    snapToPixel(5 * pulse),
    0,
    Math.PI * 2,
  );
  context.fill();
  fillOutlinedRect(context, {
    origin: { x: center.x - 4 * pulse, y: center.y + 1 * pulse },
    width: 8 * pulse,
    height: 10 * pulse,
    zoom: 1,
  });
}

function traceFullCrate(context: CanvasRenderingContext2D, center: Point, pulse: number): void {
  const half = 8 * pulse;
  context.beginPath();
  context.moveTo(snapToPixel(center.x - half), snapToPixel(center.y - half));
  context.lineTo(snapToPixel(center.x + half), snapToPixel(center.y - half));
  context.lineTo(snapToPixel(center.x + half), snapToPixel(center.y + half));
  context.lineTo(snapToPixel(center.x - half), snapToPixel(center.y + half));
  context.closePath();
  context.fill();
  applyInkOutline(context, 1);
  context.stroke();
  context.beginPath();
  context.moveTo(snapToPixel(center.x - half), snapToPixel(center.y - half));
  context.lineTo(snapToPixel(center.x + half), snapToPixel(center.y + half));
  context.moveTo(snapToPixel(center.x + half), snapToPixel(center.y - half));
  context.lineTo(snapToPixel(center.x - half), snapToPixel(center.y + half));
  context.stroke();
}

function drawDoor(context: CanvasRenderingContext2D, center: Point, zoom: number): void {
  context.fillStyle = SEMANTIC_PALETTE.inkLight;
  fillOutlinedRect(context, { origin: { x: center.x - 5, y: center.y - 15 }, width: 10, height: 15, zoom });
}

function drawWellRim(context: CanvasRenderingContext2D, center: Point, zoom: number): void {
  context.fillStyle = shade(SEMANTIC_PALETTE.stone, 0.8);
  context.beginPath();
  context.arc(snapToPixel(center.x), snapToPixel(center.y - 12), 12, 0, Math.PI * 2);
  context.fill();
  applyInkOutline(context, zoom);
  context.stroke();
  context.fillStyle = SEMANTIC_PALETTE.inkLight;
  context.beginPath();
  context.arc(snapToPixel(center.x), snapToPixel(center.y - 12), 6, 0, Math.PI * 2);
  context.fill();
}

function drawCrates(context: CanvasRenderingContext2D, center: Point, zoom: number): void {
  context.fillStyle = SEMANTIC_PALETTE.goldDark;
  fillOutlinedRect(context, { origin: { x: center.x - 18, y: center.y - 40 }, width: 12, height: 10, zoom });
  fillOutlinedRect(context, { origin: { x: center.x - 4, y: center.y - 36 }, width: 12, height: 10, zoom });
  fillOutlinedRect(context, { origin: { x: center.x + 10, y: center.y - 40 }, width: 12, height: 10, zoom });
}

function drawStilts(context: CanvasRenderingContext2D, center: Point, zoom: number): void {
  context.fillStyle = SEMANTIC_PALETTE.earthDark;
  fillOutlinedRect(context, { origin: { x: center.x - 18, y: center.y - 6 }, width: 5, height: 16, zoom });
  fillOutlinedRect(context, { origin: { x: center.x + 13, y: center.y - 6 }, width: 5, height: 16, zoom });
}

function drawFieldRows(context: CanvasRenderingContext2D, center: Point, zoom: number): void {
  context.fillStyle = PALETTE.gold;
  for (let row = 0; row < 3; row += 1) {
    fillOutlinedRect(context, { origin: { x: center.x - 26, y: center.y - 8 + row * 7 }, width: 52, height: 3, zoom });
  }
  context.fillStyle = SEMANTIC_PALETTE.parchmentDark;
  fillOutlinedRect(context, { origin: { x: center.x + 20, y: center.y - 22 }, width: 14, height: 12, zoom });
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
    { x: center.x + 18, y: center.y - 55 + sway },
    { x: center.x, y: center.y - 48 },
  ]);
  context.fill();
  applyInkOutline(context, zoom);
  context.stroke();
}

function drawWheel(context: CanvasRenderingContext2D, tick: number, center: Point, zoom: number): void {
  const turn = ambientOffset({
    tick,
    amplitude: 3,
    frequency: 1.4,
    phase: objectPhase("wheel", center.x, center.y),
  });
  context.fillStyle = SEMANTIC_PALETTE.stoneDark;
  context.beginPath();
  context.arc(snapToPixel(center.x + 24), snapToPixel(center.y - 24), snapToPixel(11), 0, Math.PI * 2);
  context.fill();
  applyInkOutline(context, zoom);
  context.stroke();
  context.fillStyle = SEMANTIC_PALETTE.water;
  fillOutlinedRect(context, { origin: { x: center.x + 22 + turn, y: center.y - 35 }, width: 4, height: 22, zoom });
  fillOutlinedRect(context, { origin: { x: center.x + 13, y: center.y - 26 - turn }, width: 22, height: 4, zoom });
}

function drawLoggingRack(context: CanvasRenderingContext2D, center: Point, zoom: number): void {
  context.fillStyle = SEMANTIC_PALETTE.earth;
  fillOutlinedRect(context, { origin: { x: center.x - 27, y: center.y - 30 }, width: 54, height: 4, zoom });
  fillOutlinedRect(context, { origin: { x: center.x - 24, y: center.y - 27 }, width: 4, height: 24, zoom });
  fillOutlinedRect(context, { origin: { x: center.x + 20, y: center.y - 27 }, width: 4, height: 24, zoom });
  context.fillStyle = SEMANTIC_PALETTE.earthDark;
  fillOutlinedRect(context, { origin: { x: center.x - 20, y: center.y - 10 }, width: 40, height: 5, zoom });
  fillOutlinedRect(context, { origin: { x: center.x - 16, y: center.y - 4 }, width: 32, height: 5, zoom });
  context.fillStyle = SEMANTIC_PALETTE.goldDark;
  for (const end of [{ x: 20, y: -8 }, { x: 16, y: -2 }]) {
    context.beginPath();
    context.arc(snapToPixel(center.x + end.x), snapToPixel(center.y + end.y), 3, 0, Math.PI * 2);
    context.fill();
    applyInkOutline(context, zoom);
    context.stroke();
  }
}

function drawPlanks(context: CanvasRenderingContext2D, center: Point, zoom: number): void {
  context.fillStyle = SEMANTIC_PALETTE.earth;
  fillOutlinedRect(context, { origin: { x: center.x + 12, y: center.y - 8 }, width: 28, height: 4, zoom });
  fillOutlinedRect(context, { origin: { x: center.x + 16, y: center.y - 2 }, width: 24, height: 4, zoom });
}

function drawSaw(context: CanvasRenderingContext2D, tick: number, center: Point, zoom: number): void {
  const travel = ambientOffset({
    tick,
    amplitude: 4,
    frequency: 1.2,
    phase: objectPhase("saw", center.x, center.y),
  });
  context.fillStyle = SEMANTIC_PALETTE.stoneDark;
  traceTriangle(context, [
    { x: center.x - 18 + travel, y: center.y - 12 },
    { x: center.x + 18 + travel, y: center.y - 12 },
    { x: center.x + travel, y: center.y - 28 },
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
