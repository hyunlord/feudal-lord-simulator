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
  resolveBuildingToConstructionSiteRoute,
  resolveBuildingRoute,
  resolveRoadToConstructionSiteRoute,
  resolveRoadToBuildingRoute,
} from "./routing";
import type { CarterDestination } from "../agents/walker.types";

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

function findSite(
  state: GameState,
  siteId: string,
) {
  return state.constructionSites.find((site) => site.id === siteId) ?? null;
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

  const routeToDestination = (
    start: TilePos,
    destination: CarterDestination,
  ): readonly TilePos[] | null => {
    switch (destination.kind) {
      case "building":
        return routeToBuilding(start, destination.buildingId);
      case "construction_site": {
        const site = findSite(state, destination.siteId);
        return site === null
          ? null
          : resolveRoadToConstructionSiteRoute(routeState(), start, site);
      }
    }
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
    fromBuildingToDestination: (fromBuildingId, destination) => {
      switch (destination.kind) {
        case "building":
          return delivery.betweenBuildings(fromBuildingId, destination.buildingId);
        case "construction_site": {
          const from = findBuilding(state.buildings, fromBuildingId);
          const to = findSite(state, destination.siteId);
          if (from === null || to === null) return null;
          const resolved = resolveBuildingToConstructionSiteRoute(
            routeState(),
            from,
            to,
          );
          pathCache = resolved.pathCache;
          return resolved.path;
        }
      }
    },
    fromTileToBuilding: routeToBuilding,
    fromTileToDestination: routeToDestination,
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
    isRoad: (tile) => getTile(state, tile)?.hasRoad === true,
  };

  return {
    delivery,
    roaming,
    getPathCache: () => pathCache,
  };
}
