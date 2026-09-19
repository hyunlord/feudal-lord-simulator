import assert from "node:assert/strict";
import test from "node:test";
import { hashEconomyState } from "../scripts/economyHarnessSerializer";
import { palisade, palisadeSegment } from "./stoneWallConversionFixtures";
import { settlementProgress } from "../src/engine/settlementProgress";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";

test("economy hashes distinguish hunger duration and settlement outcomes", () => {
  const state = DEFAULT_GAME_STATE;
  const baseline = hashEconomyState(state);
  assert.notEqual(hashEconomyState({ ...state, houses: state.houses.map(house => ({ ...house, emptyFoodTicks: 301 })) }), baseline);
  const progress = settlementProgress(state);
  const ongoing = { ...state, settlement: progress };
  assert.notEqual(hashEconomyState({ ...ongoing, settlement: { ...progress, outcome: "abandoned" } }), hashEconomyState(ongoing));
  assert.notEqual(hashEconomyState({ ...ongoing, settlement: { ...progress, selfSufficientTicks: 599 } }), hashEconomyState(ongoing));
  assert.equal(hashEconomyState(structuredClone(ongoing)), hashEconomyState(ongoing));
});


test("economy hashes include canonical auxiliary gates while preserving legacy empty gates", () => {
  const wall = palisade([palisadeSegment(0)]);
  const state = { ...DEFAULT_GAME_STATE, palisade: wall };
  const hash = (additionalGates: readonly { x: number; y: number }[]) =>
    hashEconomyState({ ...state, palisade: { ...wall, additionalGates } });
  assert.equal(hash([]), hashEconomyState(state));
  assert.equal(hash([wall.gate]), hashEconomyState(state));
  const first = { x: 4, y: 2 };
  const second = { x: 6, y: 4 };
  assert.notEqual(hash([first]), hashEconomyState(state));
  assert.notEqual(hash([first]), hash([second]));
  assert.equal(hash([first, second]), hash([second, first, first, wall.gate]));
});
