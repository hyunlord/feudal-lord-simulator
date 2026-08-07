import assert from "node:assert/strict";
import test from "node:test";

import { BUILDING_CONFIG_BY_KIND } from "../src/content/buildingConfig";
import type { Building } from "../src/economy/economy.types";
import {
  STUMP_OLD_AFTER_TICKS,
  forestHarvestsAfterProduction,
  stumpAgeAt,
} from "../src/engine/forestHarvests";
import { runProduction } from "../src/engine/tick";
import type { GameState } from "../src/engine/engine.types";
import { objectRenderItemsForFrame } from "../src/render/renderObjectFrameCache";
import { hashEconomyState } from "../scripts/economyHarnessSerializer";
import type { Tile } from "../src/world/world.types";

function tile(tx: number, ty: number, terrain: Tile["terrain"] = "grass"): Tile {
  return { tx, ty, terrain, buildingId: null, hasRoad: false };
}

function forest(tx: number, ty: number): Tile {
  return tile(tx, ty, "forest");
}

function building(id: string, patch: Partial<Building> = {}): Building {
  return {
    id,
    kind: "logging_camp",
    tx: 2,
    ty: 2,
    workers: BUILDING_CONFIG_BY_KIND.logging_camp.workersRequired,
    inventory: {},
    reserved: {},
    stockReserved: {},
    productionProgress: BUILDING_CONFIG_BY_KIND.logging_camp.production?.ticksPerOutput ?? 0,
    ...patch,
  };
}

function state(input: {
  readonly tick?: number;
  readonly tiles?: readonly Tile[];
  readonly buildings?: readonly Building[];
  readonly forestHarvests?: GameState["forestHarvests"];
} = {}): GameState {
  const tiles = input.tiles ?? [forest(2, 1), forest(1, 2), forest(3, 2)];
  return {
    tick: input.tick ?? 10,
    seed: 7,
    tiles: [...tiles],
    width: 6,
    height: 6,
    buildings: [...(input.buildings ?? [building("logger")])],
    constructionSites: [],
    houses: [],
    walkers: [],
    population: 0,
    idleWorkers: 0,
    treasuryTimber: 0,
    treasuryCoin: 0,
    wallTick: 0,
    era: "hamlet",
    eraProclaimedTick: null,
    palisade: null,
    nextConstructionOrdinal: 1,
    roadRevision: 0,
    pathCache: {},
    forestHarvests: input.forestHarvests ?? [],
  };
}

test("runProduction records the nearest unrecorded forest after successful logging output", () => {
  // Given
  const current = state({
    tick: 123,
    tiles: [forest(1, 2), forest(2, 1), forest(3, 2)],
  });

  // When
  const next = runProduction(current);

  // Then
  assert.equal(next.buildings[0]?.inventory.logs, 1);
  assert.deepEqual(next.forestHarvests, [{ tx: 2, ty: 1, harvestedAtTick: 123 }]);
});

test("logging harvest history advances without duplicate coordinates and stays canonical", () => {
  // Given
  const current = state({
    tick: 200,
    forestHarvests: [{ tx: 2, ty: 1, harvestedAtTick: 199 }],
    tiles: [forest(2, 1), forest(1, 2), forest(3, 2)],
  });

  // When
  const next = runProduction(current);

  // Then
  assert.equal(next.buildings[0]?.inventory.logs, 1);
  assert.deepEqual(next.forestHarvests, [
    { tx: 2, ty: 1, harvestedAtTick: 199 },
    { tx: 1, ty: 2, harvestedAtTick: 200 },
  ]);
});

test("logging continues normally when all visual forest coordinates are already recorded", () => {
  // Given
  const current = state({
    tick: 300,
    forestHarvests: [
      { tx: 1, ty: 2, harvestedAtTick: 100 },
      { tx: 2, ty: 1, harvestedAtTick: 101 },
      { tx: 3, ty: 2, harvestedAtTick: 102 },
    ],
  });

  // When
  const next = runProduction(current);

  // Then
  assert.equal(next.buildings[0]?.inventory.logs, 1);
  assert.deepEqual(next.forestHarvests, current.forestHarvests);
});

