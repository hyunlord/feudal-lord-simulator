import assert from "node:assert/strict";
import test from "node:test";
import { advanceTick } from "../src/engine/tick";
import { settlementProgress } from "../src/engine/settlementProgress";
import { DEFAULT_GAME_STATE, gameReducer } from "../src/state/gameStore";

function abandoned() {
  return { ...DEFAULT_GAME_STATE, tick: 7000, settlement: { ...settlementProgress(DEFAULT_GAME_STATE), outcome: "abandoned" as const } };
}
test("Given an abandoned settlement When simulation or construction is requested Then state stays frozen", () => {
  const state = abandoned();
  assert.equal(advanceTick(state), state);
  assert.equal(gameReducer(state, { type: "place_road_line", start: { tx: 1, ty: 1 }, destination: { tx: 3, ty: 1 } }), state);
});
test("Given abandonment When explicitly restarting Then fresh opening state clears outcome and caches", () => {
  const state = abandoned();
  const next = gameReducer(state, { type: "restart_settlement" });
  assert.deepEqual(next, DEFAULT_GAME_STATE);
  assert.notEqual(next, DEFAULT_GAME_STATE);
  assert.notEqual(next.tiles, DEFAULT_GAME_STATE.tiles);
  assert.notEqual(next.buildings, DEFAULT_GAME_STATE.buildings);
});
test("Given an ongoing game When restart action is sent Then it cannot discard active play", () => {
  assert.equal(gameReducer(DEFAULT_GAME_STATE, { type: "restart_settlement" }), DEFAULT_GAME_STATE);
});

test("Given abandonment When alternate frame or substep entrypoints are called Then no time advances", async () => {
  const { advanceFrame } = await import("../src/engine/frameClock");
  const { advanceSimulationSubstep } = await import("../src/engine/tick");
  const state = abandoned();
  assert.equal(advanceFrame(state, 5), state);
  assert.equal(advanceSimulationSubstep(state), state);
});
test("Given frame simulation When five substeps run Then objective time follows simulation ticks", async () => {
  const { advanceFrame } = await import("../src/engine/frameClock");
  const next = advanceFrame(DEFAULT_GAME_STATE, 5);
  assert.equal(next.tick, 5);
  assert.equal(next.wallTick, 1);
  assert.equal(next.settlement?.lastUpdatedTick, 5);
});
