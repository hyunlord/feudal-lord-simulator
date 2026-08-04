import type { DeliveryInventoryPort, DeliveryRoutePort } from "../agents/delivery";
import type { RoamingRoutePort } from "../agents/roaming";
import type { TilePos } from "../agents/walker.types";
import { BUILDING_CONFIG_BY_KIND } from "../content/buildingConfig";
import type { Building } from "../content/buildingConfig";
import {
  availableSpace,
  availableStock,
  releaseReservation,
  releaseStockReservation,
  reserve,
  reserveStock,
  withdrawReservedStock,
} from "../economy/storage";
import { getTile } from "../world/grid";
import { getOrthogonalRoadNeighbors } from "../world/roadGraph";
import type { GameState, RoadPathCache } from "./engine.types";
import {
  buildingRoadAccessTiles,
  resolveBuildingRoute,
  resolveRoadToBuildingRoute,
} from "./routing";

export interface SimulationRoutePorts {
  readonly delivery: DeliveryRoutePort;
  readonly roaming: RoamingRoutePort;
  readonly getPathCache: () => RoadPathCache;
}

function findBuilding(
  buildings: readonly Building[],
  buildingId: string,
): Building | null {
  return buildings.find((building) => building.id === buildingId) ?? null;
}

function firstTile(tiles: readonly TilePos[]): TilePos | null {
  return tiles[0] ?? null;
}

function tileKey(tile: TilePos): string {
  return `${tile.tx},${tile.ty}`;
}

function roadComponentSize(state: GameState, start: TilePos): number {
  const queue: TilePos[] = [start];
  const visited = new Set<string>();
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (current === undefined) continue;
    const key = tileKey(current);
    if (visited.has(key)) continue;
    visited.add(key);
    for (const neighbor of getOrthogonalRoadNeighbors(state, current)) {
      if (!visited.has(tileKey(neighbor))) queue.push(neighbor);
    }
  }
  return visited.size;
}

function roamingHomeAccess(state: GameState, building: Building): TilePos | null {
  const accesses = buildingRoadAccessTiles(state, building);
  let best = firstTile(accesses);
  let bestSize = best === null ? 0 : roadComponentSize(state, best);
  for (const access of accesses.slice(1)) {
    const size = roadComponentSize(state, access);
    if (size <= bestSize) continue;
    best = access;
    bestSize = size;
  }
  return best;
}

function stateWithCache(
  state: GameState,
  pathCache: RoadPathCache,
): GameState {
  return { ...state, pathCache };
}

export function createDeliveryInventoryPort(): DeliveryInventoryPort {
  return {
    availableSpace: (building) =>
      availableSpace(building, BUILDING_CONFIG_BY_KIND[building.kind]),
    reserveSpace: reserve,
    releaseSpace: releaseReservation,
    availableStock,
    reserveStock: (building, resource, amount) =>
      reserveStock(building, { buildingId: building.id, resource, amount }),
    releaseStock: releaseStockReservation,
    withdrawStock: withdrawReservedStock,
  };
}

export function createSimulationRoutePorts(state: GameState): SimulationRoutePorts {
  let pathCache = state.pathCache;
  const routeState = (): GameState => stateWithCache(state, pathCache);

  const routeToBuilding = (
    start: TilePos,
    toBuildingId: string,
  ): readonly TilePos[] | null => {
    const destination = findBuilding(state.buildings, toBuildingId);
    return destination === null
      ? null
      : resolveRoadToBuildingRoute(routeState(), start, destination);
  };

  const delivery: DeliveryRoutePort = {
    betweenBuildings: (fromBuildingId, toBuildingId) => {
      const from = findBuilding(state.buildings, fromBuildingId);
      const to = findBuilding(state.buildings, toBuildingId);
      if (from === null || to === null) return null;

      const resolved = resolveBuildingRoute(routeState(), from, to);
      pathCache = resolved.pathCache;
      return resolved.path;
    },
    fromTileToBuilding: routeToBuilding,
    isRoad: (tile) => getTile(state, tile)?.hasRoad === true,
  };

  const roaming: RoamingRoutePort = {
    homePath: (buildingId) => {
      const building = findBuilding(state.buildings, buildingId);
      if (building === null) return null;
      const access = roamingHomeAccess(state, building);
      return access === null ? null : [access];
    },
    returnPath: routeToBuilding,
    neighbors: (tile) => getOrthogonalRoadNeighbors(state, tile),
  };

  return {
    delivery,
    roaming,
    getPathCache: () => pathCache,
  };
}
