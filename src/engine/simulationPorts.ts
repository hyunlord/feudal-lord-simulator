import { eligibleRoamingExits } from './distributorAccess';
import { bestHouseDemand, compareHouseDemand } from '../agents/roamingDemand';
import { buildingFootprint } from '../geometry/buildingFootprint';
import { BALANCE } from '../content/balanceConfig';
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
import { canTraverseRoadBoundary } from "../world/bridges";
import { getOrthogonalRoadNeighbors } from "../world/roadGraph";
import type { GameState, RoadPathCache } from "./engine.types";
import {
  buildingRoadAccessTiles,
  constructionSiteRoadAccessTiles,
  resolveBuildingToConstructionSiteRoute,
  resolveBuildingRoute,
  resolveRoadToConstructionSiteRoute,
  resolveRoadToBuildingRoute,
} from "./routing";
import type { CarterDestination } from "../agents/walker.types";
import { canTraverseWallCarryEdge, isWallCarryTile, wallCarrySiteAccessTile } from './wallCarryRoute';
import { stoneReplacementSiteId } from './era';

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
    canAccessDestination: (tile, destination) => {
      const accesses = (() => {
        switch (destination.kind) {
          case "building": {
            const target = findBuilding(state.buildings, destination.buildingId);
            return target === null ? [] : buildingRoadAccessTiles(state, target);
          }
          case "construction_site": {
            const target = findSite(state, destination.siteId);
            if (target !== null && (target.kind === 'palisade_segment' || target.kind === 'stone_wall_segment')
              && wallCarrySiteAccessTile(state, target, tile)) return [tile];
            return target === null ? [] : constructionSiteRoadAccessTiles(state, target);
          }
        }
      })();
      return accesses.some((access) => access.tx === tile.tx && access.ty === tile.ty);
    },
    canCarryForDestination: (tile, destination) => {
      if (destination.kind !== 'construction_site') return false;
      const site = findSite(state, destination.siteId);
      const stillOnWall = state.palisade?.segments.some(segment =>
        segment.id === destination.siteId
        || segment.constructionSiteId === destination.siteId
        || segment.replacementConstructionSiteId === destination.siteId
        || stoneReplacementSiteId(segment.id) === destination.siteId) === true;
      return (site?.kind === 'palisade_segment' || site?.kind === 'stone_wall_segment' || stillOnWall)
        && isWallCarryTile(state, tile);
    },
    fromTileToBuilding: routeToBuilding,
    fromTileToDestination: routeToDestination,
    isRoad: (tile) => getTile(state, tile)?.hasRoad === true,
    canTraverse: (from, to) => canTraverseRoadBoundary(state, from, to)
      || canTraverseWallCarryEdge(state, from, to),
  };

  const roaming: RoamingRoutePort = {
    homePath: (buildingId) => {
      const building = findBuilding(state.buildings, buildingId);
      if (building === null) return null;
      const exits = eligibleRoamingExits(state, building);
      let access = exits[0] ?? null;
      if (building.kind === 'granary') {
        const houses = state.houses.flatMap(house => {
          const home = findBuilding(state.buildings, house.buildingId);
          return home === null ? [] : [{ ...house, tx: home.tx, ty: home.ty, ...buildingFootprint(home) }];
        });
        let best = access === null ? null : bestHouseDemand(access, houses, roaming, BALANCE.DISTRIBUTOR_RANGE, 0);
        for (const exit of exits.slice(1)) {
          const demand = bestHouseDemand(exit, houses, roaming, BALANCE.DISTRIBUTOR_RANGE, 0);
          if (demand !== null && (best === null || compareHouseDemand(demand, best) < 0)) {
            access = exit; best = demand;
          }
        }
      }
      return access === null ? null : [access];
    },
    returnPath: routeToBuilding,
    servicePath: (start, house) => routeToBuilding(start, house.buildingId),
    neighbors: (tile) => getOrthogonalRoadNeighbors(state, tile),
    canServiceHouse: (tile, house) => canTraverseRoadBoundary(state, tile, {
      tx: Math.max(house.tx, Math.min(tile.tx, house.tx + (house.width ?? 1) - 1)),
      ty: Math.max(house.ty, Math.min(tile.ty, house.ty + (house.height ?? 1) - 1)),
    }),
    isRoad: (tile) => getTile(state, tile)?.hasRoad === true,
    canTraverse: (from, to) => canTraverseRoadBoundary(state, from, to),
  };

  return {
    delivery,
    roaming,
    getPathCache: () => pathCache,
  };
}
