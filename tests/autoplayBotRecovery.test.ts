import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { decideNextAction } from "../src/engine/autoplay";
import { granaryGapHouses, marketGapAction, marketGapHouses, type BotRecoveryCollector } from "../src/engine/autoplayBotRecovery";
import type { GameState } from "../src/engine/engine.types";
import { householdServices } from "../src/engine/householdServices";
import { advanceTick } from "../src/engine/tick";
import { createAutoplayTraceDriver } from "../scripts/economyHarnessAutoplay";
import { hashEconomyState } from "../scripts/economyHarnessSerializer";
import { loadAutoplayFixture } from "../scripts/autoplayStallProbe";

// Natural autoplay states (C3 engine 056d8dc, efficientGrowthRun 24 lots) where seeds 2 and 3 stood still (decision LB9).
const SEED2_STALL = "fixtures/autoplay/seed2-408000.json.gz";
const SEED3_STALL = "fixtures/autoplay/seed3-792000.json.gz";
const POLICY = { maxHousingLots: 24 } as const;

function runWithAdvisor(state: GameState, ticks: number): GameState {
  const driver = createAutoplayTraceDriver({ id: "bot-recovery", source: "test", policy: POLICY });
  let current = state;
  for (let step = 0; step < ticks; step += 1) current = advanceTick(driver.apply(current));
  return current;
}

test("B2 a town whose homes are fed and served reports no granary or market gap", () => {
  const seed2 = loadAutoplayFixture(SEED2_STALL);
  assert.deepEqual(granaryGapHouses(seed2), [], "every seed 2 home holds bread");
  const seed3 = loadAutoplayFixture(SEED3_STALL);
  assert.deepEqual(marketGapHouses(seed3), [], "every seed 3 home has a market");
  assert.deepEqual(granaryGapHouses({ ...seed3, palisade: null }), [], "the granary gap is a walled-town diagnosis");
  const capped = { ...seed2, buildings: [...seed2.buildings, { ...seed2.buildings.find(building => building.kind === "market")!, id: "second-market", tx: 0, ty: 0 }] };
  assert.deepEqual(marketGapHouses(capped), [], "no market gap once the market cap (lots ÷ 24 + 1) is reached");
});

test("B3 seed 2: seven L3 homes outside every market's reach get a market the service planner refused, and it serves them", () => {
  const state = loadAutoplayFixture(SEED2_STALL);
  const gap = marketGapHouses(state);
  assert.equal(gap.length, 7);
  for (const home of gap) {
    const house = state.houses.find(candidate => candidate.buildingId === home.id);
    assert.equal(house?.level, 3);
  }
  const collector: BotRecoveryCollector = {};
  const action = marketGapAction(state, collector);
  assert.equal(action.kind, "place_building");
  assert.equal(collector.recovery?.[0]?.kind, "market_gap");
  assert.equal(collector.recovery?.[0]?.houses.length, 7);
  const diagnostic: BotRecoveryCollector = {};
  assert.deepEqual(decideNextAction(state, POLICY, diagnostic), action, "the advisor takes the recovery");
  const later = runWithAdvisor(state, 2_400);
  assert.equal(later.buildings.filter(building => building.kind === "market").length, 2);
  const served = householdServices(later);
  assert.ok(gap.filter(home => served.houses.get(home.id)?.market.kind === "served").length >= 2);
  for (const house of state.houses) {
    const before = householdServices(state).houses.get(house.buildingId);
    const after = served.houses.get(house.buildingId);
    for (const service of ["water", "market", "church"] as const) {
      if (before?.[service].kind === "served") assert.equal(after?.[service].kind, "served", `${house.buildingId} keeps ${service}`);
    }
  }
});

test("B4 rules unchanged: the seed 3 stall state advanced 24,000 ticks without the advisor hashes as before BOT-1", () => {
  let state = loadAutoplayFixture(SEED3_STALL);
  for (let step = 0; step < 24_000; step += 1) state = advanceTick(state);
  const { pathCache: _pathCache, ...rest } = state;
  assert.equal(state.tick, 816_000);
  // Recorded at 46f0a54 (trunk before BOT-1).
  assert.equal(hashEconomyState(state), "475317b0065127d3");
  assert.equal(createHash("sha256").update(JSON.stringify(rest)).digest("hex"), "8d2d3158b34ee536fc261cdcd6bb3193122242e17ce1eff0295f0b886eae79df");
});
