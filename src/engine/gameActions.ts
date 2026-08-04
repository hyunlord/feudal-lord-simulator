import {
  BUILDING_CONFIG_BY_KIND,
  type Building,
  type BuildingDefinition,
  type BuildingKind,
} from "../content/buildingConfig";
import type { ResourceType } from "../content/resourceConfig";
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
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
  };
  const timberCost = definition.buildCost.timber ?? 0;
  const paid = spendResource(state, "timber", timberCost);
  const houses =
    kind === "house"
      ? [
          ...state.houses,
          {
            buildingId: id,
            level: 0,
            residents: 0,
            hasWater: false,
            breadStock: 0,
            lastServicedTick: state.tick,
            unmetRequirementTicks: 0,
          },
        ]
      : state.houses;

  return {
    ...state,
    tiles: state.tiles.map((tile) =>
      tileIsInFootprint(tile, origin, definition)
        ? { ...tile, buildingId: id }
        : tile,
    ),
    buildings: [...paid.buildings, building],
    houses,
    treasuryTimber: paid.treasuryTimber,
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
    roadRevision: state.roadRevision + 1,
    pathCache: {},
  };
}

export function canPlaceRoadLineEndpoints(
  state: GameState,
  start: TileCoordinate,
  destination: TileCoordinate,
): boolean {
  return isInBounds(state, start) && isInBounds(state, destination);
}

function spendResource(
  state: GameState,
  resource: ResourceType,
  amount: number,
): Pick<GameState, "buildings" | "treasuryTimber"> {
  if (amount === 0) {
    return {
      buildings: state.buildings,
      treasuryTimber: state.treasuryTimber,
    };
  }

  const treasurySpent = Math.min(state.treasuryTimber, amount);
  const remaining = amount - treasurySpent;
  if (remaining === 0) {
    return {
      buildings: state.buildings,
      treasuryTimber: state.treasuryTimber - treasurySpent,
    };
  }

  let remainingStoredCost = remaining;
  const spentById = new Map<string, number>();
  [...state.buildings]
    .sort((left, right) => left.id.localeCompare(right.id))
    .forEach((building) => {
      if (remainingStoredCost === 0) return building;

      const stored = building.inventory[resource] ?? 0;
      const spent = Math.min(stored, remainingStoredCost);
      if (spent === 0) return building;

      remainingStoredCost -= spent;
      spentById.set(building.id, spent);
      return building;
    });

  const buildings = state.buildings.map((building) => {
    const spent = spentById.get(building.id) ?? 0;
    if (spent === 0) return building;

    const stored = building.inventory[resource] ?? 0;
    return {
      ...building,
      inventory: {
        ...building.inventory,
        [resource]: stored - spent,
      },
    };
  });

  return {
    buildings,
    treasuryTimber: 0,
  };
}
