import { BUILDING_CONFIG_BY_KIND } from "../content/buildingConfig";
import type { GameState } from "../engine/engine.types";
import { getTile, isInBounds, type TileCoordinate } from "../world/grid";
import { canPlaceBuilding } from "../world/placement";
import { PlacementFailure } from "../world/placement";
import { canPlaceRoad, roadLine } from "../world/roadGraph";
import type { CameraState, CanvasRect, Point, ViewportBounds, WorldBounds } from "./camera";
import { canvasToWorld, clampPan, clientToCanvas, clampZoom } from "./camera";
import { TILE_H, TILE_W } from "./iso";
import { pickTile } from "./picking";
import type { PlacementPreview } from "./overlays";
import type { PlacementTool } from "./renderer";

export type PointerLike = {
  readonly clientX: number;
  readonly clientY: number;
};

export type ZoomInput = {
  readonly camera: CameraState;
  readonly canvasPoint: Point;
  readonly deltaY: number;
  readonly viewport: ViewportBounds;
  readonly world: WorldBounds;
};

export type KeyboardPanInput = {
  readonly camera: CameraState;
  readonly key: string;
  readonly viewport: ViewportBounds;
  readonly world: WorldBounds;
};

export const DEFAULT_PLACEMENT_TOOL: PlacementTool = "house";

export function worldBounds(width: number, height: number): WorldBounds {
  return {
    minX: -(height + 2) * TILE_W * 0.5,
    minY: -TILE_H * 4,
    maxX: (width + 2) * TILE_W * 0.5,
    maxY: (width + height + 4) * TILE_H * 0.5,
  };
}

export function pointerTile(
  pointer: PointerLike,
  rect: CanvasRect,
  camera: CameraState,
): TileCoordinate | null {
  const canvasPoint = clientToCanvas(pointer, rect);
  return pickTile(canvasToWorld(canvasPoint, camera));
}

export function releaseTileFromMouseUp(
  pointer: PointerLike,
  rect: CanvasRect,
  camera: CameraState,
): TileCoordinate | null {
  const inside =
    pointer.clientX >= rect.left &&
    pointer.clientX < rect.left + rect.width &&
    pointer.clientY >= rect.top &&
    pointer.clientY < rect.top + rect.height;

  return inside ? pointerTile(pointer, rect, camera) : null;
}

export function zoomAtPoint(input: ZoomInput): CameraState {
  const before = canvasToWorld(input.canvasPoint, input.camera);
  const zoom = clampZoom(input.camera.zoom * (input.deltaY > 0 ? 0.9 : 1.1));
  const camera = {
    zoom,
    panX: input.canvasPoint.x - before.x * zoom,
    panY: input.canvasPoint.y - before.y * zoom,
  };
  return clampPan(camera, input.viewport, input.world);
}

export function panByKey(input: KeyboardPanInput): CameraState {
  const step = 32;
  switch (input.key) {
    case "w":
    case "ArrowUp":
      return clampPan({ ...input.camera, panY: input.camera.panY + step }, input.viewport, input.world);
    case "s":
    case "ArrowDown":
      return clampPan({ ...input.camera, panY: input.camera.panY - step }, input.viewport, input.world);
    case "a":
    case "ArrowLeft":
      return clampPan({ ...input.camera, panX: input.camera.panX + step }, input.viewport, input.world);
    case "d":
    case "ArrowRight":
      return clampPan({ ...input.camera, panX: input.camera.panX - step }, input.viewport, input.world);
    default:
      return input.camera;
  }
}

export function placementPreview(
  state: GameState,
  tool: PlacementTool,
  tile: TileCoordinate | null,
  roadStart: TileCoordinate | null,
): PlacementPreview {
  if (tile === null) {
    return emptyPreview(tool);
  }
  if (tool === "road") {
    const path = roadStart === null ? [tile] : roadLine(roadStart, tile);
    const ok = path.every((coordinate) => canPlaceRoad(state, coordinate));
    return { tool, tile, footprint: [], roadPath: path, ok, reason: ok ? null : roadFailure(state, path), cursor: tile };
  }
  const placement = canPlaceBuilding(state, tool, tile.tx, tile.ty);
  return {
    tool,
    tile,
    footprint: buildingFootprint(tool, tile),
    roadPath: [],
    ok: placement.ok,
    reason: placement.ok ? null : placement.reason,
    cursor: tile,
  };
}

function emptyPreview(tool: PlacementTool): PlacementPreview {
  return { tool, tile: null, footprint: [], roadPath: [], ok: true, reason: null, cursor: null };
}

function buildingFootprint(tool: Exclude<PlacementTool, "road">, origin: TileCoordinate): readonly TileCoordinate[] {
  const config = BUILDING_CONFIG_BY_KIND[tool];
  const tiles: TileCoordinate[] = [];
  for (let dy = 0; dy < config.height; dy += 1) {
    for (let dx = 0; dx < config.width; dx += 1) {
      tiles.push({ tx: origin.tx + dx, ty: origin.ty + dy });
    }
  }
  return tiles;
}

function roadFailure(state: GameState, path: readonly TileCoordinate[]): PlacementFailure {
  for (const coordinate of path) {
    if (!isInBounds(state, coordinate)) {
      return PlacementFailure.out_of_bounds;
    }
    const tile = getTile(state, coordinate);
    if (tile === null) {
      return PlacementFailure.out_of_bounds;
    }
    if (tile.buildingId !== null || tile.hasRoad) {
      return PlacementFailure.occupied;
    }
    if (tile.terrain === "water") {
      return PlacementFailure.wrong_terrain;
    }
  }
  return PlacementFailure.occupied;
}
