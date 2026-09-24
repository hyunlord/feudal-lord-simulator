import { nextHouseDemandTile } from "./roamingDemand";
import { BALANCE } from "../content/balanceConfig";
import { serviceHouses } from "./roamingService";
import type { Building } from "../content/buildingConfig";
import type { Rng } from "../content/random";
import {
  currentRoadTile,
  hasArrivedAtPathEnd,
  lastReachedRoadTile,
  remainingPathCanBeTraversed,
  stepWalkerAlongPath,
} from "./movement";
import {
  releaseBreadCapacity,
  restoreBread,
} from "./roamingCommon";
import type {
  RoamingDeliveryEvent,
  RoamingHouse,
  RoamingJunctionInput,
  RoamingRoutePort,
  RoamingStepInput,
  RoamingStepResult,
} from "./roamingTypes";
import type { DistributorWalker, TilePos, Walker } from "./walker.types";

const sameTile = (left: TilePos, right: TilePos): boolean =>
  left.tx === right.tx && left.ty === right.ty;

function routeHome(
  walker: DistributorWalker,
  routes: RoamingRoutePort,
): DistributorWalker {
  const current = currentRoadTile(walker) ?? walker.position;
  const path = routes.returnPath(current, walker.homeBuildingId) ?? [current];
  return {
    ...walker,
    phase: "returning",
    path,
    pathIndex: 0,
    position: path[0] ?? current,
  };
}

function chooseNextTile(
  tick: number,
  walker: DistributorWalker,
  routes: RoamingRoutePort,
  rngForJunction: (input: RoamingJunctionInput) => Rng,
): { readonly tile: TilePos | null; readonly junction: boolean } {
  const current = currentRoadTile(walker) ?? walker.position;
  const neighbors = routes.neighbors(current);
  if (neighbors.length === 0) return { tile: null, junction: false };
  const priorTile = walker.priorTile;
  const alternatives = priorTile === null || neighbors.length === 1
    ? neighbors
    : neighbors.filter((neighbor) => !sameTile(neighbor, priorTile));
  if (neighbors.length === 1) {
    return { tile: neighbors[0] ?? null, junction: false };
  }
  if (priorTile !== null && neighbors.length === 2 && alternatives.length > 0) {
    return { tile: alternatives[0] ?? null, junction: false };
  }
  const weighted = priorTile === null || alternatives.length === neighbors.length
    ? alternatives
    : [priorTile, ...alternatives, ...alternatives];
  const rng = rngForJunction({
    walkerId: walker.id,
    tick,
    tile: current,
    visitCount: walker.junctionVisits,
  });
  return {
    tile: weighted[rng.int(0, weighted.length)] ?? weighted[0] ?? null,
    junction: neighbors.length > 2,
  };
}

function continueRoaming(
  houses: readonly RoamingHouse[],
  tick: number,
  walker: DistributorWalker,
  routes: RoamingRoutePort,
  rngForJunction: (input: RoamingJunctionInput) => Rng,
): DistributorWalker {
  if ((walker.cargo?.amount ?? 0) === 0 || walker.tilesTravelled >= BALANCE.DISTRIBUTOR_RANGE) {
    return routeHome(walker, routes);
  }
  const current = currentRoadTile(walker) ?? walker.position;
  const demand = nextHouseDemandTile(current, houses, routes, BALANCE.DISTRIBUTOR_RANGE - walker.tilesTravelled);
  const next = demand === null
    ? chooseNextTile(tick, walker, routes, rngForJunction)
    : { tile: demand, junction: routes.neighbors(current).length > 2 };
  if (next.tile === null) return routeHome(walker, routes);
  return {
    ...walker,
    path: [current, next.tile],
    pathIndex: 0,
    position: current,
    priorTile: current,
    junctionVisits: next.junction ? walker.junctionVisits + 1 : walker.junctionVisits,
    tilesTravelled: walker.tilesTravelled + 1,
  };
}

function distributorRouteIsIntact(
  walker: DistributorWalker,
  routes: RoamingRoutePort,
): boolean {
  const remainingPathIsRoad = walker.path
    .slice(Math.max(0, walker.pathIndex))
    .every((tile) => routes.isRoad(tile));
  if (!remainingPathIsRoad || walker.phase === "returning") return remainingPathIsRoad;

  const current = currentRoadTile(walker) ?? walker.position;
  return routes.returnPath(current, walker.homeBuildingId) !== null;
}

