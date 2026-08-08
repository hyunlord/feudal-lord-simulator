import assert from "node:assert/strict";
import test from "node:test";

import { BALANCE } from "../src/content/balanceConfig";
import { BUILDING_CONFIG_BY_KIND } from "../src/content/buildingConfig";
import {
  canPlaceRoadLineEndpoints,
  placeBuilding,
  placeRoadLine,
} from "../src/engine/gameActions";
import { buildingHasRequiredRoadAccess } from "../src/engine/roadAccess";
import { advanceTick } from "../src/engine/tick";
import { DEFAULT_GAME_STATE, gameReducer } from "../src/state/gameStore";
import { getTile } from "../src/world/grid";
import { existingRoadComponent } from "../src/world/roadGraph";

const FORBIDDEN_STATE_FIELDS = [
  "camera",
  "panX",
  "panY",
  "zoom",
  "hoveredTile",
  "preview",
  "ambientPhase",
  "sway",
  "motion",
] as const;

test("DEFAULT_GAME_STATE starts with a deterministic populated world and no presentation fields", () => {
  // Given / When
  const state = DEFAULT_GAME_STATE;
  const terrains = new Set(state.tiles.map((tile) => tile.terrain));

  // Then
  assert.equal(state.tick, 0);
  assert.equal(state.seed, 1);
  assert.equal(state.width, 64);
  assert.equal(state.height, 64);
  assert.equal(state.tiles.length, 64 * 64);
  assert.deepEqual([...terrains].sort(), ["forest", "grass", "rock", "water"]);
  assert.deepEqual(
    state.buildings.map(({ id, kind, tx, ty }) => ({ id, kind, tx, ty })),
    [
      { id: "house-44-40-0", kind: "house", tx: 44, ty: 40 },
      { id: "house-46-40-0", kind: "house", tx: 46, ty: 40 },
      { id: "house-44-42-0", kind: "house", tx: 44, ty: 42 },
      { id: "house-46-42-0", kind: "house", tx: 46, ty: 42 },
      { id: "well-45-41-0", kind: "well", tx: 45, ty: 41 },
      { id: "granary-42-37-0", kind: "granary", tx: 42, ty: 37 },
      { id: "logging-camp-50-40-0", kind: "logging_camp", tx: 50, ty: 40 },
      { id: "storehouse-41-40-0", kind: "storehouse", tx: 41, ty: 40 },
    ],
  );
  assert.deepEqual(state.constructionSites, []);
  assert.deepEqual(state.houses, [
    {
      buildingId: "house-46-40-0",
      level: 0,
      residents: 3,
      hasWater: false,
      breadStock: 0,
      lastServicedTick: 0,
      starvationGraceUntilTick: 6_000,
      unmetRequirementTicks: 0,
    },
    {
      buildingId: "house-44-40-0",
      level: 0,
      residents: 3,
      hasWater: false,
      breadStock: 0,
      lastServicedTick: 0,
      starvationGraceUntilTick: 6_000,
      unmetRequirementTicks: 0,
    },
    {
      buildingId: "house-44-42-0",
      level: 0,
      residents: 3,
      hasWater: false,
      breadStock: 0,
      lastServicedTick: 0,
      starvationGraceUntilTick: 6_000,
      unmetRequirementTicks: 0,
    },
    {
      buildingId: "house-46-42-0",
      level: 0,
      residents: 3,
      hasWater: false,
      breadStock: 0,
      lastServicedTick: 0,
      starvationGraceUntilTick: 6_000,
      unmetRequirementTicks: 0,
    },
  ]);
  assert.deepEqual(state.walkers, []);
  assert.equal(state.population, 12);
  assert.equal(state.treasuryTimber, BALANCE.STARTING_TIMBER);
  assert.equal(state.wallTick, 0);
  assert.equal(state.nextConstructionOrdinal, 1);
  assert.equal(state.roadRevision, 0);
  assert.deepEqual(state.pathCache, {});
  assert.deepEqual(state.forestHarvests, []);
  assert.equal(state.era, "hamlet");
  assert.equal(state.eraProclaimedTick, null);
  assert.equal(state.palisade, null);
  assert.equal(getTile(state, { tx: 46, ty: 40 })?.buildingId, "house-46-40-0");
  assert.deepEqual(
    state.tiles
      .filter((tile) => tile.buildingId !== null)
      .map(({ tx, ty, buildingId }) => ({ tx, ty, buildingId }))
      .sort((left, right) => left.ty - right.ty || left.tx - right.tx),
    [
      { tx: 42, ty: 37, buildingId: "granary-42-37-0" },
      { tx: 43, ty: 37, buildingId: "granary-42-37-0" },
      { tx: 42, ty: 38, buildingId: "granary-42-37-0" },
      { tx: 43, ty: 38, buildingId: "granary-42-37-0" },
      { tx: 41, ty: 40, buildingId: "storehouse-41-40-0" },
      { tx: 42, ty: 40, buildingId: "storehouse-41-40-0" },
      { tx: 44, ty: 40, buildingId: "house-44-40-0" },
      { tx: 46, ty: 40, buildingId: "house-46-40-0" },
      { tx: 50, ty: 40, buildingId: "logging-camp-50-40-0" },
      { tx: 41, ty: 41, buildingId: "storehouse-41-40-0" },
      { tx: 42, ty: 41, buildingId: "storehouse-41-40-0" },
      { tx: 45, ty: 41, buildingId: "well-45-41-0" },
      { tx: 44, ty: 42, buildingId: "house-44-42-0" },
      { tx: 46, ty: 42, buildingId: "house-46-42-0" },
    ],
  );
  assert.deepEqual(
    state.tiles
      .filter((tile) => tile.hasRoad)
      .map(({ tx, ty }) => ({ tx, ty }))
      .sort((left, right) => left.ty - right.ty || left.tx - right.tx),
    [
      { tx: 43, ty: 39 },
      { tx: 44, ty: 39 },
      { tx: 45, ty: 39 },
      { tx: 46, ty: 39 },
      { tx: 47, ty: 39 },
      { tx: 43, ty: 40 },
      { tx: 47, ty: 40 },
      { tx: 43, ty: 41 },
      { tx: 44, ty: 41 },
      { tx: 46, ty: 41 },
      { tx: 47, ty: 41 },
      { tx: 48, ty: 41 },
      { tx: 49, ty: 41 },
      { tx: 50, ty: 41 },
    ],
  );
  for (const field of FORBIDDEN_STATE_FIELDS) {
    assert.equal(Object.hasOwn(state, field), false);
  }
});

