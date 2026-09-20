import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { parseGrowthOptions } from "../scripts/phase19GrowthMetrics";
import { createGrowthInitialState, createGrowthStability } from "../scripts/phase19GrowthRunControl";
import { createGrowthObservations } from "../scripts/phase19GrowthObservations";

test("seed selection regenerates terrain deterministically and seed one preserves the opening state", () => {
  const original = structuredClone(DEFAULT_GAME_STATE);
  assert.deepEqual(createGrowthInitialState(1), original);
  assert.deepEqual(createGrowthInitialState(1), createGrowthInitialState(1));
  assert.deepEqual(DEFAULT_GAME_STATE, original);
});

test("CLI preserves positional arguments and accepts a bounded optional seed and extended budget", () => {
  assert.deepEqual(parseGrowthOptions(["24"]), { targetLots: 24, maxTicks: 600000, seed: 1 });
  assert.deepEqual(parseGrowthOptions(["24", "1200000", "output", "5"]), { targetLots: 24, maxTicks: 1200000, seed: 5 });
  for (const args of [["24", "1200001"], ["24", "20", "output", "6"], ["24", "20", "output", "1.5"]]) {
    assert.throws(() => parseGrowthOptions(args), RangeError);
  }
});

test("stable victory at a smaller city cannot consume the target city's stability window", () => {
  const stability = createGrowthStability(24);
  for (let tick = 1; tick <= 25000; tick++) stability.observe({ tick, lots: 8, victory: true, fullService: true });
  assert.equal(stability.report().sustainedTicks, 0);
  for (let tick = 25001; tick <= 49000; tick++) stability.observe({ tick, lots: 24, victory: true, fullService: true });
  assert.equal(stability.report().complete, true);
  stability.observe({ tick: 49001, lots: 24, victory: true, fullService: false });
  assert.equal(stability.report().sustainedTicks, 0);
});

function overloadedWell() {
  const state = structuredClone(DEFAULT_GAME_STATE);
  const house = state.houses[0];
  const home = state.buildings.find(building => building.kind === "house");
  const well = state.buildings.find(building => building.kind === "well");
  assert.ok(house && home && well);
  state.houses = Array.from({ length: 13 }, (_, index) => ({ ...house, buildingId: `home-${index}` }));
  state.buildings = [well, ...state.houses.map(item => ({ ...home, id: item.buildingId }))];
  return { state, well };
}

test("capacity denial changing to missing remains unresolved until the affected home is served", () => {
  const { state, well } = overloadedWell();
  const observer = createGrowthObservations();
  observer.observe(state);
  observer.observe({ ...state, tick: 1, buildings: state.buildings.filter(building => building.id !== well.id) });
  assert.equal(observer.report().episodes[0]?.endedTick, 1);
  assert.equal(observer.report().episodes[0]?.recoveredTick, null);
  assert.equal(observer.report().unresolvedCapacityEpisodes, 1);
  observer.observe({ ...state, tick: 2, buildings: [...state.buildings, { ...well, id: "second-well" }] });
  assert.equal(observer.report().episodes[0]?.recoveredTick, 2);
  assert.equal(observer.report().unresolvedCapacityEpisodes, 0);
});

test("removing a denied house cannot be reported as service recovery", () => {
  const { state } = overloadedWell();
  const observer = createGrowthObservations();
  observer.observe(state);
  const deniedId = observer.report().episodes[0]?.affectedHouseIds[0];
  assert.ok(deniedId);
  observer.observe({ ...state, tick: 1, houses: state.houses.filter(house => house.buildingId !== deniedId),
    buildings: state.buildings.filter(building => building.id !== deniedId) });
  assert.equal(observer.report().episodes[0]?.endedTick, 1);
  assert.equal(observer.report().unresolvedCapacityEpisodes, 1);
});

test("approved translated seed two is explicitly labeled as a verification fixture", async () => {
  const { runPhase19NaturalGrowth } = await import("../scripts/phase19NaturalGrowth");
  const report = runPhase19NaturalGrowth({ targetLots: 24, maxTicks: 1, seed: 2 });
  assert.equal(report.seed, 2);
  assert.equal(report.opening.mode, "translated-verification-fixture");
  assert.equal(report.opening.productSeedFeature, false);
  assert.deepEqual(report.opening.offset, { tx: 0, ty: -3 });
  assert.equal(report.final.tick, 1);
  assert.equal(report.acceptance.targetReached, false);
});
