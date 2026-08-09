import type { CameraState, CanvasRect, ClientPoint } from "./camera";
import { canvasToWorld } from "./camera";
import { pickTile } from "./picking";
import type { TileCoord } from "./picking";

function isInsideRect(point: ClientPoint, rect: CanvasRect): boolean {
  return (
    point.clientX >= rect.left &&
    point.clientY >= rect.top &&
    point.clientX <= rect.left + rect.width &&
    point.clientY <= rect.top + rect.height
  );
}

export function releaseTileFromMouseEvent(
  event: ClientPoint,
  rect: CanvasRect,
  camera: CameraState,
): TileCoord | null {
  if (!isInsideRect(event, rect)) return null;

  const worldPoint = canvasToWorld(
    {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    },
    camera,
  );
  return pickTile(worldPoint);
}
