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
import {
  createPlacementFeedback,
  formatPlacementFailure,
  type PlacementFeedback,
} from "./placementFeedback";
import type { PlacementPreview } from "./overlays";
import type { PlacementTool } from "./renderer";
import type { GameAction } from "../state/gameStore.types";

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
export const MODELED_ROAD_TIMBER_COST = 0;

type BuildingPlacementAttemptInput = {
  readonly state: GameState;
  readonly tool: Exclude<PlacementTool, "road">;
  readonly tile: TileCoordinate;
  readonly nowMs: number;
};

type RoadPlacementAttemptInput = {
  readonly state: GameState;
  readonly start: TileCoordinate;
  readonly destination: TileCoordinate;
  readonly nowMs: number;
};

export type PlacementAttemptOutcome = {
  readonly action: GameAction | null;
  readonly feedback: PlacementFeedback;
  readonly keepToolArmed: true;
};

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
  tool: PlacementTool | null,
  tile: TileCoordinate | null,
  roadStart: TileCoordinate | null,
): PlacementPreview {
  if (tool === null || tile === null) {
    return emptyPreview(tool);
  }
  if (tool === "road") {
    const path = roadStart === null ? [tile] : roadLine(roadStart, tile);
    const ok = path.every((coordinate) => canPlaceRoad(state, coordinate));
    return {
      tool,
      tile,
      footprint: [],
      roadPath: path,
      ok,
      reason: ok ? null : roadFailure(state, path),
      cursor: tile,
      timberCost: MODELED_ROAD_TIMBER_COST,
    };
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
    timberCost: null,
  };
}

export function resolveBuildingPlacementAttempt(
  input: BuildingPlacementAttemptInput,
): PlacementAttemptOutcome {
  const placement = canPlaceBuilding(input.state, input.tool, input.tile.tx, input.tile.ty);
  if (!placement.ok) {
    return {
      action: null,
      feedback: createPlacementFeedback({
        kind: "failure",
        message: formatPlacementFailure({
          reason: placement.reason,
          buildingKind: input.tool,
          shortfalls: "shortfalls" in placement ? placement.shortfalls : {},
        }),
        anchor: { kind: "tile", tile: input.tile },
        nowMs: input.nowMs,
      }),
      keepToolArmed: true,
    };
  }

  return {
    action: { type: "place_building", kind: input.tool, tx: input.tile.tx, ty: input.tile.ty },
    feedback: createPlacementFeedback({
      kind: "success",
      message: "건설했습니다",
      anchor: { kind: "tile", tile: input.tile },
      nowMs: input.nowMs,
    }),
    keepToolArmed: true,
  };
}

export function resolveRoadPlacementAttempt(
  input: RoadPlacementAttemptInput,
): PlacementAttemptOutcome {
  const path = roadLine(input.start, input.destination);
  const failure = roadFailure(input.state, path);
  if (failure !== null) {
    return {
      action: null,
      feedback: createPlacementFeedback({
        kind: "failure",
        message: formatPlacementFailure({ reason: failure, buildingKind: "house" }),
        anchor: { kind: "path", path },
        nowMs: input.nowMs,
      }),
      keepToolArmed: true,
    };
  }

  return {
    action: { type: "place_road_line", start: input.start, destination: input.destination },
    feedback: createPlacementFeedback({
      kind: "success",
      message: `길을 놓았습니다 · 목재 ${MODELED_ROAD_TIMBER_COST}`,
      anchor: { kind: "path", path },
      nowMs: input.nowMs,
    }),
    keepToolArmed: true,
  };
}

function emptyPreview(tool: PlacementTool | null): PlacementPreview {
  return {
    tool,
    tile: null,
    footprint: [],
    roadPath: [],
    ok: true,
    reason: null,
    cursor: null,
    timberCost: tool === "road" ? MODELED_ROAD_TIMBER_COST : null,
  };
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

function roadFailure(state: GameState, path: readonly TileCoordinate[]): PlacementFailure | null {
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
  return null;
}
