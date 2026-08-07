import assert from "node:assert/strict";
import test from "node:test";

import type { Building } from "../src/content/buildingConfig";
import type { ResourceType } from "../src/content/resourceConfig";
import { createConstructionSite } from "../src/economy/construction";
import type { ConstructionSite } from "../src/economy/construction";
import { advanceTick } from "../src/engine/tick";
import type { GameState } from "../src/engine/engine.types";
import type { House } from "../src/population/population.types";
import type { TileCoordinate } from "../src/world/grid";
import type { Tile } from "../src/world/world.types";

type Stock = Partial<Record<ResourceType, number>>;

function building(input: {
  readonly id: string;
  readonly kind: Building["kind"];
  readonly tx: number;
  readonly ty: number;
  readonly workers?: number;
  readonly inventory?: Stock;
  readonly reserved?: Stock;
  readonly stockReserved?: Stock;
  readonly productionProgress?: number;
}): Building {
  return {
    id: input.id,
    kind: input.kind,
    tx: input.tx,
    ty: input.ty,
    workers: input.workers ?? 0,
    inventory: input.inventory ?? {},
    reserved: input.reserved ?? {},
    stockReserved: input.stockReserved ?? {},
    productionProgress: input.productionProgress ?? 0,
  };
}

function road(tx: number, ty: number): TileCoordinate {
  return { tx, ty };
}

function isBuildingTile(coordinate: TileCoordinate, candidate: Building): boolean {
  const width = candidate.kind === "quarry" || candidate.kind === "storehouse" ? 2 : 1;
  const height = candidate.kind === "quarry" || candidate.kind === "storehouse" ? 2 : 1;
  return (
    coordinate.tx >= candidate.tx &&
    coordinate.tx < candidate.tx + width &&
    coordinate.ty >= candidate.ty &&
    coordinate.ty < candidate.ty + height
  );
}

const workforceHome = building({ id: "home", kind: "house", tx: 0, ty: 6 });
const workforceHouse: House = {
  buildingId: workforceHome.id,
  level: 0,
  residents: 14,
  hasWater: false,
  breadStock: 0,
  lastServicedTick: 0,
  unmetRequirementTicks: 0,
};

function state(input: {
  readonly buildings: readonly Building[];
  readonly roads: readonly TileCoordinate[];
  readonly rock?: readonly TileCoordinate[];
  readonly constructionSites?: readonly ConstructionSite[];
}): GameState {
  const width = 10;
  const height = 8;
  const roads = new Set(input.roads.map(({ tx, ty }) => `${tx},${ty}`));
  const rocks = new Set(input.rock?.map(({ tx, ty }) => `${tx},${ty}`) ?? []);
  const tiles: Tile[] = [];
  for (let ty = 0; ty < height; ty += 1) {
    for (let tx = 0; tx < width; tx += 1) {
      tiles.push({
        tx,
        ty,
        terrain: rocks.has(`${tx},${ty}`) ? "rock" : "grass",
        buildingId: input.buildings.find((candidate) => isBuildingTile({ tx, ty }, candidate))?.id ?? null,
        hasRoad: roads.has(`${tx},${ty}`),
      });
    }
  }
  return {
    tick: 0,
    seed: 9,
    width,
    height,
    tiles,
    buildings: [workforceHome, ...input.buildings],
    constructionSites: [...(input.constructionSites ?? [])],
    houses: [workforceHouse],
    walkers: [],
    population: workforceHouse.residents,
    idleWorkers: 0,
    treasuryTimber: 0,
    treasuryCoin: 0,
    wallTick: 0,
    era: "palisade",
    eraProclaimedTick: 0,
    palisade: null,
    forestHarvests: [],
    nextConstructionOrdinal: 1,
    roadRevision: 1,
    pathCache: {},
  };
}

function findBuilding(current: GameState, id: string): Building {
  const found = current.buildings.find((candidate) => candidate.id === id);
  assert.ok(found, `missing building ${id}`);
  return found;
}

