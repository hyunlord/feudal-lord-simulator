import assert from "node:assert/strict";
import test from "node:test";

import type { CarterWalker, Walker } from "../src/agents/walker.types";
import type { Building } from "../src/content/buildingConfig";
import type { ResourceType } from "../src/content/resourceConfig";
import { advanceTick } from "../src/engine/tick";
import type { GameState } from "../src/engine/engine.types";
import type { House } from "../src/population/population.types";
import type { Tile } from "../src/world/world.types";

function makeBuilding(input: {
  readonly id: string;
  readonly kind: Building["kind"];
  readonly tx?: number;
  readonly ty?: number;
  readonly workers?: number;
  readonly inventory?: Partial<Record<ResourceType, number>>;
  readonly productionProgress?: number;
}): Building {
  return {
    id: input.id,
    kind: input.kind,
    tx: input.tx ?? 0,
    ty: input.ty ?? 0,
    workers: input.workers ?? 0,
    inventory: input.inventory ?? {},
    reserved: {},
    stockReserved: {},
    productionProgress: input.productionProgress ?? 0,
  };
}

function makeHouse(input: {
  readonly buildingId: string;
  readonly residents: number;
  readonly hasWater?: boolean;
  readonly breadStock?: number;
  readonly lastServicedTick?: number;
}): House {
  return {
    buildingId: input.buildingId,
    level: 0,
    residents: input.residents,
    hasWater: input.hasWater ?? false,
    breadStock: input.breadStock ?? 0,
    lastServicedTick: input.lastServicedTick ?? 0,
    unmetRequirementTicks: 0,
  };
}

function makeState(input: {
  readonly buildings: readonly Building[];
  readonly houses?: readonly House[];
  readonly walkers?: readonly Walker[];
  readonly roads?: readonly [number, number][];
  readonly tick?: number;
  readonly width?: number;
  readonly height?: number;
}): GameState {
  const width = input.width ?? 8;
  const height = input.height ?? 8;
  const roadKeys = new Set(input.roads?.map(([tx, ty]) => `${tx},${ty}`) ?? []);
  return {
    tick: input.tick ?? 0,
    seed: 23,
    width,
    height,
    tiles: Array.from({ length: width * height }, (_unused, index): Tile => {
      const tx = index % width;
      const ty = Math.floor(index / width);
      const owner = input.buildings.find(
        (building) => building.tx === tx && building.ty === ty,
      );
      return {
        tx,
        ty,
        terrain: "grass",
        buildingId: owner?.id ?? null,
        hasRoad: roadKeys.has(`${tx},${ty}`),
      };
    }),
    buildings: [...input.buildings],
    houses: [...(input.houses ?? [])],
    walkers: [...(input.walkers ?? [])],
    population: input.houses?.reduce((total, house) => total + house.residents, 0) ?? 0,
    idleWorkers: 0,
    treasuryTimber: 0,
    roadRevision: 3,
    pathCache: {},
  };
}

function getBuilding(state: GameState, id: string): Building {
  const building = state.buildings.find((candidate) => candidate.id === id);
  if (building === undefined) {
    throw new RangeError(`Missing test building: ${id}`);
  }
  return building;
}

function totalResource(state: GameState, resource: ResourceType): number {
  const inBuildings = state.buildings.reduce(
    (total, building) => total + Math.max(0, building.inventory[resource] ?? 0),
    0,
  );
  const inCargo = state.walkers.reduce(
    (total, walker) =>
      total + (walker.cargo?.resource === resource ? walker.cargo.amount : 0),
    0,
  );
  return inBuildings + inCargo;
}

