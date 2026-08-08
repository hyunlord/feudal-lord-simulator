import { PALETTE, SEMANTIC_PALETTE, type PaletteColor } from "../content/palette";
import type { PalisadeSegment } from "../engine/engine.types";
import type { TileEdgePoint } from "../world/palisadeGeometry";
import {
  palisadeScreenPath,
  type PalisadeRenderPath,
} from "./palisadeRenderGeometry";
import { applyInkOutline, applyPaletteStroke, snapToPixel } from "./style";

type DrawPalisadeSegmentInput = {
  readonly segment: PalisadeSegment;
  readonly gate: TileEdgePoint | null;
  readonly zoom: number;
};

type DrawPalisadeRunInput = {
  readonly path: PalisadeRenderPath;
  readonly style: PalisadeRunStyle;
  readonly zoom: number;
};

export type PalisadeRunStyle =
  | "queued"
  | "plot"
  | "foundation"
  | "frame"
  | "roof"
  | "completed";

export function drawPalisadeSegment(
  context: CanvasRenderingContext2D,
  input: DrawPalisadeSegmentInput,
): void {
  drawCompletedPosts(context, input.segment.edgePath, input.zoom, input.segment.material ?? "timber");
  if (input.gate !== null) drawGateMarker(context, input.gate, input.zoom);
}

export function drawPalisadeRun(
  context: CanvasRenderingContext2D,
  input: DrawPalisadeRunInput,
): void {
  switch (input.style) {
    case "queued":
      drawLine(context, input.path, "queued", input.zoom);
      return;
    case "plot":
      drawLine(context, input.path, "plot", input.zoom);
      return;
    case "foundation":
      drawLine(context, input.path, "foundation", input.zoom);
      drawMidPost(context, input.path, input.zoom);
      return;
    case "frame":
      drawLine(context, input.path, "frame", input.zoom);
      drawEndPosts(context, input.path, input.zoom);
      return;
    case "roof":
      drawLine(context, input.path, "roof", input.zoom);
      drawBuilderMarker(context, input.path, input.zoom);
      return;
    case "completed":
      drawCompletedPosts(context, input.path, input.zoom, "timber");
      return;
    default:
      return assertNever(input.style);
  }
}

export function drawPalisadeGateFlourish(
  context: CanvasRenderingContext2D,
  input: { readonly gate: TileEdgePoint; readonly zoom: number; readonly progress: number },
): void {
  const screen = palisadeScreenPath([input.gate])[0];
  if (screen === undefined) return;
  const radius = 10 + Math.max(0, Math.min(1, input.progress)) * 14;
  context.save();
  context.globalAlpha = Math.max(0, 1 - input.progress * 0.55);
  context.fillStyle = SEMANTIC_PALETTE.gold;
  context.beginPath();
  context.ellipse(snapToPixel(screen.x + 3), snapToPixel(screen.y - 5), radius, radius * 0.45, 0, 0, Math.PI * 2);
  context.fill();
  applyInkOutline(context, input.zoom);
  context.stroke();
  context.restore();
}

function drawLine(
  context: CanvasRenderingContext2D,
  path: PalisadeRenderPath,
  style: Exclude<PalisadeRunStyle, "completed">,
  zoom: number,
): void {
  context.save();
  if (style === "queued") context.setLineDash([6 / zoom, 4 / zoom]);
  if (style === "plot") context.setLineDash([4 / zoom, 4 / zoom]);
  context.beginPath();
  const points = palisadeScreenPath(path);
  const first = points[0];
  if (first === undefined) {
    context.restore();
    return;
  }
  context.moveTo(snapToPixel(first.x), snapToPixel(first.y));
  for (const point of points.slice(1)) {
    context.lineTo(snapToPixel(point.x), snapToPixel(point.y));
  }
  applyPaletteStroke(context, strokeColor(style), zoom);
  if (style === "plot") context.lineWidth = 2 / zoom;
  context.stroke();
  context.setLineDash([]);
  context.restore();
}

function drawMidPost(
  context: CanvasRenderingContext2D,
  path: PalisadeRenderPath,
  zoom: number,
): void {
  const midpoint = pathPointAt(path, 0.5);
  drawPost(context, midpoint, { width: 7, height: 16 }, zoom);
}