function totalResource(current: GameState, resource: ResourceType): number {
  return current.buildings.reduce(
    (total, candidate) => total + (candidate.inventory[resource] ?? 0),
    0,
  ) + current.walkers.reduce(
    (total, walker) => total + (walker.cargo?.resource === resource ? walker.cargo.amount : 0),
    0,
  );
}

test("stone chain uses real production and connected carter delivery deterministically", () => {
  // Given
  const quarry = building({ id: "quarry", kind: "quarry", tx: 1, ty: 1, workers: 4 });
  const store = building({ id: "store", kind: "storehouse", tx: 5, ty: 0 });
  const masonry = building({ id: "masonry", kind: "masonry", tx: 8, ty: 1, workers: 3 });
  let current = state({
    buildings: [quarry, store, masonry],
    roads: [road(3, 1), road(4, 1), road(7, 1), road(6, 1)],
    rock: [road(0, 1)],
  });

  // When
  for (let tick = 0; tick < 60; tick += 1) {
    current = advanceTick(current);
  }
  const afterSixty = current;
  for (let tick = 0; tick < 240; tick += 1) {
    current = advanceTick(current);
  }

  // Then
  assert.equal(totalResource(afterSixty, "stone_raw"), 1);
  assert.equal(findBuilding(current, "store").inventory.stone, 2);
  assert.equal(findBuilding(current, "masonry").inventory.stone_raw ?? 0, 0);
  assert.equal(totalResource(current, "coin"), 0);
  assert.deepEqual(current, runSameScenario());
});

function runSameScenario(): GameState {
  const quarry = building({ id: "quarry", kind: "quarry", tx: 1, ty: 1, workers: 4 });
  const store = building({ id: "store", kind: "storehouse", tx: 5, ty: 0 });
  const masonry = building({ id: "masonry", kind: "masonry", tx: 8, ty: 1, workers: 3 });
  let current = state({
    buildings: [quarry, store, masonry],
    roads: [road(3, 1), road(4, 1), road(7, 1), road(6, 1)],
    rock: [road(0, 1)],
  });
  for (let tick = 0; tick < 300; tick += 1) {
    current = advanceTick(current);
  }
  return current;
}

test("severed stone road stalls delivery without corrupting reservations or inventory", () => {
  // Given
  const quarry = building({ id: "quarry", kind: "quarry", tx: 1, ty: 1, workers: 4, inventory: { stone_raw: 2 } });
  const masonry = building({ id: "masonry", kind: "masonry", tx: 8, ty: 1, workers: 3 });
  const disconnected = state({
    buildings: [quarry, masonry],
    roads: [road(3, 1), road(7, 1)],
    rock: [road(0, 1)],
  });

  // When
  const next = advanceTick(disconnected);

  // Then
  assert.deepEqual(next.walkers, []);
  assert.deepEqual(findBuilding(next, "quarry").inventory, { stone_raw: 2 });
  assert.deepEqual(findBuilding(next, "quarry").stockReserved, {});
  assert.deepEqual(findBuilding(next, "masonry").reserved, {});
});

test("stone construction delivery uses existing site reservations and real road graph", () => {
  // Given
  const source = building({ id: "store", kind: "storehouse", tx: 1, ty: 1, inventory: { stone: 10 } });
  const site = {
    ...createConstructionSite({ ordinal: 1, kind: "masonry", tx: 6, ty: 1, startedTick: 0 }),
    required: { stone: 4 },
  };
  const current = state({
    buildings: [source],
    roads: [road(3, 1), road(4, 1), road(5, 1)],
    constructionSites: [site],
  });

  // When
  const spawned = advanceTick(current);

  // Then
  const carter = spawned.walkers.find((walker) => walker.kind === "carter");
  assert.equal(carter?.kind, "carter");
  assert.deepEqual(carter?.cargo, { resource: "stone", amount: 4 });
  assert.deepEqual(spawned.constructionSites[0]?.reserved, { stone: 4 });
  assert.equal(findBuilding(spawned, "store").inventory.stone, 6);
});
