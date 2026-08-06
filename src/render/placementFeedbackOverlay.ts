import { PALETTE, SEMANTIC_PALETTE } from "../content/palette";
import { TILE_H, TILE_W, tileToScreen } from "./iso";
import { applyInkOutline, applyPaletteStroke, snapToPixel, withAlpha } from "./style";
import type { PlacementFeedback } from "./placementFeedback";
import type { PlacementFailure } from "../world/placement";
import type { TileCoordinate } from "../world/grid";
import type { PlacementTool } from "./renderer";

export type PlacementPreviewOverlayInput = {
  readonly tool: PlacementTool | null;
  readonly footprint: readonly TileCoordinate[];
  readonly roadPath: readonly TileCoordinate[];
  readonly ok: boolean;
  readonly reason: PlacementFailure | null;
  readonly cursor: TileCoordinate | null;
};

function traceDiamond(context: CanvasRenderingContext2D, coordinate: TileCoordinate): void {
  const center = tileToScreen(coordinate.tx, coordinate.ty);
  context.beginPath();
  context.moveTo(snapToPixel(center.sx), snapToPixel(center.sy - TILE_H / 2));
  context.lineTo(snapToPixel(center.sx + TILE_W / 2), snapToPixel(center.sy));
  context.lineTo(snapToPixel(center.sx), snapToPixel(center.sy + TILE_H / 2));
  context.lineTo(snapToPixel(center.sx - TILE_W / 2), snapToPixel(center.sy));
  context.closePath();
}

function traceExpandedDiamond(
  context: CanvasRenderingContext2D,
  coordinate: TileCoordinate,
  expansion: number,
): void {
  const center = tileToScreen(coordinate.tx, coordinate.ty);
  context.beginPath();
  context.moveTo(snapToPixel(center.sx), snapToPixel(center.sy - TILE_H / 2 - expansion));
  context.lineTo(snapToPixel(center.sx + TILE_W / 2 + expansion), snapToPixel(center.sy));
  context.lineTo(snapToPixel(center.sx), snapToPixel(center.sy + TILE_H / 2 + expansion));
  context.lineTo(snapToPixel(center.sx - TILE_W / 2 - expansion), snapToPixel(center.sy));
  context.closePath();
}

function feedbackCoordinates(feedback: PlacementFeedback): readonly TileCoordinate[] {
  switch (feedback.anchor.kind) {
    case "tile":
      return [feedback.anchor.tile];
    case "path":
      return feedback.anchor.path;
  }
}

function feedbackCursor(feedback: PlacementFeedback): TileCoordinate {
  switch (feedback.anchor.kind) {
    case "tile":
      return feedback.anchor.tile;
    case "path":
      return feedback.anchor.path[feedback.anchor.path.length - 1] ?? { tx: 0, ty: 0 };
  }
}

export function drawPlacementPreviewOverlay(
  context: CanvasRenderingContext2D,
  preview: PlacementPreviewOverlayInput,
  zoom: number,
): void {
  const coordinates = preview.tool === "road" ? preview.roadPath : preview.footprint;
  context.fillStyle = withAlpha(preview.ok ? SEMANTIC_PALETTE.sage : PALETTE.vermilion, 0.35);
  for (const coordinate of coordinates) {
    traceDiamond(context, coordinate);
    context.fill();
    applyInkOutline(context, zoom);
    context.stroke();
  }
  if (!preview.ok && preview.reason !== null && preview.cursor !== null) {
    drawFailureText(context, preview.cursor, preview.reason, zoom);
  }
}

export function drawPlacementFeedbackSuccess(
  context: CanvasRenderingContext2D,
  feedback: PlacementFeedback,
  nowMs: number,
  zoom: number,
): void {
  const progress = (nowMs - feedback.createdAtMs) / (feedback.expiresAtMs - feedback.createdAtMs);
  const expansion = (6 + 10 * Math.max(0, Math.min(1, progress))) / zoom;
  context.save();
  context.globalAlpha = 1 - Math.max(0, Math.min(1, progress)) * 0.45;
  applyPaletteStroke(context, PALETTE.gold, zoom);
  for (const coordinate of feedbackCoordinates(feedback)) {
    traceExpandedDiamond(context, coordinate, expansion);
    context.stroke();
  }
  context.restore();
}

export function drawPlacementFeedbackFailure(
  context: CanvasRenderingContext2D,
  feedback: PlacementFeedback,
  zoom: number,
): void {
  context.save();
  context.fillStyle = withAlpha(PALETTE.vermilion, 0.3);
  for (const coordinate of feedbackCoordinates(feedback)) {
    traceDiamond(context, coordinate);
    context.fill();
    applyInkOutline(context, zoom);
    context.stroke();
  }
  drawFailureText(context, feedbackCursor(feedback), feedback.message, zoom);
  context.restore();
}

function drawFailureText(
  context: CanvasRenderingContext2D,
  coordinate: TileCoordinate,
  message: string,
  zoom: number,
): void {
  const label = message.replaceAll("_", " ");
  const center = tileToScreen(coordinate.tx, coordinate.ty);
  const fontSize = 14 / zoom;
  const padding = 4 / zoom;
  const labelX = snapToPixel(center.sx + TILE_W / 2);
  const labelY = snapToPixel(center.sy - TILE_H / 2);
  context.font = `${fontSize}px Georgia, serif`;
  const plaqueX = snapToPixel(labelX - padding);
  const plaqueY = snapToPixel(labelY - fontSize - padding);
  const plaqueWidth = snapToPixel(context.measureText(label).width + padding * 2);
  const plaqueHeight = snapToPixel(fontSize + padding * 2);

  context.fillStyle = SEMANTIC_PALETTE.vellum;
  context.fillRect(plaqueX, plaqueY, plaqueWidth, plaqueHeight);
  applyInkOutline(context, zoom);
  context.strokeRect(plaqueX, plaqueY, plaqueWidth, plaqueHeight);
  context.fillStyle = PALETTE.vermilion;
  context.fillText(label, labelX, labelY);
}