test("DEFAULT_GAME_STATE opens with stocked buildings and a legal connected road network", () => {
  // Given / When
  const state = DEFAULT_GAME_STATE;
  const buildingFacts = state.buildings.map(({ id, kind, tx, ty, workers, inventory }) => ({
    id,
    kind,
    tx,
    ty,
    workers,
    inventory,
  }));

  // Then
  assert.deepEqual(buildingFacts, [
    { id: "house-44-40-0", kind: "house", tx: 44, ty: 40, workers: 0, inventory: {} },
    { id: "house-46-40-0", kind: "house", tx: 46, ty: 40, workers: 0, inventory: {} },
    { id: "house-44-42-0", kind: "house", tx: 44, ty: 42, workers: 0, inventory: {} },
    { id: "house-46-42-0", kind: "house", tx: 46, ty: 42, workers: 0, inventory: {} },
    { id: "well-45-41-0", kind: "well", tx: 45, ty: 41, workers: 0, inventory: {} },
    { id: "granary-42-37-0", kind: "granary", tx: 42, ty: 37, workers: 2, inventory: { bread: 30 } },
    { id: "logging-camp-50-40-0", kind: "logging_camp", tx: 50, ty: 40, workers: 3, inventory: {} },
    { id: "storehouse-41-40-0", kind: "storehouse", tx: 41, ty: 40, workers: 1, inventory: { logs: 20 } },
  ]);
  assert.equal(state.treasuryTimber, 120);
  const roadTiles = state.tiles.filter((tile) => tile.hasRoad);
  assert.deepEqual(
    roadTiles
      .map(({ tx, ty }) => ({ tx, ty }))
      .sort((left, right) => left.ty - right.ty || left.tx - right.tx),
    [
      { tx: 43, ty: 39 },
      { tx: 44, ty: 39 },
      { tx: 45, ty: 39 },
      { tx: 46, ty: 39 },
      { tx: 47, ty: 39 },
      { tx: 43, ty: 40 },
      { tx: 47, ty: 40 },
      { tx: 43, ty: 41 },
      { tx: 44, ty: 41 },
      { tx: 46, ty: 41 },
      { tx: 47, ty: 41 },
      { tx: 48, ty: 41 },
      { tx: 49, ty: 41 },
      { tx: 50, ty: 41 },
    ],
  );
  assert.ok(roadTiles.length >= 10 && roadTiles.length <= 14);
  assert.equal(existingRoadComponent(state, [{ tx: 43, ty: 39 }]).length, roadTiles.length);
  for (const tile of roadTiles) {
    assert.notEqual(tile.terrain, "water", `road uses water at ${tile.tx},${tile.ty}`);
    assert.equal(tile.buildingId, null, `road overlaps building at ${tile.tx},${tile.ty}`);
  }
  for (const building of state.buildings) {
    const definition = BUILDING_CONFIG_BY_KIND[building.kind];
    const footprintTerrains: string[] = [];
    for (let ty = building.ty; ty < building.ty + definition.height; ty += 1) {
      for (let tx = building.tx; tx < building.tx + definition.width; tx += 1) {
        const tile = getTile(state, { tx, ty });
        assert.equal(tile?.buildingId, building.id);
        assert.equal(tile?.hasRoad, false, `${building.id} overlaps road at ${tx},${ty}`);
        assert.notEqual(tile?.terrain, "water", `${building.id} uses water at ${tx},${ty}`);
        if (tile !== null) footprintTerrains.push(tile.terrain);
      }
    }
    if (definition.requiresAdjacentTerrain !== null) {
      const nearbyTerrains: string[] = [];
      for (let ty = building.ty - 1; ty <= building.ty + definition.height; ty += 1) {
        for (let tx = building.tx - 1; tx <= building.tx + definition.width; tx += 1) {
          const insideFootprint =
            tx >= building.tx &&
            tx < building.tx + definition.width &&
            ty >= building.ty &&
            ty < building.ty + definition.height;
          if (!insideFootprint) {
            const tile = getTile(state, { tx, ty });
            if (tile !== null) nearbyTerrains.push(tile.terrain);
          }
        }
      }
      assert.ok(
        nearbyTerrains.includes(definition.requiresAdjacentTerrain),
        `${building.id} lacks adjacent ${definition.requiresAdjacentTerrain}`,
      );
    }
    assert.ok(footprintTerrains.length > 0);
    assert.equal(buildingHasRequiredRoadAccess(state, building), true, `${building.id} lacks road access`);
  }
});

