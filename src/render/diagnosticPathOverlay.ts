import type { Walker } from "../agents/walker.types";
import { PALETTE } from "../content/palette";
import { tileToScreen } from "./iso";
import { applyPaletteStroke, type PaletteStrokeContext } from "./style";

export type DiagnosticPathContext = PaletteStrokeContext & Pick<
  CanvasRenderingContext2D,
  | "beginPath"
  | "lineCap"
  | "lineJoin"
  | "lineTo"
  | "lineWidth"
  | "moveTo"
  | "restore"
  | "save"
  | "stroke"
>;

export function selectedWalkerPath(walker: Walker): Walker["path"] {
  return walker.path;
}

export function drawSelectedWalkerPath(
  context: DiagnosticPathContext,
  walker: Walker,
  zoom: number,
): void {
  const path = selectedWalkerPath(walker);
  const first = path[0];
  if (first === undefined) return;

  context.save();
  applyPaletteStroke(context, PALETTE.gold, Math.max(zoom, 0.01) / 2);
  context.beginPath();
  const start = tileToScreen(first.tx, first.ty);
  context.moveTo(start.sx, start.sy);
  for (const tile of path.slice(1)) {
    const point = tileToScreen(tile.tx, tile.ty);
    context.lineTo(point.sx, point.sy);
  }
  context.stroke();
  context.restore();
}
