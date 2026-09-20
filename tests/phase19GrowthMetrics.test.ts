import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { growthSnapshot, growthGuards, parseGrowthOptions } from "../scripts/phase19GrowthMetrics";

test("Given the opening village When growth metrics are observed Then actual lots and missing services are distinguished", () => {
  const current = growthSnapshot(structuredClone(DEFAULT_GAME_STATE));
  assert.equal(current.lots, 4);
  assert.equal(current.houses, 4);
  assert.equal(current.services.market.missing, 4);
  assert.equal(current.services.market.capacity, 0);
  assert.equal(current.providers.length, 1);
});

test("Given a larger target after stone-town proclamation When growth guards are inspected Then the structural routing ceiling is explicit", () => {
  const current = { ...structuredClone(DEFAULT_GAME_STATE), era: "stone_town" as const };
  assert.ok(growthGuards(current, 16).includes("post-era-housing-disabled"));
  assert.ok(!growthGuards(current, 16).includes("lot-limit"));
});

test("Given invalid or unbounded CLI inputs When options are parsed Then the diagnostic run is rejected", () => {
  for (const args of [["0"], ["16", "0"], ["16", "600001"], ["NaN"], ["16.5"]]) {
    assert.throws(() => parseGrowthOptions(args), RangeError);
  }
  assert.deepEqual(parseGrowthOptions(["16"]), { targetLots: 16, maxTicks: 600000 });
});

test("Given a zero-capacity-denial opening village When observation repeats Then no capacity episode is invented", async () => {
  const { createGrowthObservations } = await import("../scripts/phase19GrowthObservations");
  const observer = createGrowthObservations();
  observer.observe(structuredClone(DEFAULT_GAME_STATE));
  observer.observe(structuredClone(DEFAULT_GAME_STATE));
  assert.equal(observer.report().episodes.length, 0);
  assert.equal(observer.report().providerEvents.filter(event => event.kind === "completed").length, 1);
});

test("Given thirteen colocated lots and one reachable well When a lot disappears Then one real capacity-denial episode closes", async () => {
  const { createGrowthObservations } = await import("../scripts/phase19GrowthObservations");
  const state = structuredClone(DEFAULT_GAME_STATE);
  const house = state.houses[0];
  const home = state.buildings.find(building => building.kind === "house");
  const well = state.buildings.find(building => building.kind === "well");
  assert.ok(house && home && well);
  state.houses = Array.from({ length: 13 }, (_, index) => ({ ...house, buildingId: `home-${index}` }));
  state.buildings = [well, ...state.houses.map(item => ({ ...home, id: item.buildingId }))];
  const observer = createGrowthObservations();
  observer.observe(state);
  observer.observe({ ...state, tick: 1, houses: state.houses.slice(1), buildings: [well, ...state.buildings.slice(2)] });
  const report = observer.report();
  assert.equal(report.episodes.length, 1);
  assert.equal(report.episodes[0]?.service, "water");
  assert.equal(report.episodes[0]?.maximumDeniedHouses, 1);
  assert.equal(report.episodes[0]?.endedTick, 1);
});

test("Given a one-tick natural budget When the diagnostic harness runs Then unmet scale cannot pass and default state stays unchanged", async () => {
  const { runPhase19NaturalGrowth } = await import("../scripts/phase19NaturalGrowth");
  const initial = structuredClone(DEFAULT_GAME_STATE);
  const report = runPhase19NaturalGrowth({ targetLots: 16, maxTicks: 1 });
  assert.equal(report.status, "acceptance-unmet");
  assert.equal(report.targetReachedTick, null);
  assert.equal(report.final.tick, 1);
  assert.equal(report.policy.maxHousingLots, 16);
  assert.deepEqual(DEFAULT_GAME_STATE, initial);
});
