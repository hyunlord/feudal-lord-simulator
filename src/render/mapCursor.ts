import { PALETTE } from "../content/palette";
import { worldToCanvas, type CameraState, type Point } from "./camera";
import { TILE_H, TILE_W, tileToScreen } from "./iso";
import { pickTile } from "./picking";
import { applyTextureStroke, withAlpha } from "./style";

// Controller map cursor (TOUCH-1): the tile under the gamepad cursor, outlined, and the cursor point itself. Drawn
// over the frame in canvas CSS pixels while the gamepad is the last input device.

export function drawMapCursor(context: CanvasRenderingContext2D, cursor: Point, camera: CameraState, pixelRatio: number): void {
  const tile = pickTile(cursor);
  context.save();
  try {
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    if (tile !== null) {
      const centre = tileToScreen(tile.tx, tile.ty);
      const corners = [[TILE_W / 2, 0], [0, TILE_H / 2], [-TILE_W / 2, 0], [0, -TILE_H / 2]] as const;
      context.beginPath();
      corners.forEach(([dx, dy], index) => {
        const at = worldToCanvas({ x: centre.sx + dx, y: centre.sy + dy }, camera);
        if (index === 0) context.moveTo(at.x, at.y); else context.lineTo(at.x, at.y);
      });
      context.closePath();
      context.fillStyle = withAlpha(PALETTE.gold, 0.18);
      context.fill();
      applyTextureStroke(context, PALETTE.gold, 2);
      context.stroke();
    }
    const at = worldToCanvas(cursor, camera);
    context.beginPath();
    context.arc(at.x, at.y, 5, 0, Math.PI * 2);
    applyTextureStroke(context, PALETTE.ink, 2);
    context.stroke();
    context.beginPath();
    context.arc(at.x, at.y, 3, 0, Math.PI * 2);
    context.fillStyle = withAlpha(PALETTE.gold, 1);
    context.fill();
  } finally {
    context.restore();
  }
}
