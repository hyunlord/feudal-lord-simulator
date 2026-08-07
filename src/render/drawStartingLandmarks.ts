import { PALETTE, SEMANTIC_PALETTE } from "../content/palette";
import { TILE_H, TILE_W, tileToScreen } from "./iso";
import { applyInkOutline, snapToPixel, withAlpha } from "./style";
import type { StartingLandmark } from "./startingLandmarks";

export function drawStartingLandmark(
  context: CanvasRenderingContext2D,
  landmark: StartingLandmark,
  zoom: number,
): void {
  switch (landmark.kind) {
    case "ford":
      drawFord(context, landmark, zoom);
      return;
  }
}

function drawFord(
  context: CanvasRenderingContext2D,
  landmark: StartingLandmark,
  zoom: number,
): void {
  const center = tileToScreen(landmark.tx, landmark.ty);
  context.fillStyle = withAlpha(SEMANTIC_PALETTE.water, 0.72);
  context.beginPath();
  context.ellipse(
    snapToPixel(center.sx),
    snapToPixel(center.sy + 2),
    snapToPixel(TILE_W * 0.38),
    snapToPixel(TILE_H * 0.24),
    0,
    0,
    Math.PI * 2,
  );
  context.fill();
  applyInkOutline(context, zoom);
  context.stroke();

  context.fillStyle = SEMANTIC_PALETTE.stone;
  for (const offset of [-18, 0, 18] as const) {
    context.beginPath();
    context.ellipse(
      snapToPixel(center.sx + offset),
      snapToPixel(center.sy),
      snapToPixel(7),
      snapToPixel(4),
      0,
      0,
      Math.PI * 2,
    );
    context.fill();
    applyInkOutline(context, zoom);
    context.stroke();
  }

  context.font = `${snapToPixel(12 / Math.max(zoom, 0.5))}px Georgia, serif`;
  context.fillStyle = PALETTE.ink;
  context.fillText(landmark.label, snapToPixel(center.sx - 18), snapToPixel(center.sy - 13));
}
