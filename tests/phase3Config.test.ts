import assert from "node:assert/strict";
import test from "node:test";

import { BALANCE } from "../src/content/balanceConfig";
import { BUILDING_CONFIG_BY_KIND } from "../src/content/buildingConfig";
import { HOUSING_CONFIG } from "../src/content/housingConfig";
import { placeBuilding, placeRoadLine } from "../src/engine/gameActions";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";

test("Phase 3 balance constants match the economy-turns foundation spec", () => {
  // Given / When / Then
  assert.deepEqual(BALANCE, {
    TICKS_PER_SECOND: 20,
    CARTER_SPEED: 0.08,
    CARTER_CAPACITY: 8,
    DISTRIBUTOR_SPEED: 0.06,
    DISTRIBUTOR_CAPACITY: 12,
    DISTRIBUTOR_INTERVAL: 120,
    DISTRIBUTOR_RANGE: 40,
    BREAD_HUNGER_WINDOW: 200,
    DEVOLUTION_GRACE: 400,
    GROWTH_INTERVAL: 50,
    STARVATION_WINDOW: 300,
    WORKERS_PER_RESIDENT: 0.5,
    STARTING_TIMBER: 160,
  });
});

test("Phase 3 building table matches the exact foundation definitions", () => {
  // Given / When / Then
  assert.deepEqual(BUILDING_CONFIG_BY_KIND, {
    house: {
      kind: "house", name: "오두막", width: 1, height: 1, workersRequired: 0, buildCost: {},
      requiresAdjacentTerrain: null, requiresRoad: true, production: null, storageCapacity: 0, serviceRadius: 0,
    },
    well: {
      kind: "well", name: "우물", width: 1, height: 1, workersRequired: 0, buildCost: { timber: 10 },
      requiresAdjacentTerrain: null, requiresRoad: false, production: null, storageCapacity: 0, serviceRadius: 6,
    },
    storehouse: {
      kind: "storehouse", name: "창고", width: 2, height: 2, workersRequired: 2, buildCost: { timber: 40 },
      requiresAdjacentTerrain: null, requiresRoad: true, production: null, storageCapacity: 200, serviceRadius: 0,
    },
    granary: {
      kind: "granary", name: "곡창", width: 2, height: 2, workersRequired: 2, buildCost: { timber: 40 },
      requiresAdjacentTerrain: null, requiresRoad: true, production: null, storageCapacity: 200, serviceRadius: 0,
    },
    wheat_farm: {
      kind: "wheat_farm", name: "밀밭", width: 2, height: 2, workersRequired: 4, buildCost: { timber: 20 },
      requiresAdjacentTerrain: null, requiresRoad: true,
      production: { output: "wheat", input: null, inputPerOutput: 0, ticksPerOutput: 40 },
      storageCapacity: 20, serviceRadius: 0,
    },
    mill: {
      kind: "mill", name: "방앗간", width: 1, height: 1, workersRequired: 2, buildCost: { timber: 30 },
      requiresAdjacentTerrain: null, requiresRoad: true,
      production: { output: "bread", input: "wheat", inputPerOutput: 2, ticksPerOutput: 30 },
      storageCapacity: 20, serviceRadius: 0,
    },
    logging_camp: {
      kind: "logging_camp", name: "벌목소", width: 1, height: 1, workersRequired: 3, buildCost: { timber: 15 },
      requiresAdjacentTerrain: "forest", requiresRoad: true,
      production: { output: "logs", input: null, inputPerOutput: 0, ticksPerOutput: 50 },
      storageCapacity: 20, serviceRadius: 0,
    },
    sawmill: {
      kind: "sawmill", name: "제재소", width: 1, height: 1, workersRequired: 2, buildCost: { timber: 30 },
      requiresAdjacentTerrain: null, requiresRoad: true,
      production: { output: "timber", input: "logs", inputPerOutput: 2, ticksPerOutput: 35 },
      storageCapacity: 20, serviceRadius: 0,
    },
  });
});