function drawEndPosts(
  context: CanvasRenderingContext2D,
  path: PalisadeRenderPath,
  zoom: number,
): void {
  for (const ratio of [0.25, 0.75]) {
    drawPost(context, pathPointAt(path, ratio), { width: 6, height: 38 }, zoom);
  }
}

function drawBuilderMarker(
  context: CanvasRenderingContext2D,
  path: PalisadeRenderPath,
  zoom: number,
): void {
  const center = pathPointAt(path, 0.5);
  context.fillStyle = PALETTE.gold;
  context.fillRect(snapToPixel(center.x - 3), snapToPixel(center.y - 5), 10, 8);
  applyInkOutline(context, zoom);
  context.strokeRect(snapToPixel(center.x - 3), snapToPixel(center.y - 5), 10, 8);
  context.fillRect(snapToPixel(center.x + 1), snapToPixel(center.y - 13), 2, 8);
}

function drawCompletedPosts(
  context: CanvasRenderingContext2D,
  path: PalisadeRenderPath,
  zoom: number,
  material: "timber" | "stone",
): void {
  for (const ratio of [0.125, 0.375, 0.625, 0.875]) {
    drawPost(context, pathPointAt(path, ratio), { width: 8, height: 30 }, zoom, material);
  }
}

function drawGateMarker(
  context: CanvasRenderingContext2D,
  gate: TileEdgePoint,
  zoom: number,
): void {
  const screen = palisadeScreenPath([gate])[0];
  if (screen === undefined) return;
  context.fillStyle = SEMANTIC_PALETTE.gold;
  context.fillRect(snapToPixel(screen.x - 3), snapToPixel(screen.y - 5), 12, 16);
  applyInkOutline(context, zoom);
  context.strokeRect(snapToPixel(screen.x - 3), snapToPixel(screen.y - 5), 12, 16);
}

function drawPost(
  context: CanvasRenderingContext2D,
  point: { readonly x: number; readonly y: number },
  size: { readonly width: number; readonly height: number },
  zoom: number,
  material: "timber" | "stone" = "timber",
): void {
  context.fillStyle = material === "stone" ? SEMANTIC_PALETTE.stone : SEMANTIC_PALETTE.earth;
  context.fillRect(
    snapToPixel(point.x - size.width / 2),
    snapToPixel(point.y - size.height + 2),
    size.width,
    size.height,
  );
  applyInkOutline(context, zoom);
  context.strokeRect(
    snapToPixel(point.x - size.width / 2),
    snapToPixel(point.y - size.height + 2),
    size.width,
    size.height,
  );
}

function pathPointAt(
  path: PalisadeRenderPath,
  ratio: number,
): { readonly x: number; readonly y: number } {
  const points = palisadeScreenPath(path);
  const first = points[0];
  const last = points[points.length - 1];
  if (first === undefined || last === undefined) return { x: 0, y: 0 };
  const lengths = points.slice(1).map((point, index) => {
    const previous = points[index] ?? first;
    return Math.hypot(point.x - previous.x, point.y - previous.y);
  });
  const totalLength = lengths.reduce((total, length) => total + length, 0);
  if (totalLength === 0) return first;

  const target = totalLength * Math.max(0, Math.min(1, ratio));
  let traversed = 0;
  for (let index = 0; index < lengths.length; index += 1) {
    const length = lengths[index];
    const start = points[index];
    const end = points[index + 1];
    if (length === undefined || start === undefined || end === undefined || length === 0) continue;
    if (target <= traversed + length) {
      const segmentRatio = (target - traversed) / length;
      return {
        x: start.x + (end.x - start.x) * segmentRatio,
        y: start.y + (end.y - start.y) * segmentRatio,
      };
    }
    traversed += length;
  }
  return last;
}

function strokeColor(style: Exclude<PalisadeRunStyle, "completed">): PaletteColor {
  switch (style) {
    case "queued":
      return SEMANTIC_PALETTE.inkLight;
    case "plot":
      return SEMANTIC_PALETTE.gold;
    case "foundation":
      return SEMANTIC_PALETTE.stone;
    case "frame":
    case "roof":
      return SEMANTIC_PALETTE.earthDark;
    default:
      return assertNever(style);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled palisade render style: ${JSON.stringify(value)}`);
}
