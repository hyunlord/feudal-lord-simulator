import { SEMANTIC_PALETTE } from "../content/palette";
import { applyInkOutline, snapToPixel, withAlpha } from "./style";

export type ConstructionRenderSignature = "plot" | "foundation" | "frame" | "roof";

export type ConstructionBandPoint = {
  readonly x: number;
  readonly y: number;
};

export type ConstructionBandInput = {
  readonly signature: ConstructionRenderSignature;
  readonly anchor: ConstructionBandPoint;
  readonly zoom: number;
  readonly progress: number | null;
};

export function drawConstructionStageBand(
  context: CanvasRenderingContext2D,
  input: ConstructionBandInput,
): void {
  const progress = localStageProgress(input.signature, input.progress);
  switch (input.signature) {
    case "plot":
      drawPlotBand(context, input.anchor, input.zoom, progress);
      return;
    case "foundation":
      drawFoundationBand(context, input.anchor, input.zoom, progress);
      return;
    case "frame":
      drawFrameBand(context, input.anchor, input.zoom, progress);
      return;
    case "roof":
      drawRoofBand(context, input.anchor, input.zoom, progress);
      return;
    default:
      assertNever(input.signature);
  }
}

function drawPlotBand(
  context: CanvasRenderingContext2D,
  anchor: ConstructionBandPoint,
  zoom: number,
  progress: number | null,
): void {
  context.fillStyle = withAlpha(SEMANTIC_PALETTE.sage, 0.32);
  context.beginPath();
  context.moveTo(snapToPixel(anchor.x + 16), snapToPixel(anchor.y));
  context.lineTo(snapToPixel(anchor.x + 52), snapToPixel(anchor.y - 10));
  context.lineTo(snapToPixel(anchor.x + 72), snapToPixel(anchor.y + 5));
  context.lineTo(snapToPixel(anchor.x + 34), snapToPixel(anchor.y + 16));
  context.closePath();
  context.fill();
  applyInkOutline(context, zoom);
  context.stroke();
  context.beginPath();
  context.moveTo(snapToPixel(anchor.x + 56), snapToPixel(anchor.y + 4));
  context.lineTo(snapToPixel(anchor.x + 58), snapToPixel(anchor.y - 8));
  context.stroke();
  drawPlotStakes(context, anchor, zoom);
  context.fillStyle = SEMANTIC_PALETTE.earth;
  context.fillRect(
    snapToPixel(anchor.x + 42 + materialOffset(progress)),
    snapToPixel(anchor.y - 5),
    progress === null ? 16 : snapToPixel(4 + 12 * progress),
    6,
  );
}

function drawPlotStakes(
  context: CanvasRenderingContext2D,
  anchor: ConstructionBandPoint,
  zoom: number,
): void {
  for (const stake of [
    { x: 8, y: -14 },
    { x: 62, y: -12 },
    { x: 68, y: 3 },
    { x: 20, y: 12 },
  ] as const) {
    context.fillStyle = SEMANTIC_PALETTE.earthDark;
    context.fillRect(snapToPixel(anchor.x + stake.x), snapToPixel(anchor.y + stake.y), 3, 18);
  }
  applyInkOutline(context, zoom);
  context.beginPath();
  context.moveTo(snapToPixel(anchor.x + 11), snapToPixel(anchor.y - 12));
  context.lineTo(snapToPixel(anchor.x + 64), snapToPixel(anchor.y - 12));
  context.lineTo(snapToPixel(anchor.x + 96), snapToPixel(anchor.y - 12));
  context.stroke();
}

function drawFoundationBand(
  context: CanvasRenderingContext2D,
  anchor: ConstructionBandPoint,
  zoom: number,
  progress: number | null,
): void {
  context.fillStyle = SEMANTIC_PALETTE.stone;
  context.beginPath();
  context.rect(
    snapToPixel(anchor.x + 1),
    snapToPixel(anchor.y - 4),
    progress === null ? 70 : snapToPixel(16 + 54 * progress),
    12,
  );
  context.fill();
  applyInkOutline(context, zoom);
  context.stroke();
  context.beginPath();
  context.moveTo(snapToPixel(anchor.x + 14), snapToPixel(anchor.y - 8));
  context.lineTo(snapToPixel(anchor.x + 63), snapToPixel(anchor.y - 8));
  context.stroke();
  context.fillStyle = SEMANTIC_PALETTE.stoneDark;
  for (const x of [anchor.x + 5, anchor.x + 34]) {
    context.beginPath();
    context.rect(snapToPixel(x), snapToPixel(anchor.y - 6), 22, 8);
    context.fill();
    applyInkOutline(context, zoom);
    context.stroke();
  }
  context.fillStyle = SEMANTIC_PALETTE.earth;
  context.fillRect(snapToPixel(anchor.x + 59 + materialOffset(progress)), snapToPixel(anchor.y - 12), 12, 10);
}

