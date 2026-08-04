import assert from "node:assert/strict";
import test from "node:test";

import { stepDistributors, type RoamingHouse, type RoamingRoutePort } from "../src/agents/roaming";
import type { DistributorWalker, TilePos } from "../src/agents/walker.types";
import { BALANCE } from "../src/content/balanceConfig";
import type { Building } from "../src/content/buildingConfig";

function building(
  id: string,
  input: { readonly bread?: number; readonly reservedBread?: number } = {},
): Building {
  return {
    id,
    kind: "granary",
    tx: 0,
    ty: 0,
    workers: 0,
    inventory: { bread: input.bread ?? 0 },
    reserved: input.reservedBread === undefined
      ? {}
      : { bread: input.reservedBread },
    stockReserved: {},
    productionProgress: 0,
  };
}

function house(id: string, tx: number, ty: number): RoamingHouse {
  return {
    buildingId: id,
    tx,
    ty,
    breadStock: 0,
    lastServicedTick: 0,
  };
}

function routes(input: {
  readonly returnPath?: readonly TilePos[];
}): RoamingRoutePort {
  return {
    homePath: () => null,
    returnPath: () => input.returnPath ?? null,
    neighbors: () => [],
  };
}

const fixedRngForJunction = () => ({
  next: () => 0,
  range: (min: number) => min,
  int: () => 0,
  pick: <T>(items: readonly T[]) => {
    const item = items[0];
    if (item === undefined) throw new RangeError("empty test pick");
    return item;
  },
});

const arrived = (walker: DistributorWalker): DistributorWalker => ({
  ...walker,
  position: walker.path.at(-1) ?? walker.position,
  pathIndex: Math.max(0, walker.path.length - 1),
});

test("a distributor returns after its roaming range and despawns at home", () => {
  // Given
  const walker = arrived({
    id: "distributor:granary-a:120",
    kind: "distributor",
    homeBuildingId: "granary-a",
    position: { tx: 4, ty: 0 },
    path: [{ tx: 3, ty: 0 }, { tx: 4, ty: 0 }],
    pathIndex: 1,
    previousTile: { tx: 3, ty: 0 },
    cargo: { resource: "bread", amount: 1 },
    spawnedTick: 120,
    phase: "roaming",
    junctionVisits: 0,
    tilesTravelled: BALANCE.DISTRIBUTOR_RANGE,
    priorTile: { tx: 3, ty: 0 },
  });

  // When
  const returning = stepDistributors({
    tick: 400,
    buildings: [building("granary-a")],
    walkers: [walker],
    houses: [],
    routes: routes({ returnPath: [{ tx: 4, ty: 0 }, { tx: 0, ty: 0 }] }),
    rngForJunction: fixedRngForJunction,
  });
  const finished = stepDistributors({
    tick: 401,
    buildings: returning.buildings,
    walkers: [arrived(returning.walkers[0] as DistributorWalker)],
    houses: [],
    routes: routes({}),
    rngForJunction: fixedRngForJunction,
  });

  // Then
  assert.equal((returning.walkers[0] as DistributorWalker).phase, "returning");
  assert.deepEqual(finished.walkers, []);
});

test("a returning distributor restores leftover bread to its home granary", () => {
  // Given
  const granary = building("granary-a", { bread: 5 });
  const returning = arrived({
    id: "distributor:granary-a:120",
    kind: "distributor",
    homeBuildingId: granary.id,
    position: { tx: 0, ty: 0 },
    path: [{ tx: 0, ty: 0 }],
    pathIndex: 0,
    previousTile: null,
    cargo: { resource: "bread", amount: 7 },
    spawnedTick: 120,
    phase: "returning",
    junctionVisits: 0,
    tilesTravelled: 40,
    priorTile: null,
  });

  // When
  const result = stepDistributors({
    tick: 500,
    buildings: [granary],
    walkers: [returning],
    houses: [house("home", 1, 0)],
    routes: routes({}),
    rngForJunction: fixedRngForJunction,
  });

  // Then
  assert.deepEqual(result.walkers, []);
  assert.equal(result.buildings[0]?.inventory.bread, 12);
  assert.equal(result.houses[0]?.breadStock, 0);
});

test("a returning distributor releases its home claim without exceeding granary capacity", () => {
  const granary = building("granary-a", { bread: 188, reservedBread: 12 });
  const returning = arrived({
    id: "distributor:granary-a:120",
    kind: "distributor",
    homeBuildingId: granary.id,
    position: { tx: 0, ty: 0 },
    path: [{ tx: 0, ty: 0 }],
    pathIndex: 0,
    previousTile: null,
    cargo: { resource: "bread", amount: 12 },
    spawnedTick: 120,
    phase: "returning",
    junctionVisits: 0,
    tilesTravelled: 40,
    priorTile: null,
  });

  const result = stepDistributors({
    tick: 501,
    buildings: [granary],
    walkers: [returning],
    houses: [],
    routes: routes({}),
    rngForJunction: fixedRngForJunction,
  });

  assert.deepEqual(result.walkers, []);
  assert.equal(result.buildings[0]?.inventory.bread, 200);
  assert.equal(result.buildings[0]?.reserved.bread ?? 0, 0);
});

test("an unreserved distributor waits rather than overfilling a full granary", () => {
  const granary = building("granary-a", { bread: 200 });
  const returning = arrived({
    id: "distributor:granary-a:120",
    kind: "distributor",
    homeBuildingId: granary.id,
    position: { tx: 0, ty: 0 },
    path: [{ tx: 0, ty: 0 }],
    pathIndex: 0,
    previousTile: null,
    cargo: { resource: "bread", amount: 12 },
    spawnedTick: 120,
    phase: "returning",
    junctionVisits: 0,
    tilesTravelled: 40,
    priorTile: null,
  });

  const result = stepDistributors({
    tick: 502,
    buildings: [granary],
    walkers: [returning],
    houses: [],
    routes: routes({}),
    rngForJunction: fixedRngForJunction,
  });

  assert.equal(result.walkers.length, 1);
  assert.deepEqual(result.walkers[0]?.cargo, { resource: "bread", amount: 12 });
  assert.equal(result.buildings[0]?.inventory.bread, 200);
});
