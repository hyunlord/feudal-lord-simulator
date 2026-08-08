import type { TileCoordinate } from "../world/grid";
import type { CameraState, ViewportBounds, WorldBounds } from "./camera";
import { canvasToWorld, clampPan } from "./camera";
import { screenToTile, tileToScreen } from "./iso";

export const MINIMAP_CAMERA_JUMP_EVENT = "feudal:minimap-camera-jump";
export const MINIMAP_VIEWPORT_EVENT = "feudal:minimap-viewport";
export const MINIMAP_VIEWBOX_SIZE = 120;

export type MinimapCameraJumpInput = {
  readonly camera: CameraState;
  readonly tile: TileCoordinate;
  readonly viewport: ViewportBounds;
  readonly world: WorldBounds;
};

export type MinimapViewportRect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

type MinimapViewportInput = {
  readonly camera: CameraState;
  readonly viewport: ViewportBounds;
  readonly world: WorldBounds;
  readonly grid: { readonly width: number; readonly height: number };
};

type MinimapJumpRuntimeInput = {
  readonly cameraRef: { current: CameraState };
  readonly markUserControlled: () => void;
  readonly target: Window;
  readonly viewport: () => ViewportBounds;
  readonly world: () => WorldBounds;
};

export function cameraForMinimapTileJump(input: MinimapCameraJumpInput): CameraState {
  const target = tileToScreen(input.tile.tx, input.tile.ty);
  return clampPan(
    {
      zoom: input.camera.zoom,
      panX: input.viewport.width / 2 - target.sx * input.camera.zoom,
      panY: input.viewport.height / 2 - target.sy * input.camera.zoom,
    },
    input.viewport,
    input.world,
  );
}

export function minimapViewportRectFromCamera(input: MinimapViewportInput): MinimapViewportRect {
  const corners = [
    { x: 0, y: 0 },
    { x: input.viewport.width, y: 0 },
    { x: 0, y: input.viewport.height },
    { x: input.viewport.width, y: input.viewport.height },
  ].map((point) => {
    const worldPoint = canvasToWorld(point, input.camera);
    return screenToTile(
      clamp(worldPoint.x, input.world.minX, input.world.maxX),
      clamp(worldPoint.y, input.world.minY, input.world.maxY),
    );
  });
  const minTx = clamp(Math.min(...corners.map((corner) => corner.tx)), 0, input.grid.width);
  const maxTx = clamp(Math.max(...corners.map((corner) => corner.tx)), 0, input.grid.width);
  const minTy = clamp(Math.min(...corners.map((corner) => corner.ty)), 0, input.grid.height);
  const maxTy = clamp(Math.max(...corners.map((corner) => corner.ty)), 0, input.grid.height);
  return {
    x: round((minTx / input.grid.width) * MINIMAP_VIEWBOX_SIZE),
    y: round((minTy / input.grid.height) * MINIMAP_VIEWBOX_SIZE),
    width: round(Math.max(2, ((maxTx - minTx) / input.grid.width) * MINIMAP_VIEWBOX_SIZE)),
    height: round(Math.max(2, ((maxTy - minTy) / input.grid.height) * MINIMAP_VIEWBOX_SIZE)),
  };
}

export function publishMinimapViewport(input: MinimapViewportInput & { readonly target: Window }): void {
  input.target.dispatchEvent(new CustomEvent(MINIMAP_VIEWPORT_EVENT, {
    detail: minimapViewportRectFromCamera(input),
  }));
}

export function installMinimapCameraJumpRuntime(input: MinimapJumpRuntimeInput): () => void {
  const minimapJump = (event: Event) => {
    const tile = tileCoordinateFromEvent(event);
    if (tile === null) return;
    input.markUserControlled();
    input.cameraRef.current = cameraForMinimapTileJump({
      camera: input.cameraRef.current,
      tile,
      viewport: input.viewport(),
      world: input.world(),
    });
  };
  input.target.addEventListener(MINIMAP_CAMERA_JUMP_EVENT, minimapJump);
  return () => input.target.removeEventListener(MINIMAP_CAMERA_JUMP_EVENT, minimapJump);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function tileCoordinateFromEvent(event: Event): TileCoordinate | null {
  if (!(event instanceof CustomEvent)) return null;
  const detail: unknown = event.detail;
  if (typeof detail !== "object" || detail === null) return null;
  if (!("tx" in detail) || !("ty" in detail)) return null;
  const tx = detail.tx;
  const ty = detail.ty;
  if (typeof tx !== "number" || typeof ty !== "number") return null;
  if (!Number.isInteger(tx) || !Number.isInteger(ty)) return null;
  return { tx, ty };
}