function drawFrameBand(
  context: CanvasRenderingContext2D,
  anchor: ConstructionBandPoint,
  zoom: number,
  progress: number | null,
): void {
  const postHeight = progress === null ? 40 : snapToPixel(10 + 30 * progress);
  context.fillStyle = SEMANTIC_PALETTE.earthDark;
  for (const x of [anchor.x + 9, anchor.x + 54]) {
    context.beginPath();
    context.rect(snapToPixel(x), snapToPixel(anchor.y + 2 - postHeight), 10, postHeight);
    context.fill();
    applyInkOutline(context, zoom);
    context.stroke();
  }
  context.fillStyle = withAlpha(SEMANTIC_PALETTE.vellum, 0.56);
  context.beginPath();
  const wallHeight = progress === null ? 24 : snapToPixel(4 + 20 * progress);
  context.rect(snapToPixel(anchor.x + 26), snapToPixel(anchor.y - 3 - wallHeight), 20, wallHeight);
  context.fill();
  applyInkOutline(context, zoom);
  context.stroke();
  applyInkOutline(context, zoom);
  context.beginPath();
  context.moveTo(snapToPixel(anchor.x + 2), snapToPixel(anchor.y - 17));
  context.lineTo(snapToPixel(anchor.x + 73), snapToPixel(anchor.y - 29 + scaffoldOffset(progress)));
  context.stroke();
}

function drawRoofBand(
  context: CanvasRenderingContext2D,
  anchor: ConstructionBandPoint,
  zoom: number,
  progress: number | null,
): void {
  context.fillStyle = SEMANTIC_PALETTE.earth;
  context.beginPath();
  context.moveTo(snapToPixel(anchor.x + 4), snapToPixel(anchor.y - 34));
  const roofRise = progress === null ? 24 : 24 * progress;
  context.lineTo(snapToPixel(anchor.x + 37), snapToPixel(anchor.y - 34 - roofRise));
  context.lineTo(snapToPixel(anchor.x + 72), snapToPixel(anchor.y - 33));
  context.closePath();
  context.fill();
  applyInkOutline(context, zoom);
  context.stroke();
  context.fillStyle = SEMANTIC_PALETTE.earthDark;
  for (const x of [anchor.x + 2, anchor.x + 62]) {
    context.beginPath();
    context.rect(snapToPixel(x), snapToPixel(anchor.y - 33), 4, 38);
    context.fill();
    applyInkOutline(context, zoom);
    context.stroke();
  }
  applyInkOutline(context, zoom);
  context.beginPath();
  context.moveTo(snapToPixel(anchor.x + 4), snapToPixel(anchor.y - 18));
  context.lineTo(snapToPixel(anchor.x + 66), snapToPixel(anchor.y - 22 + scaffoldOffset(progress)));
  context.stroke();
}

function materialOffset(progress: number | null): number {
  return progress === null ? 0 : Math.round(progress * 4);
}

function scaffoldOffset(progress: number | null): number {
  return progress === null ? 0 : Math.round(progress * 3);
}

function localStageProgress(
  signature: ConstructionRenderSignature,
  progress: number | null,
): number | null {
  if (progress === null) return null;
  const [start, end] = stageRange(signature);
  return Math.max(0, Math.min(1, (progress - start) / (end - start)));
}

function stageRange(signature: ConstructionRenderSignature): readonly [number, number] {
  switch (signature) {
    case "plot":
      return [0, 0.25];
    case "foundation":
      return [0.25, 0.55];
    case "frame":
      return [0.55, 0.85];
    case "roof":
      return [0.85, 1];
    default:
      return assertNever(signature);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled construction band variant: ${JSON.stringify(value)}`);
}
