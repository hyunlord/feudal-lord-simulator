import type { IntakeRules } from "../economy/storage";
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
import { canTraverseRoadBoundary, isFordRoad } from "../world/bridges";
import { getOrthogonalRoadNeighbors } from "../world/roadGraph";
import type { GameState, RoadPathCache } from "./engine.types";
import {
  buildingRoadAccessTiles,
  constructionSiteRoadAccessTiles,
  resolveBuildingToConstructionSiteRoute,
  resolveBuildingRoute,
  resolveRoadToConstructionSiteRoute,
  resolveRoadToBuildingRoute,
  type RouteResolution,
} from "./routing";
import type { CarterDestination } from "../agents/walker.types";
import { canTraverseWallCarryEdge, isWallCarryTile, wallCarrySiteAccessTile } from './wallCarryRoute';
import { stoneReplacementSiteId } from './era';
import { buildingFootprintDistance } from '../geometry/buildingDistance';

export interface SimulationRoutePorts {
  readonly delivery: DeliveryRoutePort;
  readonly roaming: RoamingRoutePort;
  readonly getPathCache: () => RoadPathCache;
}



function stateWithCache(
  state: GameState,
  pathCache: RoadPathCache,
): GameState {
  return { ...state, pathCache };
}

export function createDeliveryInventoryPort(intakeRules?: IntakeRules): DeliveryInventoryPort {
  return {
    ...(intakeRules === undefined ? {} : { intakeRules }),
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
  // SIM-SPEED ①b: buildings and sites by id, indexed once for the port (its state never changes) — `find` over every
  // building twice per route asked was 8 % of a late-game lord year (2026-10-17 profile). The first of an id wins, as
  // `find` returns the first.
  let buildingIndex: Map<string, Building> | null = null;
  let siteIndex: Map<string, GameState["constructionSites"][number]> | null = null;
  const buildingById = (buildingId: string): Building | null => {
    if (buildingIndex === null) { buildingIndex = new Map(); for (const building of state.buildings) if (!buildingIndex.has(building.id)) buildingIndex.set(building.id, building); }
    return buildingIndex.get(buildingId) ?? null;
  };
  const siteById = (siteId: string) => {
    if (siteIndex === null) { siteIndex = new Map(); for (const site of state.constructionSites) if (!siteIndex.has(site.id)) siteIndex.set(site.id, site); }
    return siteIndex.get(siteId) ?? null;
  };
  let pathCache = state.pathCache;
  // SIM-SPEED: the port's routes go into one copy of the cache it owns, in the order they are found — the same entries
  // and key order as copying the whole cache on every miss (resolution.pathCache), which cost 9 % of a 60-year run
  // (each key carries the wall's signature). Once the cache is handed out (getPathCache), the next miss copies again.
  let owned = false;
  const remember = (resolved: RouteResolution) => {
    if (resolved.added === undefined) return;
    if (!owned) { pathCache = { ...pathCache }; owned = true; }
    (pathCache as Record<string, RoadPathCache[string]>)[resolved.added.key] = resolved.added.path;
  };
  // SMOOTH-2E: one copy of the state per cache the routes have made (the state is immutable), not one per lookup.
  let routed: GameState | null = null;
  const routeState = (): GameState => routed !== null && routed.pathCache === pathCache ? routed : (routed = stateWithCache(state, pathCache));

  const routeToBuilding = (
    start: TilePos,
    toBuildingId: string,
  ): readonly TilePos[] | null => {
    const destination = buildingById(toBuildingId);
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
        const site = siteById(destination.siteId);
        return site === null
          ? null
          : resolveRoadToConstructionSiteRoute(routeState(), start, site);
      }
    }
  };

  // FOOD-DIST (lord mode, the user's ruling 2026-10-18): the lived-in houses each granary serves — those nearer it than
  // any other granary (footprint distance, then id) — counted once for the port (its state never changes).
  let served: Map<string, number> | null = null;
  const breadSpread = (granaryId: string): number => {
    if (served === null) {
      served = new Map();
      const granaries = state.buildings.filter(building => building.kind === 'granary');
      for (const house of state.houses) {
        if (house.residents <= 0) continue;
        const home = buildingById(house.buildingId);
        if (home === null) continue;
        let best: Building | null = null; let bestDistance = Infinity;
        for (const granary of granaries) {
          const distance = buildingFootprintDistance(home, granary);
          if (distance < bestDistance || (distance === bestDistance && best !== null && granary.id < best.id)) { best = granary; bestDistance = distance; }
        }
        if (best !== null) served.set(best.id, (served.get(best.id) ?? 0) + 1);
      }
    }
    return served.get(granaryId) ?? 0;
  };

  const delivery: DeliveryRoutePort = {
    ...(state.agency === undefined ? {} : { breadSpread }),
    betweenBuildings: (fromBuildingId, toBuildingId) => {
      const from = buildingById(fromBuildingId);
      const to = buildingById(toBuildingId);
      if (from === null || to === null) return null;

      const resolved = resolveBuildingRoute(routeState(), from, to);
      remember(resolved);
      return resolved.path;
    },
    fromBuildingToDestination: (fromBuildingId, destination) => {
      switch (destination.kind) {
        case "building":
          return delivery.betweenBuildings(fromBuildingId, destination.buildingId);
        case "construction_site": {
          const from = buildingById(fromBuildingId);
          const to = siteById(destination.siteId);
          if (from === null || to === null) return null;
          const resolved = resolveBuildingToConstructionSiteRoute(
            routeState(),
            from,
            to,
          );
          remember(resolved);
          return resolved.path;
        }
      }
    },
    canAccessDestination: (tile, destination) => {
      const accesses = (() => {
        switch (destination.kind) {
          case "building": {
            const target = buildingById(destination.buildingId);
            return target === null ? [] : buildingRoadAccessTiles(state, target);
          }
          case "construction_site": {
            const target = siteById(destination.siteId);
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
      const site = siteById(destination.siteId);
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
    isFord: (tile) => isFordRoad(state, tile),
  };

  const roaming: RoamingRoutePort = {
    homePath: (buildingId) => {
      const building = buildingById(buildingId);
      if (building === null) return null;
      const exits = eligibleRoamingExits(state, building);
      let access = exits[0] ?? null;
      if (building.kind === 'granary') {
        const houses = state.houses.flatMap(house => {
          const home = buildingById(house.buildingId);
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
    isFord: (tile) => isFordRoad(state, tile),
  };

  return {
    delivery,
    roaming,
    getPathCache: () => { owned = false; return pathCache; },
  };
}