test("advanceTick makes the authored opening village visibly active within two hundred ticks", () => {
  // Given
  const initialInventory = new Map(
    DEFAULT_GAME_STATE.buildings.map((building) => [
      building.id,
      JSON.stringify(building.inventory),
    ]),
  );
  let state = DEFAULT_GAME_STATE;
  const walkerPositions = new Map<string, Set<string>>();
  const walkerKinds = new Map<string, string>();
  const activeWalkerKinds = new Set<string>();

  // When
  for (let tick = 0; tick < 200; tick += 1) {
    state = advanceTick(state);
    for (const walker of state.walkers) {
      activeWalkerKinds.add(walker.kind);
      walkerKinds.set(walker.id, walker.kind);
      const positions = walkerPositions.get(walker.id) ?? new Set<string>();
      positions.add(`${walker.position.tx},${walker.position.ty}`);
      walkerPositions.set(walker.id, positions);
    }
  }

  // Then
  const movedWalkerKinds = new Set(
    [...walkerPositions.entries()]
      .filter(([, positions]) => positions.size > 1)
      .map(([walkerId]) => walkerKinds.get(walkerId)),
  );
  const changedInventoryCount = state.buildings.filter(
    (building) => initialInventory.get(building.id) !== JSON.stringify(building.inventory),
  ).length;
  assert.equal(state.tick, 200);
  assert.ok(activeWalkerKinds.has("carter"), "opening logging camp should dispatch a carter");
  assert.ok(activeWalkerKinds.has("distributor"), "opening granary should dispatch a distributor");
  assert.ok(movedWalkerKinds.has("carter"), "opening carter should visibly change positions");
  assert.ok(movedWalkerKinds.has("distributor"), "opening distributor should visibly change positions");
  assert.ok(changedInventoryCount >= 1, "expected at least one building inventory delta");
  assert.ok(state.population > DEFAULT_GAME_STATE.population, "population should begin rising");
});

