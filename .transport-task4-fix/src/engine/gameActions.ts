import {
  BUILDING_CONFIG_BY_KIND,
  type Building,
  type BuildingDefinition,
  type BuildingKind,
} from "../content/buildingConfig";
import { isInBounds, type TileCoordinate } from "../world/grid";
import { canPlaceBuilding } from "../world/placement";
import { canPlaceRoad, roadLine } from "../world/roadGraph";
import type { Tile } from "../world/world.types";
import type { GameState } from "./engine.types";

function buildingId(kind: BuildingKind, origin: TileCoordinate, buildingCount: number): string {
  return `${kind}-${origin.tx}-${origin.ty}-${buildingCount}`;
}

function tileIsInFootprint(
  tile: Tile,
  origin: TileCoordinate,
  definition: BuildingDefinition,
): boolean {
  return (
    tile.tx >= origin.tx &&
    tile.tx < origin.tx + definition.width &&
    tile.ty >= origin.ty &&
    tile.ty < origin.ty + definition.height
  );
}

export function placeBuilding(
  state: GameState,
  kind: BuildingKind,
  origin: TileCoordinate,
): GameState {
  const placement = canPlaceBuilding(state, kind, origin.tx, origin.ty);
  if (!placement.ok) return state;

  const definition = BUILDING_CONFIG_BY_KIND[kind];
  const id = buildingId(kind, origin, state.buildings.length);
  const building: Building = {
    id,
    kind,
    tx: origin.tx,
    ty: origin.ty,
    workers: 0,
    inventory: {},
    productionProgress: 0,
  };

  return {
    ...state,
    tiles: state.tiles.map((tile) =>
      tileIsInFootprint(tile, origin, definition)
        ? { ...tile, buildingId: id }
        : tile,
    ),
    buildings: [...state.buildings, building],
    treasuryTimber: state.treasuryTimber - (definition.buildCost.timber ?? 0),
  };
}

export function placeRoadLine(
  state: GameState,
  start: TileCoordinate,
  destination: TileCoordinate,
): GameState {
  if (!canPlaceRoadLineEndpoints(state, start, destination)) return state;

  const line = roadLine(start, destination);
  if (!line.every((coordinate) => canPlaceRoad(state, coordinate))) return state;

  return {
    ...state,
    tiles: state.tiles.map((tile) =>
      line.some((coordinate) => coordinate.tx === tile.tx && coordinate.ty === tile.ty)
        ? { ...tile, hasRoad: true }
        : tile,
    ),
  };
}

export function canPlaceRoadLineEndpoints(
  state: GameState,
  start: TileCoordinate,
  destination: TileCoordinate,
): boolean {
  return isInBounds(state, start) && isInBounds(state, destination);
}