test("Phase 3 housing table matches the exact level requirements", () => {
  // Given / When / Then
  assert.deepEqual(HOUSING_CONFIG, [
    { level: 0, name: "오두막", requires: [], capacity: 4 },
    { level: 1, name: "농가", requires: ["water"], capacity: 8 },
    { level: 2, name: "시민가옥", requires: ["water", "bread"], capacity: 14 },
    {
      level: 3,
      name: "장원저택",
      requires: ["water", "bread", "granary"],
      capacity: 22,
      granaryRadius: 12,
    },
  ]);
});

test("DEFAULT_GAME_STATE seeds one occupied level zero house and path cache fields", () => {
  // Given / When
  const state = DEFAULT_GAME_STATE;
  const startingHouse = state.buildings.find((building) => building.kind === "house");

  // Then
  assert.equal(state.treasuryTimber, BALANCE.STARTING_TIMBER);
  assert.equal(state.roadRevision, 0);
  assert.deepEqual(state.pathCache, {});
  assert.ok(startingHouse);
  assert.deepEqual(startingHouse, {
    id: "house-0-0-0",
    kind: "house",
    tx: 0,
    ty: 0,
    workers: 0,
    inventory: {},
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
  });
  assert.deepEqual(state.houses, [
    {
      buildingId: "house-0-0-0",
      level: 0,
      residents: 4,
      hasWater: false,
      breadStock: 0,
      lastServicedTick: 0,
      unmetRequirementTicks: 0,
    },
  ]);
});

test("placeBuilding creates newly placed houses empty with hysteresis state initialized", () => {
  // Given
  const roaded = placeRoadLine(DEFAULT_GAME_STATE, { tx: 2, ty: 0 }, { tx: 2, ty: 1 });

  // When
  const next = placeBuilding(roaded, "house", { tx: 1, ty: 0 });

  // Then
  assert.notEqual(next, roaded);
  assert.deepEqual(next.buildings.at(-1), {
    id: "house-1-0-1",
    kind: "house",
    tx: 1,
    ty: 0,
    workers: 0,
    inventory: {},
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
  });
  assert.deepEqual(next.houses.at(-1), {
    buildingId: "house-1-0-1",
    level: 0,
    residents: 0,
    hasWater: false,
    breadStock: 0,
    lastServicedTick: 0,
    unmetRequirementTicks: 0,
  });
});

test("placeBuilding spends treasury timber before stored timber without duplicating stock", () => {
  // Given
  const storage = {
    id: "storehouse-4-4-1",
    kind: "storehouse" as const,
    tx: 4,
    ty: 4,
    workers: 0,
    inventory: { timber: 8 },
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
  };
  const state = {
    ...DEFAULT_GAME_STATE,
    buildings: [...DEFAULT_GAME_STATE.buildings, storage],
    treasuryTimber: 5,
  };

  // When
  const next = placeBuilding(state, "well", { tx: 2, ty: 0 });

  // Then
  assert.notEqual(next, state);
  assert.equal(next.treasuryTimber, 0);
  assert.equal(next.buildings.find((building) => building.id === storage.id)?.inventory.timber, 3);
  assert.equal(next.buildings.find((building) => building.kind === "well")?.inventory.timber, undefined);
});

test("placeRoadLine increments road revision and clears cached paths only when a road is placed", () => {
  // Given
  const state = {
    ...DEFAULT_GAME_STATE,
    pathCache: {
      "0,0->1,0": [
        { tx: 0, ty: 0 },
        { tx: 1, ty: 0 },
      ],
    },
  };

  // When
  const next = placeRoadLine(state, { tx: 2, ty: 0 }, { tx: 5, ty: 0 });
  const invalid = placeRoadLine(next, { tx: 2, ty: 0 }, { tx: 5, ty: 0 });

  // Then
  assert.equal(next.roadRevision, state.roadRevision + 1);
  assert.deepEqual(next.pathCache, {});
  assert.equal(invalid, next);
});
