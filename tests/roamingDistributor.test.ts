import assert from "node:assert/strict";
import test from "node:test";

import type { Rng } from "../src/content/random";
import { BALANCE } from "../src/content/balanceConfig";
import type { Building } from "../src/content/buildingConfig";
import {
  spawnDistributors,
  stepDistributors,
  type RoamingHouse,
  type RoamingJunctionInput,
  type RoamingRoutePort,
} from "../src/agents/roaming";
import type { DistributorWalker, TilePos } from "../src/agents/walker.types";

function building(
  id: string,
  input: { readonly bread?: number } = {},
): Building {
  return {
    id,
    kind: "granary",
    tx: 0,
    ty: 0,
    workers: 0,
    inventory: { bread: input.bread ?? 0 },
    reserved: {},
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

function fixedRng(index: number): Rng {
  return {
    next: () => 0,
    range: (min) => min,
    int: () => index,
    pick: (items) => {
      const item = items[index] ?? items[0];
      if (item === undefined) throw new RangeError("empty test pick");
      return item;
    },
  };
}

const fixedRngForJunction = (index: number) =>
  (_input: RoamingJunctionInput): Rng => fixedRng(index);

const key = (tile: TilePos): string => `${tile.tx},${tile.ty}`;

function routes(input: {
  readonly homePath?: readonly TilePos[];
  readonly returnPath?: readonly TilePos[];
  readonly neighbors?: Readonly<Record<string, readonly TilePos[]>>;
}): RoamingRoutePort {
  return {
    homePath: () => input.homePath ?? null,
    returnPath: (tile) => input.returnPath ?? [tile],
    neighbors: (tile) => input.neighbors?.[key(tile)] ?? [],
    isRoad: () => true,
  };
}

const arrived = (walker: DistributorWalker): DistributorWalker => ({
  ...walker,
  position: walker.path.at(-1) ?? walker.position,
  pathIndex: Math.max(0, walker.path.length - 1),
});

test("granary spawns one bread distributor on the interval while respecting max active walkers", () => {
  // Given
  const granary = building("granary-a", { bread: 20 });
  const port = routes({ homePath: [{ tx: 0, ty: 0 }] });

  // When
  const first = spawnDistributors({
    tick: BALANCE.DISTRIBUTOR_INTERVAL,
    buildings: [granary],
    walkers: [],
    routes: port,
  });
  const capped = spawnDistributors({
    tick: BALANCE.DISTRIBUTOR_INTERVAL * 2,
    buildings: first.buildings,
    walkers: [
      ...first.walkers,
      { ...(first.walkers[0] as DistributorWalker), id: "distributor:granary-a:old" },
    ],
    routes: port,
  });

  // Then
  assert.equal(first.walkers.length, 1);
  assert.deepEqual(first.walkers[0]?.cargo, {
    resource: "bread",
    amount: BALANCE.DISTRIBUTOR_CAPACITY,
  });
  assert.equal(first.buildings[0]?.inventory.bread, 8);
  assert.equal(first.buildings[0]?.reserved.bread, 12);
  assert.equal(capped.walkers.length, 2);
  assert.equal(capped.buildings[0]?.inventory.bread, 8);
});

test("a roaming distributor picks a deterministic non-reverse road at a junction", () => {
  // Given
  const walker = arrived({
    id: "distributor:granary-a:120",
    kind: "distributor",
    homeBuildingId: "granary-a",
    position: { tx: 1, ty: 0 },
    path: [{ tx: 0, ty: 0 }, { tx: 1, ty: 0 }],
    pathIndex: 1,
    previousTile: { tx: 0, ty: 0 },
    cargo: { resource: "bread", amount: 12 },
    spawnedTick: 120,
    phase: "roaming",
    junctionVisits: 0,
    tilesTravelled: 1,
    priorTile: { tx: 0, ty: 0 },
  });

  // When
  const result = stepDistributors({
    tick: 121,
    buildings: [building("granary-a")],
    walkers: [walker],
    houses: [],
    routes: routes({
      neighbors: {
        "1,0": [
          { tx: 0, ty: 0 },
          { tx: 1, ty: 1 },
          { tx: 2, ty: 0 },
        ],
      },
    }),
    rngForJunction: fixedRngForJunction(2),
  });
  const moved = result.walkers[0] as DistributorWalker;

  // Then
  assert.deepEqual(moved.path, [{ tx: 1, ty: 0 }, { tx: 2, ty: 0 }]);
  assert.deepEqual(moved.priorTile, { tx: 1, ty: 0 });
  assert.equal(moved.junctionVisits, 1);
  assert.equal(moved.tilesTravelled, 2);
});

test("a roaming distributor gives reverse a low deterministic weight instead of banning it", () => {
  // Given
  const walker = arrived({
    id: "distributor:granary-a:120",
    kind: "distributor",
    homeBuildingId: "granary-a",
    position: { tx: 1, ty: 0 },
    path: [{ tx: 0, ty: 0 }, { tx: 1, ty: 0 }],
    pathIndex: 1,
    previousTile: { tx: 0, ty: 0 },
    cargo: { resource: "bread", amount: 12 },
    spawnedTick: 120,
    phase: "roaming",
    junctionVisits: 0,
    tilesTravelled: 1,
    priorTile: { tx: 0, ty: 0 },
  });

  // When
  const result = stepDistributors({
    tick: 122,
    buildings: [building("granary-a")],
    walkers: [walker],
    houses: [],
    routes: routes({
      neighbors: {
        "1,0": [
          { tx: 0, ty: 0 },
          { tx: 1, ty: 1 },
          { tx: 2, ty: 0 },
        ],
      },
    }),
    rngForJunction: fixedRngForJunction(0),
  });

  // Then
  assert.deepEqual((result.walkers[0] as DistributorWalker).path, [
    { tx: 1, ty: 0 },
    { tx: 0, ty: 0 },
  ]);
});

test("a distributor continues forward on an ordinary road without a random junction choice", () => {
  const walker = arrived({
    id: "distributor:granary-a:120",
    kind: "distributor",
    homeBuildingId: "granary-a",
    position: { tx: 1, ty: 0 },
    path: [{ tx: 0, ty: 0 }, { tx: 1, ty: 0 }],
    pathIndex: 1,
    previousTile: { tx: 0, ty: 0 },
    cargo: { resource: "bread", amount: 12 },
    spawnedTick: 120,
    phase: "roaming",
    junctionVisits: 0,
    tilesTravelled: 1,
    priorTile: { tx: 0, ty: 0 },
  });
  let randomChoices = 0;

  const result = stepDistributors({
    tick: 122,
    buildings: [building("granary-a")],
    walkers: [walker],
    houses: [],
    routes: routes({
      neighbors: {
        "1,0": [{ tx: 0, ty: 0 }, { tx: 2, ty: 0 }],
      },
    }),
    rngForJunction: () => {
      randomChoices += 1;
      return fixedRng(0);
    },
  });

  assert.equal(randomChoices, 0);
  assert.deepEqual((result.walkers[0] as DistributorWalker).path, [
    { tx: 1, ty: 0 },
    { tx: 2, ty: 0 },
  ]);
});

test("a distributor serves only houses adjacent to its actual route and does not seek hunger", () => {
  // Given
  const walker = arrived({
    id: "distributor:granary-a:120",
    kind: "distributor",
    homeBuildingId: "granary-a",
    position: { tx: 3, ty: 2 },
    path: [{ tx: 2, ty: 2 }, { tx: 3, ty: 2 }],
    pathIndex: 1,
    previousTile: { tx: 2, ty: 2 },
    cargo: { resource: "bread", amount: 12 },
    spawnedTick: 120,
    phase: "roaming",
    junctionVisits: 0,
    tilesTravelled: 1,
    priorTile: { tx: 2, ty: 2 },
  });

  // When
  const result = stepDistributors({
    tick: 300,
    buildings: [building("granary-a")],
    walkers: [walker],
    houses: [house("near", 3, 3), house("off-route-hungry", 5, 2)],
    routes: routes({ neighbors: { "3,2": [{ tx: 4, ty: 2 }] } }),
    rngForJunction: fixedRngForJunction(0),
  });

  // Then
  assert.equal(result.houses.find(({ buildingId }) => buildingId === "near")?.breadStock, 1);
  assert.equal(
    result.houses.find(({ buildingId }) => buildingId === "near")?.lastServicedTick,
    300,
  );
  assert.equal(
    result.houses.find(({ buildingId }) => buildingId === "off-route-hungry")?.breadStock,
    0,
  );
  assert.deepEqual(result.walkers[0]?.cargo, { resource: "bread", amount: 11 });
});