test("non-output and non-logging production never append forest history", () => {
  // Given
  const loggerStillWorking = state({
    buildings: [building("logger", { productionProgress: 0 })],
  });
  const loggerFull = state({
    buildings: [building("logger", { inventory: { logs: 20 } })],
  });
  const farm = state({
    buildings: [
      building("farm", {
        kind: "wheat_farm",
        workers: BUILDING_CONFIG_BY_KIND.wheat_farm.workersRequired,
        productionProgress: BUILDING_CONFIG_BY_KIND.wheat_farm.production?.ticksPerOutput ?? 0,
      }),
    ],
  });

  // When / Then
  assert.deepEqual(runProduction(loggerStillWorking).forestHarvests, []);
  assert.deepEqual(runProduction(loggerFull).forestHarvests, []);
  assert.equal(runProduction(farm).buildings[0]?.inventory.wheat, 1);
  assert.deepEqual(runProduction(farm).forestHarvests, []);
});

test("forest harvest helper sorts by tick, y, then x and exposes the old stump boundary", () => {
  // Given
  const current = state({
    tick: 600,
    forestHarvests: [
      { tx: 4, ty: 2, harvestedAtTick: 600 },
      { tx: 1, ty: 1, harvestedAtTick: 500 },
    ],
  });

  // When
  const next = forestHarvestsAfterProduction({
    state: current,
    building: building("logger", { tx: 2, ty: 2 }),
    produced: "logs",
  });

  // Then
  assert.deepEqual(next, [
    { tx: 1, ty: 1, harvestedAtTick: 500 },
    { tx: 2, ty: 1, harvestedAtTick: 600 },
    { tx: 4, ty: 2, harvestedAtTick: 600 },
  ]);
  assert.equal(stumpAgeAt({ tx: 0, ty: 0, harvestedAtTick: 0 }, STUMP_OLD_AFTER_TICKS - 1), "fresh");
  assert.equal(stumpAgeAt({ tx: 0, ty: 0, harvestedAtTick: 0 }, STUMP_OLD_AFTER_TICKS), "old");
});

test("economy hashes include canonical forest harvest history", () => {
  // Given
  const first = state({
    forestHarvests: [
      { tx: 4, ty: 1, harvestedAtTick: 2 },
      { tx: 1, ty: 4, harvestedAtTick: 1 },
    ],
  });
  const reordered = state({
    forestHarvests: [
      { tx: 1, ty: 4, harvestedAtTick: 1 },
      { tx: 4, ty: 1, harvestedAtTick: 2 },
    ],
  });
  const changed = state({
    forestHarvests: [
      { tx: 1, ty: 4, harvestedAtTick: 1 },
      { tx: 4, ty: 2, harvestedAtTick: 2 },
    ],
  });

  // Then
  assert.equal(hashEconomyState(first), hashEconomyState(reordered));
  assert.notEqual(hashEconomyState(first), hashEconomyState(changed));
});

test("object render static cache invalidates when forest harvest history changes", () => {
  // Given
  const current = state({
    tiles: [forest(0, 0), tile(1, 0), tile(0, 1), tile(1, 1)],
    buildings: [building("house", { kind: "house", tx: 1, ty: 0, workers: 0 })],
  });
  const range = { minTx: 0, minTy: 0, maxTx: 1, maxTy: 1 } as const;
  objectRenderItemsForFrame({ state: current, visibleTiles: current.tiles, range, includeGroundCover: false });
  const originalSort = Array.prototype.sort;
  let sortCalls = 0;

  // When
  Array.prototype.sort = function <T>(this: T[], compareFn?: (left: T, right: T) => number): T[] {
    sortCalls += 1;
    return originalSort.call(this, compareFn);
  };
  try {
    objectRenderItemsForFrame({
      state: { ...current, forestHarvests: [{ tx: 0, ty: 0, harvestedAtTick: 1 }] },
      visibleTiles: current.tiles,
      range,
      includeGroundCover: false,
    });
  } finally {
    Array.prototype.sort = originalSort;
  }

  // Then
  assert.ok(sortCalls > 0, "expected harvest history to invalidate static render cache");
});