test("placeBuilding immutably appends a deterministic construction site and preserves stock", () => {
  // Given
  const roaded = placeRoadLine(DEFAULT_GAME_STATE, { tx: 2, ty: 0 }, { tx: 4, ty: 0 });

  // When
  const next = placeBuilding(roaded, "storehouse", { tx: 2, ty: 1 });

  // Then
  assert.notEqual(next, roaded);
  assert.equal(roaded.buildings.length, DEFAULT_GAME_STATE.buildings.length);
  assert.equal(roaded.treasuryTimber, BALANCE.STARTING_TIMBER);
  assert.deepEqual(next.buildings, roaded.buildings);
  assert.deepEqual(next.houses, roaded.houses);
  assert.deepEqual(next.constructionSites, [
    {
      id: "construction-site-000001",
      kind: "storehouse",
      tx: 2,
      ty: 1,
      required: { timber: 40 },
      delivered: {},
      reserved: {},
      builderTicks: 0,
      requiredBuilderTicks: 800,
      assignedBuilders: 0,
      stall: "awaiting_materials",
      startedTick: 0,
    },
  ]);
  assert.equal(next.nextConstructionOrdinal, 2);
  assert.equal(next.treasuryTimber, BALANCE.STARTING_TIMBER);
  assert.equal(getTile(next, { tx: 2, ty: 1 })?.buildingId, "construction-site-000001");
  assert.equal(getTile(next, { tx: 3, ty: 1 })?.buildingId, "construction-site-000001");
  assert.equal(getTile(next, { tx: 2, ty: 2 })?.buildingId, "construction-site-000001");
  assert.equal(getTile(next, { tx: 3, ty: 2 })?.buildingId, "construction-site-000001");
});

test("gameReducer cancel_construction removes the site and clears occupied tiles", () => {
  // Given
  const placed = placeBuilding(DEFAULT_GAME_STATE, "well", { tx: 2, ty: 0 });

  // When
  const next = gameReducer(placed, {
    type: "cancel_construction",
    siteId: "construction-site-000001",
  });

  // Then
  assert.deepEqual(next.constructionSites, []);
  assert.equal(getTile(next, { tx: 2, ty: 0 })?.buildingId, null);
});

test("placeBuilding returns the original state when placement or timber validation fails", () => {
  // Given
  const occupied = DEFAULT_GAME_STATE;
  const poorState = { ...DEFAULT_GAME_STATE, treasuryTimber: 0 };

  // When
  const occupiedResult = placeBuilding(occupied, "house", { tx: 46, ty: 40 });
  const timberResult = placeBuilding(poorState, "well", { tx: 2, ty: 0 });

  // Then
  assert.equal(occupiedResult, occupied);
  assert.equal(timberResult, poorState);
});

test("placeRoadLine immutably marks every normalized road tile without spending timber", () => {
  // Given
  const state = DEFAULT_GAME_STATE;

  // When
  const next = placeRoadLine(state, { tx: 2, ty: 0 }, { tx: 5, ty: 0 });

  // Then
  assert.notEqual(next, state);
  assert.equal(state.tiles.filter((tile) => tile.hasRoad).length, 14);
  assert.equal(next.treasuryTimber, state.treasuryTimber);
  assert.equal(next.roadRevision, state.roadRevision + 1);
  assert.deepEqual(next.pathCache, {});
  assert.equal(getTile(next, { tx: 2, ty: 0 })?.hasRoad, true);
  assert.equal(getTile(next, { tx: 3, ty: 0 })?.hasRoad, true);
  assert.equal(getTile(next, { tx: 4, ty: 0 })?.hasRoad, true);
  assert.equal(getTile(next, { tx: 5, ty: 0 })?.hasRoad, true);
});