function returningCarter(homeBuildingId: string): CarterWalker {
  return {
    id: "carter:producer:previous",
    kind: "carter",
    mission: "deliver",
    phase: "returning",
    homeBuildingId,
    destinationBuildingId: "store",
    position: { tx: 1, ty: 1 },
    path: [{ tx: 1, ty: 1 }],
    pathIndex: 0,
    previousTile: null,
    cargo: null,
    spawnedTick: 1,
    reservation: {
      destinationBuildingId: "store",
      resource: "logs",
      amount: 0,
      sourceStockClaim: null,
    },
    cancellation: null,
  };
}

test("advanceTick leaves an under-staffed producer stopped", () => {
  const home = makeBuilding({ id: "home", kind: "house", tx: 4, ty: 4 });
  const farm = makeBuilding({
    id: "farm",
    kind: "wheat_farm",
    productionProgress: 12,
  });

  const next = advanceTick(
    makeState({
      buildings: [farm, home],
      houses: [makeHouse({ buildingId: home.id, residents: 7 })],
    }),
  );

  assert.equal(getBuilding(next, farm.id).workers, 3);
  assert.equal(getBuilding(next, farm.id).productionProgress, 12);
});

test("advanceTick steps an existing returning carter before spawning a new one", () => {
  const producer = makeBuilding({
    id: "producer",
    kind: "logging_camp",
    tx: 0,
    ty: 1,
    inventory: { logs: 8 },
  });
  const store = makeBuilding({ id: "store", kind: "storehouse", tx: 3, ty: 0 });

  const next = advanceTick(
    makeState({
      tick: 20,
      buildings: [producer, store],
      walkers: [returningCarter(producer.id)],
      roads: [[1, 1], [2, 1]],
    }),
  );

  assert.equal(next.walkers.length, 1);
  assert.equal(next.walkers[0]?.kind, "carter");
  assert.deepEqual(next.walkers[0]?.cargo, { resource: "logs", amount: 8 });
});

test("advanceTick returns deep-equal states for identical inputs", () => {
  const home = makeBuilding({ id: "home", kind: "house", tx: 4, ty: 4 });
  const farm = makeBuilding({ id: "farm", kind: "wheat_farm" });
  const initial = makeState({
    buildings: [farm, home],
    houses: [makeHouse({ buildingId: home.id, residents: 8 })],
  });

  assert.deepEqual(advanceTick(initial), advanceTick(initial));
});

test("advanceTick caches delivery road paths by road revision and building pair", () => {
  const producer = makeBuilding({
    id: "producer",
    kind: "logging_camp",
    tx: 0,
    ty: 1,
    inventory: { logs: 8 },
  });
  const store = makeBuilding({ id: "store", kind: "storehouse", tx: 3, ty: 0 });

  const next = advanceTick(
    makeState({
      buildings: [producer, store],
      roads: [[1, 1], [2, 1]],
    }),
  );

  assert.deepEqual(next.pathCache["road:3:producer->store"], [
    { tx: 1, ty: 1 },
    { tx: 2, ty: 1 },
  ]);
});

test("advanceTick keeps population as house census rather than walker count", () => {
  const home = makeBuilding({ id: "home", kind: "house", tx: 4, ty: 4 });
  const producer = makeBuilding({ id: "producer", kind: "logging_camp" });

  const next = advanceTick(
    makeState({
      buildings: [home, producer],
      houses: [makeHouse({ buildingId: home.id, residents: 6 })],
      walkers: [returningCarter(producer.id)],
    }),
  );

  assert.equal(next.population, 6);
  assert.notEqual(next.population, next.walkers.length);
});

test("advanceTick conserves resource units while cargo moves across ticks", () => {
  const producer = makeBuilding({
    id: "producer",
    kind: "logging_camp",
    tx: 0,
    ty: 1,
    inventory: { logs: 8 },
  });
  const store = makeBuilding({ id: "store", kind: "storehouse", tx: 3, ty: 0 });
  let current = makeState({
    buildings: [producer, store],
    roads: [[1, 1], [2, 1]],
  });

  current = advanceTick(current);
  current = advanceTick(current);

  assert.equal(totalResource(current, "logs"), 8);
});
