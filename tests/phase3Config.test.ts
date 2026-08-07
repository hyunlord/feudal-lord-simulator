import assert from "node:assert/strict";
import test from "node:test";

import { BALANCE } from "../src/content/balanceConfig";
import { BUILDING_CONFIG_BY_KIND } from "../src/content/buildingConfig";
import { HOUSING_CONFIG } from "../src/content/housingConfig";
import { placeBuilding, placeRoadLine } from "../src/engine/gameActions";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { placementSpendableResource } from "../src/world/placement";

test("Phase 3 balance constants retain the foundation values plus the measured opening grant", () => {
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
    STARTING_TIMBER: 205,
  });
});

test("Phase 3 building table includes chapel without changing ordinary building economics", () => {
  // Given / When / Then
  assert.deepEqual(BUILDING_CONFIG_BY_KIND, {
    house: {
      kind: "house", name: "오두막", width: 1, height: 1, workersRequired: 0, buildCost: {},
      requiresAdjacentTerrain: null, requiresRoad: true, unlockEra: "hamlet",
      production: null, storageCapacity: 0, serviceRadius: 0,
    },
    well: {
      kind: "well", name: "우물", width: 1, height: 1, workersRequired: 0, buildCost: { timber: 10 },
      requiresAdjacentTerrain: null, requiresRoad: false, unlockEra: "hamlet",
      production: null, storageCapacity: 0, serviceRadius: 6,
    },
    storehouse: {
      kind: "storehouse", name: "창고", width: 2, height: 2, workersRequired: 2, buildCost: { timber: 40 },
      requiresAdjacentTerrain: null, requiresRoad: true, unlockEra: "hamlet",
      production: null, storageCapacity: 200, serviceRadius: 0,
    },
    granary: {
      kind: "granary", name: "곡창", width: 2, height: 2, workersRequired: 2, buildCost: { timber: 40 },
      requiresAdjacentTerrain: null, requiresRoad: true, unlockEra: "hamlet",
      production: null, storageCapacity: 200, serviceRadius: 0,
    },
    chapel: {
      kind: "chapel", name: "예배당", width: 1, height: 1, workersRequired: 0, buildCost: { timber: 40 },
      requiresAdjacentTerrain: null, requiresRoad: true, unlockEra: "hamlet",
      production: null, storageCapacity: 0, serviceRadius: 0,
    },
    wheat_farm: {
      kind: "wheat_farm", name: "밀밭", width: 2, height: 2, workersRequired: 4, buildCost: { timber: 20 },
      requiresAdjacentTerrain: null, requiresRoad: true, unlockEra: "hamlet",
      production: { output: "wheat", input: null, inputPerOutput: 0, ticksPerOutput: 40 },
      storageCapacity: 20, serviceRadius: 0,
    },
    mill: {
      kind: "mill", name: "방앗간", width: 1, height: 1, workersRequired: 2, buildCost: { timber: 30 },
      requiresAdjacentTerrain: null, requiresRoad: true, unlockEra: "hamlet",
      production: { output: "bread", input: "wheat", inputPerOutput: 2, ticksPerOutput: 30 },
      storageCapacity: 20, serviceRadius: 0,
    },
    logging_camp: {
      kind: "logging_camp", name: "벌목소", width: 1, height: 1, workersRequired: 3, buildCost: { timber: 15 },
      requiresAdjacentTerrain: "forest", requiresRoad: true, unlockEra: "hamlet",
      production: { output: "logs", input: null, inputPerOutput: 0, ticksPerOutput: 50 },
      storageCapacity: 20, serviceRadius: 0,
    },
    sawmill: {
      kind: "sawmill", name: "제재소", width: 1, height: 1, workersRequired: 2, buildCost: { timber: 30 },
      requiresAdjacentTerrain: null, requiresRoad: true, unlockEra: "hamlet",
      production: { output: "timber", input: "logs", inputPerOutput: 2, ticksPerOutput: 35 },
      storageCapacity: 20, serviceRadius: 0,
    },
    quarry: {
      kind: "quarry", name: "채석장", width: 2, height: 2, workersRequired: 4, buildCost: { timber: 50 },
      requiresAdjacentTerrain: "rock", requiresRoad: true, unlockEra: "palisade",
      production: { output: "stone_raw", input: null, inputPerOutput: 0, ticksPerOutput: 60 },
      storageCapacity: 20, serviceRadius: 0,
    },
    masonry: {
      kind: "masonry", name: "석공소", width: 1, height: 1, workersRequired: 3, buildCost: { timber: 45 },
      requiresAdjacentTerrain: null, requiresRoad: true, unlockEra: "palisade",
      production: { output: "stone", input: "stone_raw", inputPerOutput: 2, ticksPerOutput: 45 },
      storageCapacity: 20, serviceRadius: 0,
    },
    market: {
      kind: "market", name: "시장", width: 2, height: 2, workersRequired: 3, buildCost: { timber: 60 },
      requiresAdjacentTerrain: null, requiresRoad: true, unlockEra: "palisade",
      production: null, storageCapacity: 0, serviceRadius: 8,
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

test("DEFAULT_GAME_STATE seeds the authored opening household and path cache fields", () => {
  // Given / When
  const state = DEFAULT_GAME_STATE;
  const startingHouses = state.buildings.filter((building) => building.kind === "house");

  // Then
  assert.equal(state.treasuryTimber, BALANCE.STARTING_TIMBER);
  assert.equal(state.roadRevision, 0);
  assert.deepEqual(state.pathCache, {});
  assert.deepEqual(state.forestHarvests, []);
  assert.equal(state.era, "hamlet");
  assert.equal(state.eraProclaimedTick, null);
  assert.equal(state.palisade, null);
  assert.deepEqual(
    startingHouses.map(({ id, tx, ty }) => ({ id, tx, ty })),
    [
      { id: "house-44-40-0", tx: 44, ty: 40 },
      { id: "house-46-40-0", tx: 46, ty: 40 },
      { id: "house-44-42-0", tx: 44, ty: 42 },
      { id: "house-46-42-0", tx: 46, ty: 42 },
    ],
  );
  assert.deepEqual(state.houses, [
    {
      buildingId: "house-46-40-0",
      level: 0,
      residents: 3,
      hasWater: false,
      breadStock: 0,
      lastServicedTick: 0,
      unmetRequirementTicks: 0,
    },
    {
      buildingId: "house-44-40-0",
      level: 0,
      residents: 3,
      hasWater: false,
      breadStock: 0,
      lastServicedTick: 0,
      unmetRequirementTicks: 0,
    },
    {
      buildingId: "house-44-42-0",
      level: 0,
      residents: 3,
      hasWater: false,
      breadStock: 0,
      lastServicedTick: 0,
      unmetRequirementTicks: 0,
    },
    {
      buildingId: "house-46-42-0",
      level: 0,
      residents: 3,
      hasWater: false,
      breadStock: 0,
      lastServicedTick: 0,
      unmetRequirementTicks: 0,
    },
  ]);
});

test("placeBuilding creates newly placed houses as pending construction sites", () => {
  // Given
  const roaded = placeRoadLine(DEFAULT_GAME_STATE, { tx: 2, ty: 0 }, { tx: 2, ty: 1 });

  // When
  const next = placeBuilding(roaded, "house", { tx: 1, ty: 0 });

  // Then
  assert.notEqual(next, roaded);
  assert.deepEqual(next.buildings, roaded.buildings);
  assert.deepEqual(next.constructionSites.at(-1), {
    id: "construction-site-000001",
    kind: "house",
    tx: 1,
    ty: 0,
    required: {},
    delivered: {},
    reserved: {},
    builderTicks: 0,
    requiredBuilderTicks: 240,
    assignedBuilders: 0,
    stall: "no_builders",
    startedTick: 0,
  });
  assert.deepEqual(next.houses, roaded.houses);
});

test("placeBuilding commits timber without duplicating physical stock", () => {
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
    treasuryCoin: 0,
  };

  // When
  const next = placeBuilding(state, "well", { tx: 2, ty: 0 });

  // Then
  assert.notEqual(next, state);
  assert.equal(next.treasuryTimber, 5);
  assert.equal(next.buildings.find((building) => building.id === storage.id)?.inventory.timber, 8);
  assert.deepEqual(next.constructionSites.at(-1)?.required, { timber: 10 });
  assert.equal(placementSpendableResource(next, "timber"), 3);
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
