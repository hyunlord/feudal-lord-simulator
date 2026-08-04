import assert from "node:assert/strict";
import test from "node:test";

import { BUILDING_CONFIG_BY_KIND } from "../src/content/buildingConfig";
import {
  canPlaceRoadLineEndpoints,
  placeBuilding,
  placeRoadLine,
} from "../src/engine/gameActions";
import type { GameState } from "../src/engine/engine.types";
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

function withoutTick(state: GameState): Omit<GameState, "tick"> {
  const { tick: _tick, ...rest } = state;
  return rest;
}

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
  assert.deepEqual(state.buildings, []);
  assert.deepEqual(state.houses, []);
  assert.deepEqual(state.walkers, []);
  assert.equal(state.treasuryTimber, 160);
  assert.equal(state.tiles.every((tile) => tile.buildingId === null && !tile.hasRoad), true);
  for (const field of FORBIDDEN_STATE_FIELDS) {
    assert.equal(Object.hasOwn(state, field), false);
  }
});

test("placeBuilding immutably appends a deterministic building marks its footprint and spends only timber", () => {
  // Given
  const state = DEFAULT_GAME_STATE;
  const timberCost = BUILDING_CONFIG_BY_KIND.wheat_farm.buildCost.timber ?? 0;

  // When
  const next = placeBuilding(state, "wheat_farm", { tx: 0, ty: 0 });

  // Then
  assert.notEqual(next, state);
  assert.equal(state.buildings.length, 0);
  assert.equal(state.treasuryTimber, 160);
  assert.deepEqual(next.buildings, [
    {
      id: "wheat_farm-0-0-0",
      kind: "wheat_farm",
      tx: 0,
      ty: 0,
      workers: 0,
      inventory: {},
      productionProgress: 0,
    },
  ]);
  assert.equal(next.treasuryTimber, 160 - timberCost);
  assert.equal(getTile(next, { tx: 0, ty: 0 })?.buildingId, "wheat_farm-0-0-0");
  assert.equal(getTile(next, { tx: 1, ty: 0 })?.buildingId, "wheat_farm-0-0-0");
  assert.equal(getTile(next, { tx: 0, ty: 1 })?.buildingId, "wheat_farm-0-0-0");
  assert.equal(getTile(next, { tx: 1, ty: 1 })?.buildingId, "wheat_farm-0-0-0");
});

test("placeBuilding returns the original state when placement or timber validation fails", () => {
  // Given
  const occupied = placeBuilding(DEFAULT_GAME_STATE, "house", { tx: 0, ty: 0 });
  const poorState = { ...DEFAULT_GAME_STATE, treasuryTimber: 0 };

  // When
  const occupiedResult = placeBuilding(occupied, "house", { tx: 0, ty: 0 });
  const timberResult = placeBuilding(poorState, "house", { tx: 2, ty: 0 });

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
  assert.equal(state.tiles.some((tile) => tile.hasRoad), false);
  assert.equal(next.treasuryTimber, state.treasuryTimber);
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
  assert.equal(state.tiles.some((tile) => tile.hasRoad), false);
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
    kind: "house",
    tx: 0,
    ty: 0,
  });
  const invalid = gameReducer(built, {
    type: "place_road_line",
    start: { tx: 0, ty: 0 },
    destination: { tx: 0, ty: 0 },
  });

  // Then
  assert.equal(getTile(roaded, { tx: 2, ty: 0 })?.hasRoad, true);
  assert.equal(built.buildings[0]?.id, "house-0-0-0");
  assert.equal(invalid, built);
});

test("advance tick returns a new state with only tick incremented and produces no timber", () => {
  // Given
  const state = placeBuilding(DEFAULT_GAME_STATE, "house", { tx: 0, ty: 0 });
  const timber = state.treasuryTimber;

  // When
  const next = gameReducer(state, { type: "advance_tick" });

  // Then
  assert.notEqual(next, state);
  assert.equal(next.tick, state.tick + 1);
  assert.equal(next.treasuryTimber, timber);
  assert.deepEqual(withoutTick(next), withoutTick(state));
});
