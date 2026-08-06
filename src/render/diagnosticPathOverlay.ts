import type { Walker } from "../agents/walker.types";
import { PALETTE } from "../content/palette";
import { tileToScreen } from "./iso";

export type DiagnosticPathContext = Pick<
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
  | "strokeStyle"
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
  context.strokeStyle = PALETTE.gold;
  context.lineWidth = 2 / Math.max(zoom, 0.01);
  context.lineCap = "round";
  context.lineJoin = "round";
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
