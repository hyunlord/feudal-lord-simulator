import { PALETTE } from "../content/palette";
import type { GameState, OverlayMode } from "../engine/engine.types";
import type { PlacementFailure } from "../world/placement";
import type { TileCoordinate } from "../world/grid";
import type { PlacementTool } from "./renderer";
import { TILE_H, TILE_W, tileToScreen } from "./iso";
import { applyInkOutline, snapToPixel, withAlpha } from "./style";

export function drawOverlay(
  _context: CanvasRenderingContext2D,
  _state: GameState,
  _mode: OverlayMode,
): void {}

export type PlacementPreview = {
  readonly tool: PlacementTool;
  readonly tile: TileCoordinate | null;
  readonly footprint: readonly TileCoordinate[];
  readonly roadPath: readonly TileCoordinate[];
  readonly ok: boolean;
  readonly reason: PlacementFailure | null;
  readonly cursor: TileCoordinate | null;
};

export type PlacementOverlayInput = {
  readonly preview: PlacementPreview;
  readonly zoom: number;
};

export function drawPlacementOverlay(
  context: CanvasRenderingContext2D,
  input: PlacementOverlayInput,
): void {
  const coordinates = input.preview.tool === "road" ? input.preview.roadPath : input.preview.footprint;
  context.fillStyle = withAlpha(input.preview.ok ? PALETTE.sage : PALETTE.vermilion, 0.35);
  for (const coordinate of coordinates) {
    traceDiamond(context, coordinate);
    context.fill();
    applyInkOutline(context, input.zoom);
    context.stroke();
  }
  if (!input.preview.ok && input.preview.reason !== null && input.preview.cursor !== null) {
    drawFailureText(context, input.preview.cursor, input.preview.reason, input.zoom);
  }
}

function drawFailureText(
  context: CanvasRenderingContext2D,
  coordinate: TileCoordinate,
  reason: PlacementFailure,
  zoom: number,
): void {
  const center = tileToScreen(coordinate.tx, coordinate.ty);
  const label = reason.replaceAll("_", " ");
  const fontSize = 14 / zoom;
  const padding = 4 / zoom;
  const labelX = snapToPixel(center.sx + TILE_W / 3);
  const labelY = snapToPixel(center.sy - TILE_H / 2);
  context.font = `${fontSize}px Georgia, serif`;
  const plaqueX = snapToPixel(labelX - padding);
  const plaqueY = snapToPixel(labelY - fontSize - padding);
  const plaqueWidth = snapToPixel(context.measureText(label).width + padding * 2);
  const plaqueHeight = snapToPixel(fontSize + padding * 2);

  context.fillStyle = PALETTE.vellum;
  context.fillRect(plaqueX, plaqueY, plaqueWidth, plaqueHeight);
  applyInkOutline(context, zoom);
  context.strokeRect(plaqueX, plaqueY, plaqueWidth, plaqueHeight);
  context.fillStyle = PALETTE.vermilion;
  context.fillText(label, labelX, labelY);
}

function traceDiamond(context: CanvasRenderingContext2D, coordinate: TileCoordinate): void {
  const center = tileToScreen(coordinate.tx, coordinate.ty);
  context.beginPath();
  context.moveTo(snapToPixel(center.sx), snapToPixel(center.sy - TILE_H / 2));
  context.lineTo(snapToPixel(center.sx + TILE_W / 2), snapToPixel(center.sy));
  context.lineTo(snapToPixel(center.sx), snapToPixel(center.sy + TILE_H / 2));
  context.lineTo(snapToPixel(center.sx - TILE_W / 2), snapToPixel(center.sy));
  context.closePath();
}
