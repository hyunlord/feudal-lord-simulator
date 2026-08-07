import assert from "node:assert/strict";
import test from "node:test";

import { BALANCE } from "../src/content/balanceConfig";
import {
  canPlaceRoadLineEndpoints,
  placeBuilding,
  placeRoadLine,
} from "../src/engine/gameActions";
import { DEFAULT_GAME_STATE, gameReducer } from "../src/state/gameStore";
import { getTile } from "../src/world/grid";

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
      { tx: 44, ty: 40, buildingId: "house-44-40-0" },
      { tx: 46, ty: 40, buildingId: "house-46-40-0" },
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
      { tx: 45, ty: 41 },
      { tx: 46, ty: 41 },
      { tx: 47, ty: 41 },
      { tx: 48, ty: 41 },
      { tx: 49, ty: 41 },
      { tx: 50, ty: 41 },
      { tx: 51, ty: 41 },
      { tx: 52, ty: 41 },
    ],
  );
  for (const field of FORBIDDEN_STATE_FIELDS) {
    assert.equal(Object.hasOwn(state, field), false);
  }
});

test("placeBuilding immutably appends a deterministic construction site and preserves stock", () => {
  // Given
  const roaded = placeRoadLine(DEFAULT_GAME_STATE, { tx: 2, ty: 0 }, { tx: 4, ty: 0 });

  // When
  const next = placeBuilding(roaded, "storehouse", { tx: 2, ty: 1 });

  // Then
  assert.notEqual(next, roaded);
  assert.equal(roaded.buildings.length, 5);
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
  assert.equal(state.tiles.filter((tile) => tile.hasRoad).length, 8);
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
  assert.equal(state.tiles.filter((tile) => tile.hasRoad).length, 8);
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

test("advance tick exposes opening household workers while preserving a production-free starting world", () => {
  // Given
  const state = DEFAULT_GAME_STATE;
  const timber = state.treasuryTimber;

  // When
  const next = gameReducer(state, { type: "advance_tick" });

  // Then
  assert.notEqual(next, state);
  assert.equal(next.tick, state.tick + 1);
  assert.equal(next.treasuryTimber, timber);
  assert.equal(next.population, 12);
  assert.equal(next.idleWorkers, 6);
  assert.deepEqual(next.buildings, state.buildings);
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
