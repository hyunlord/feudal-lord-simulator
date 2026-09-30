/**
 * FIX-11 (15): stuck-stock detection unit tests.
 * Covers the three reasons: "no_road", "no_carrier", "receiver_full".
 */
import assert from "node:assert/strict";
import test from "node:test";

import type { Building } from "../src/content/buildingConfig";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { stuckStock } from "../src/engine/stuckStock";

// Grid is 64×64. Mill is 1×1 at (5,5). Adjacent road tile at (5,4) = index 4*64+5 = 261.
const MILL_TX = 5;
const MILL_TY = 5;
const ROAD_TILE_INDEX = (MILL_TY - 1) * 64 + MILL_TX; // tile above the mill, ty=4

function millBuilding(overrides: Partial<Building> = {}): Building {
  return {
    id: "test-mill",
    kind: "mill",
    tx: MILL_TX,
    ty: MILL_TY,
    workers: 2,
    inventory: {},
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
    ...overrides,
  };
}

/** Adds a road tile adjacent to the mill so buildingRoadAccessTiles returns a non-empty result. */
function stateWithRoadAccess() {
  // The tile cache in routing.ts is WeakMap-keyed by the tiles array; giving a fresh array object
  // ensures this test's state never shares a cache entry with another test.
  const tiles = DEFAULT_GAME_STATE.tiles.map((tile, index) =>
    index === ROAD_TILE_INDEX ? { ...tile, hasRoad: true } : tile,
  );
  return { ...DEFAULT_GAME_STATE, tiles, roadRevision: 99 };
}

test("stuckStock returns nothing when buildings list is empty", () => {
  const state = { ...DEFAULT_GAME_STATE, buildings: [] };
  assert.deepEqual(stuckStock(state), []);
});

test("stuckStock returns nothing when output inventory is zero", () => {
  // Mill has required workers and road access but no bread in inventory.
  const state = { ...stateWithRoadAccess(), buildings: [millBuilding({ inventory: { bread: 0 } })] };
  assert.deepEqual(stuckStock(state), []);
});

test("stuckStock reports no_road when mill lacks road access and has bread", () => {
  // Default state has no road tiles → no adjacent road → no_road.
  const mill = millBuilding({ inventory: { bread: 3 } });
  const state = { ...DEFAULT_GAME_STATE, buildings: [mill] };

  const entries = stuckStock(state);
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.reason, "no_road");
  assert.equal(entries[0]?.buildingId, "test-mill");
  assert.equal(entries[0]?.resource, "bread");
  assert.equal(entries[0]?.amount, 3);
});

test("stuckStock reports no_carrier when mill has road access but is understaffed", () => {
  // Mill requires 2 workers; give it 0.
  const mill = millBuilding({ workers: 0, inventory: { bread: 2 } });
  const state = { ...stateWithRoadAccess(), buildings: [mill] };

  const entries = stuckStock(state);
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.reason, "no_carrier");
});

test("stuckStock reports receiver_full when road and workers are fine but no building accepts bread", () => {
  // Mill fully staffed and road-accessible, but no granary/storehouse in sight.
  const mill = millBuilding({ workers: 2, inventory: { bread: 5 } });
  const state = { ...stateWithRoadAccess(), buildings: [mill] };

  const entries = stuckStock(state);
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.reason, "receiver_full");
  assert.equal(entries[0]?.amount, 5);
});

test("stuckStock days field is 0 when stuckSinceTick is absent", () => {
  const mill = millBuilding({ inventory: { bread: 1 } });
  const state = { ...DEFAULT_GAME_STATE, buildings: [mill], tick: 1000 };
  const [entry] = stuckStock(state);
  assert.equal(entry?.days, 0);
});

test("stuckStock days field reflects elapsed days when stuckSinceTick is set", () => {
  // BALANCE.TICKS_PER_YEAR / 360 ≈ ticks per day. Use a large enough difference to get ≥1 day.
  // stuckStock uses TICKS_PER_DAY = TICKS_PER_YEAR/360. We don't import BALANCE, so use a
  // large tick gap that produces at least 1 day under any reasonable TICKS_PER_YEAR value.
  const sinceTick = 0;
  const currentTick = 10_000; // >> any realistic TICKS_PER_DAY (usually ~100-200)
  const mill = millBuilding({
    inventory: { bread: 1 },
    stuckSinceTick: { bread: sinceTick },
  });
  const state = { ...DEFAULT_GAME_STATE, buildings: [mill], tick: currentTick };
  const [entry] = stuckStock(state);
  assert.ok((entry?.days ?? 0) >= 1, `expected at least 1 day, got ${entry?.days}`);
});
