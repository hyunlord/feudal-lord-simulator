import { BALANCE } from "../content/balanceConfig";
import type { Building } from "../content/buildingConfig";
import type { Rng } from "../content/random";
import {
  currentRoadTile,
  hasArrivedAtPathEnd,
  stepWalkerAlongPath,
} from "./movement";
import { restoreBread } from "./roamingCommon";
import type {
  RoamingHouse,
  RoamingJunctionInput,
  RoamingRoutePort,
  RoamingStepInput,
  RoamingStepResult,
} from "./roamingTypes";
import type { DistributorWalker, TilePos, Walker } from "./walker.types";

const sameTile = (left: TilePos, right: TilePos): boolean =>
  left.tx === right.tx && left.ty === right.ty;

function manhattan(left: TilePos, right: TilePos): number {
  return Math.abs(left.tx - right.tx) + Math.abs(left.ty - right.ty);
}

function serviceHouses(params: {
  readonly tick: number;
  readonly houses: readonly RoamingHouse[];
  readonly walker: DistributorWalker;
  readonly tile: TilePos;
}): { readonly houses: readonly RoamingHouse[]; readonly walker: DistributorWalker } {
  let remaining = params.walker.cargo?.amount ?? 0;
  const houses = params.houses.map((house) => {
    if (remaining === 0 || manhattan(house, params.tile) > 1) return house;
    remaining -= 1;
    return {
      ...house,
      breadStock: house.breadStock + 1,
      lastServicedTick: params.tick,
    };
  });
  return {
    houses,
    walker: {
      ...params.walker,
      cargo: remaining > 0 ? { resource: "bread", amount: remaining } : null,
    },
  };
}

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
  tick: number,
  walker: DistributorWalker,
  routes: RoamingRoutePort,
  rngForJunction: (input: RoamingJunctionInput) => Rng,
): DistributorWalker {
  if ((walker.cargo?.amount ?? 0) === 0 || walker.tilesTravelled >= BALANCE.DISTRIBUTOR_RANGE) {
    return routeHome(walker, routes);
  }
  const current = currentRoadTile(walker) ?? walker.position;
  const next = chooseNextTile(tick, walker, routes, rngForJunction);
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
} {
  const moved = stepWalkerAlongPath(walker, BALANCE.DISTRIBUTOR_SPEED);
  if (!hasArrivedAtPathEnd(moved)) return { buildings, houses, walker: moved };
  if (moved.phase === "returning") {
    return { buildings: restoreBread(buildings, moved), houses, walker: null };
  }
  const current = currentRoadTile(moved) ?? moved.position;
  const serviced = serviceHouses({ tick, houses, walker: moved, tile: current });
  return {
    buildings,
    houses: serviced.houses,
    walker: continueRoaming(tick, serviced.walker, routes, rngForJunction),
  };
}

export function stepDistributors(input: RoamingStepInput): RoamingStepResult {
  let buildings = input.buildings;
  let houses = input.houses;
  const walkers: Walker[] = [];

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
    if (result.walker !== null) walkers.push(result.walker);
  }

  return { buildings, houses, walkers };
}