function stopDistributor(
  buildings: readonly Building[],
  walker: DistributorWalker,
): {
  readonly buildings: readonly Building[];
  readonly walker: DistributorWalker | null;
} {
  const restored = restoreBread(buildings, walker);
  const current = lastReachedRoadTile(walker) ?? walker.position;
  return {
    buildings: restored.buildings,
    walker: restored.remaining === 0 ? null : {
      ...walker, phase: "returning", path: [current], pathIndex: 0,
      position: current, previousTile: null,
      cargo: { resource: "bread", amount: restored.remaining },
    },
  };
}

function stepDistributor(
  tick: number,
  buildings: readonly Building[],
  walker: DistributorWalker,
  houses: readonly RoamingHouse[],
  routes: RoamingRoutePort,
  rngForJunction: (input: RoamingJunctionInput) => Rng,
): {
  readonly buildings: readonly Building[];
  readonly houses: readonly RoamingHouse[];
  readonly walker: DistributorWalker | null;
  readonly deliveryEvents: readonly RoamingDeliveryEvent[];
} {
  if (walker.phase !== 'returning' && buildings.some(building => building.id === walker.homeBuildingId && building.operationPaused === true)) {
    return { buildings, houses, walker: routeHome(walker, routes), deliveryEvents: [] };
  }
  if (!remainingPathCanBeTraversed(walker, routes.canTraverse)) {
    const current = lastReachedRoadTile(walker) ?? walker.position;
    const path = routes.returnPath(current, walker.homeBuildingId);
    if (path === null) return { ...stopDistributor(buildings, walker), houses, deliveryEvents: [] };
    return { buildings, houses, deliveryEvents: [], walker: {
      ...walker, phase: "returning", path, pathIndex: 0,
      position: path[0] ?? current, previousTile: null,
    } };
  }
  if (!distributorRouteIsIntact(walker, routes)) {
    return { ...stopDistributor(buildings, walker), houses, deliveryEvents: [] };
  }

  const moved = stepWalkerAlongPath(walker, BALANCE.DISTRIBUTOR_SPEED);
  if (!hasArrivedAtPathEnd(moved)) return { buildings, houses, walker: moved, deliveryEvents: [] };
  if (moved.phase === "returning") {
    const restored = restoreBread(buildings, moved);
    return {
      buildings: restored.buildings,
      houses,
      deliveryEvents: [],
      walker: restored.remaining === 0
        ? null
        : {
            ...moved,
            cargo: { resource: "bread", amount: restored.remaining },
          },
    };
  }
  const current = currentRoadTile(moved) ?? moved.position;
  const cargoBeforeService = moved.cargo?.amount ?? 0;
  const serviced = serviceHouses({ tick, houses, walker: moved, tile: current, routes });
  const cargoAfterService = serviced.walker.cargo?.amount ?? 0;
  const buildingsAfterService = releaseBreadCapacity(
    buildings,
    moved.homeBuildingId,
    cargoBeforeService - cargoAfterService,
  );
  return {
    buildings: buildingsAfterService,
    houses: serviced.houses,
    walker: continueRoaming(serviced.houses, tick, serviced.walker, routes, rngForJunction),
    deliveryEvents: serviced.deliveryEvents,
  };
}

export function stepDistributors(input: RoamingStepInput): RoamingStepResult {
  let buildings = input.buildings;
  let houses = input.houses;
  const walkers: Walker[] = [];
  const deliveryEvents: RoamingDeliveryEvent[] = [];

  for (const walker of input.walkers) {
    if (walker.kind !== "distributor") {
      walkers.push(walker);
      continue;
    }
    const result = stepDistributor(
      input.tick,
      buildings,
      walker,
      houses,
      input.routes,
      input.rngForJunction,
    );
    buildings = result.buildings;
    houses = result.houses;
    deliveryEvents.push(...result.deliveryEvents);
    if (result.walker !== null) walkers.push(result.walker);
  }

  return { buildings, houses, walkers, deliveryEvents };
}
