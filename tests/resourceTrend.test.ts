import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { advanceResourceHistory, resourceSample, resourceTrend, breadHouseholdPortions } from "../src/ui/resourceTrend";

test("Given advancing snapshots When measuring trends Then only observed ticks and spendable stock are used", () => {
  const first = resourceSample({ ...DEFAULT_GAME_STATE, tick: 10, treasuryTimber: 10 });
  const last = resourceSample({ ...DEFAULT_GAME_STATE, tick: 110, treasuryTimber: 15 });
  const history = advanceResourceHistory([first], last);
  assert.deepEqual(resourceTrend(history, "timber", false), { delta: 5, ticks: 100 });
  assert.equal(resourceTrend(history, "timber", true), null);
});
test("Given long history When ticks advance or restart Then samples stay bounded and reset", () => {
  let history = [resourceSample(DEFAULT_GAME_STATE)];
  for (let tick = 1; tick <= 5000; tick++) history = advanceResourceHistory(history, resourceSample({ ...DEFAULT_GAME_STATE, tick }));
  assert.ok(history.length <= 122);
  const first = history[0];
  const last = history.at(-1);
  assert.ok(first && last);
  assert.ok(last.tick - first.tick <= 2400);
  assert.equal(advanceResourceHistory(history, resourceSample(DEFAULT_GAME_STATE)).length, 1);
  assert.equal(advanceResourceHistory(history, resourceSample({ ...DEFAULT_GAME_STATE, tick: 5001, seed: 99 })).length, 1);
});
test("Given occupied merged housing When estimating bread portions Then ration and two residential lots determine average household equivalents", () => {
  const house = DEFAULT_GAME_STATE.houses[0];
  const building = DEFAULT_GAME_STATE.buildings[0];
  assert.ok(house && building);
  const state = { ...DEFAULT_GAME_STATE, houses: [{ ...house, buildingId: "merged", residents: 32 }], buildings: [{ ...building, id: "merged", kind: "house" as const, houseLot: "horizontal" as const }] };
  assert.equal(breadHouseholdPortions(state, 12), 6);
  assert.equal(breadHouseholdPortions({ ...state, houses: [] }, 12), null);
});

test("Given a single tick When stocks change without simulation time Then no rate is invented", () => {
  const first = resourceSample(DEFAULT_GAME_STATE);
  const second = resourceSample({ ...DEFAULT_GAME_STATE, treasuryTimber: 999 });
  const history = advanceResourceHistory([first], second);
  assert.equal(history.length, 1);
  assert.equal(resourceTrend(history, "timber", false), null);
});