test("placeRoadLine is atomic and returns the original state when any normalized tile is invalid", () => {
  // Given
  const state = DEFAULT_GAME_STATE;
  const waterTile = state.tiles.find((tile) => tile.terrain === "water");
  assert.ok(waterTile);

  // When
  const blockedByWater = placeRoadLine(
    state,
    { tx: waterTile.tx, ty: waterTile.ty },
    { tx: waterTile.tx, ty: waterTile.ty },
  );
  const outOfBounds = placeRoadLine(state, { tx: 63, ty: 0 }, { tx: 65, ty: 0 });

  // Then
  assert.equal(blockedByWater, state);
  assert.equal(outOfBounds, state);
  assert.equal(state.tiles.filter((tile) => tile.hasRoad).length, 14);
});

test("placeRoadLine endpoint validation rejects fractional and extreme out-of-bounds endpoints", () => {
  // Given
  const state = DEFAULT_GAME_STATE;
  const extreme = { tx: Number.MAX_SAFE_INTEGER, ty: 0 };
  const fractional = { tx: 2.5, ty: 0 };

  // When / Then
  assert.equal(canPlaceRoadLineEndpoints(state, { tx: 0, ty: 0 }, extreme), false);
  assert.equal(canPlaceRoadLineEndpoints(state, fractional, { tx: 3, ty: 0 }), false);
  assert.equal(placeRoadLine(state, { tx: 0, ty: 0 }, extreme), state);
  assert.equal(placeRoadLine(state, { tx: -1, ty: 0 }, { tx: 0, ty: 0 }), state);
  assert.equal(placeRoadLine(state, fractional, { tx: 3, ty: 0 }), state);
});

test("gameReducer routes typed domain actions and invalid placements preserve object identity", () => {
  // Given
  const state = DEFAULT_GAME_STATE;

  // When
  const roaded = gameReducer(state, {
    type: "place_road_line",
    start: { tx: 2, ty: 0 },
    destination: { tx: 5, ty: 0 },
  });
  const built = gameReducer(roaded, {
    type: "place_building",
    kind: "well",
    tx: 1,
    ty: 0,
  });
  const waterTile = built.tiles.find((tile) => tile.terrain === "water");
  assert.ok(waterTile);
  const invalid = gameReducer(built, {
    type: "place_road_line",
    start: { tx: waterTile.tx, ty: waterTile.ty },
    destination: { tx: waterTile.tx, ty: waterTile.ty },
  });

  // Then
  assert.equal(getTile(roaded, { tx: 2, ty: 0 })?.hasRoad, true);
  assert.equal(built.constructionSites.at(-1)?.id, "construction-site-000001");
  assert.equal(built.constructionSites.at(-1)?.kind, "well");
  assert.equal(invalid, built);
});

test("advance tick starts authored production while preserving opening structures", () => {
  // Given
  const state = DEFAULT_GAME_STATE;
  const timber = state.treasuryTimber;

  // When
  const advanced = advanceTick(state);
  const next = gameReducer(state, {
    type: "commit_simulation_state",
    previousState: state,
    nextState: advanced,
  });

  // Then
  assert.notEqual(next, state);
  assert.equal(next.tick, state.tick + 1);
  assert.equal(next.treasuryTimber, timber);
  assert.equal(next.population, 12);
  assert.equal(next.idleWorkers, 0);
  assert.deepEqual(
    next.buildings.map(({ id, kind, tx, ty, inventory, workers }) => ({ id, kind, tx, ty, inventory, workers })),
    state.buildings.map(({ id, kind, tx, ty, inventory, workers }) => ({ id, kind, tx, ty, inventory, workers })),
  );
  assert.equal(
    next.buildings.find((building) => building.id === "logging-camp-50-40-0")?.productionProgress,
    1,
  );
  assert.deepEqual(
    next.houses,
    state.houses.map((house) => ({
      ...house,
      level: 1,
      hasWater: true,
      unmetRequirementTicks: 0,
    })),
  );
  assert.deepEqual(next.walkers, []);
  assert.deepEqual(next.tiles, state.tiles);
  assert.deepEqual(next.pathCache, state.pathCache);
  assert.equal(next.era, "hamlet");
  assert.equal(next.eraProclaimedTick, null);
  assert.equal(next.palisade, null);
});
