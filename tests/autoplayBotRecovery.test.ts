import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { houseFoodRation } from "../src/content/houseFoodConfig";
import { isBuildingConstructionSite } from "../src/economy/construction";
import { decideNextAction } from "../src/engine/autoplay";
import { granaryGapAction, granaryGapHouses, insideWall, marketGapAction, marketGapHouses, strandedMarketHouses, type BotRecoveryCollector } from "../src/engine/autoplayBotRecovery";
import { housingLotsStillNeeded, interiorHouseSites, keepsInteriorHouseSites } from "../src/engine/autoplayInteriorPlots";
import { timberDemandExpansionKind } from "../src/engine/autoplayTimberDemand";
import { timberExpansionKind } from "../src/engine/autoplayTimberRecovery";
import { housingLotCount } from "../src/population/housing";
import type { GameState } from "../src/engine/engine.types";
import { householdServices } from "../src/engine/householdServices";
import { advanceTick } from "../src/engine/tick";
import { createAutoplayTraceDriver } from "../scripts/economyHarnessAutoplay";
import { hashEconomyState } from "../scripts/economyHarnessSerializer";
import { loadAutoplayFixture } from "../scripts/autoplayStallProbe";

// Natural autoplay states (C3 engine 056d8dc, efficientGrowthRun 24 lots) where seeds 2 and 3 stood still (decision LB9).
const SEED2_STALL = "fixtures/autoplay/seed2-408000.json.gz";
const SEED3_STALL = "fixtures/autoplay/seed3-792000.json.gz";
// Natural BOT-1 autoplay state (ce19c57, seed 3): the advisor's first granary_gap decision, right after the palisade.
const SEED3_GRANARY_GAP = "fixtures/autoplay/seed3-42908.json.gz";
// Guardrail run 1 (ce19c57), seed 2: the end at 1,200,000 ticks (L4 23/24, one home out of both markets' reach) and
// the state 51 ticks after its palisade proclamation (146 timber, 1,078 wall timber waiting).
const SEED2_STRANDED = "fixtures/autoplay/seed2-1200000.json.gz";
const SEED2_PALISADE = "fixtures/autoplay/seed2-70140.json.gz";
// Guardrail run 2 (01c7106; replayed at 5f974bb, same advisor), seed 3 at 120,000 ticks: 21 lots, 16 free interior house
// sites, no church in any home's reach. Run 2 stopped here at 22 lots (decision BT8).
const SEED3_INTERIOR = "fixtures/autoplay/seed3-120000.json.gz";
const POLICY = { maxHousingLots: 24 } as const;

function runWithAdvisor(state: GameState, ticks: number): GameState {
  const driver = createAutoplayTraceDriver({ id: "bot-recovery", source: "test", policy: POLICY });
  let current = state;
  for (let step = 0; step < ticks; step += 1) current = advanceTick(driver.apply(current));
  return current;
}

test("B1 seed 3: walled homes out of every granary's reach get a granary inside the wall beside them, and hold bread", () => {
  const state = loadAutoplayFixture(SEED3_GRANARY_GAP);
  const gap = granaryGapHouses(state);
  assert.equal(gap.length, 3);
  for (const home of gap) {
    const house = state.houses.find(candidate => candidate.buildingId === home.id);
    assert.ok(house !== undefined && house.breadStock <= houseFoodRation(house), `${home.id} is down to its last ration`);
  }
  const collector: BotRecoveryCollector = {};
  const diagnostic: BotRecoveryCollector = {};
  const first = decideNextAction(state, POLICY, diagnostic);
  assert.equal(diagnostic.recovery?.[0]?.kind, "granary_gap", "the advisor takes the recovery before timber (a road toward the site first)");
  assert.equal(first.kind, "place_road");
  assert.notEqual(granaryGapAction(state, () => ({ kind: "none" }), collector).kind, "place_building");
  assert.equal(collector.recovery?.[0]?.note, "no_site");
  const later = runWithAdvisor(state, 3_300);
  const granaries = later.buildings.filter(building => building.kind === "granary");
  const added = granaries.filter(granary => !state.buildings.some(old => old.id === granary.id));
  assert.equal(added.length, 1);
  assert.ok(insideWall(later, "granary", added[0]!), "the new granary stands inside the wall");
  assert.deepEqual(granaryGapHouses(later), []);
  for (const home of gap) assert.ok((later.houses.find(house => house.buildingId === home.id)?.breadStock ?? 0) > 0, `${home.id} holds bread`);
});

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
  // Homes still standing keep every service; a stranded one may have been demolished for relocation (B5).
  for (const house of state.houses.filter(old => later.houses.some(current => current.buildingId === old.buildingId))) {
    const before = householdServices(state).houses.get(house.buildingId);
    const after = served.houses.get(house.buildingId);
    for (const service of ["water", "market", "church"] as const) {
      if (before?.[service].kind === "served") assert.equal(after?.[service].kind, "served", `${house.buildingId} keeps ${service}`);
    }
  }
});

test("B5 seed 2: the home no market can reach at the cap is demolished and its lot rebuilt in reach, and the town reaches L4 24/24", () => {
  const state = loadAutoplayFixture(SEED2_STRANDED);
  const stranded = strandedMarketHouses(state, POLICY.maxHousingLots);
  assert.deepEqual(stranded.map(home => home.id), ["house-46-42-0"]);
  const diagnostic: BotRecoveryCollector = {};
  assert.deepEqual(decideNextAction(state, POLICY, diagnostic), { kind: "demolish_house", buildingId: "house-46-42-0" });
  assert.equal(diagnostic.recovery?.[0]?.kind, "market_relocation");
  const later = runWithAdvisor(state, 14_400);
  assert.equal(housingLotCount(later), 24);
  assert.ok(!later.houses.some(house => house.buildingId === "house-46-42-0"));
  const served = householdServices(later);
  assert.ok(later.houses.every(house => served.houses.get(house.buildingId)?.market.kind === "served"), "every home has a market");
  assert.ok(later.houses.every(house => house.level === 4), "L4 24/24");
  assert.equal(later.buildings.filter(building => building.kind === "market").length, 2, "within the market cap");
});

test("B6 seed 2 right after the palisade: timber is added for the waiting wall while the stock is there (S8-F1 would wait)", () => {
  const state = loadAutoplayFixture(SEED2_PALISADE);
  assert.equal(timberExpansionKind(state), null, "S8-F1: no shortage window yet");
  assert.equal(timberDemandExpansionKind(state), "logging_camp", "logs are the short side: 1 camp cuts 0.02/tick, 1 sawmill saws 0.057");
  const camps = (current: typeof state) => current.buildings.filter(building => building.kind === "logging_camp").length
    + current.constructionSites.filter(site => site.kind === "logging_camp").length;
  const later = runWithAdvisor(state, 3_600);
  assert.ok(camps(later) >= camps(state) + 2, "two logging camps within 3,600 ticks");
});

test("B7 seed 3 run 2: the walled town keeps house sites for its last lots, builds them, and reaches L4 24/24", () => {
  const state = loadAutoplayFixture(SEED3_INTERIOR);
  assert.equal(housingLotCount(state), 21);
  assert.equal(housingLotsStillNeeded(state, POLICY.maxHousingLots), 3);
  assert.equal(interiorHouseSites(state).length, 16);
  const church = (tx: number, ty: number) => ({ kind: "place_building", building: "church", tx, ty }) as const;
  assert.equal(keepsInteriorHouseSites(state, church(5, 7), POLICY.maxHousingLots, "check"), false,
    "run 2's church site inside the wall leaves fewer house sites than the three lots still to build");
  assert.equal(keepsInteriorHouseSites(state, church(6, 16), POLICY.maxHousingLots, "check"), true, "a church outside the wall leaves them");
  assert.deepEqual(decideNextAction(state, POLICY), { kind: "place_road", from: { tx: 6, ty: 9 }, to: { tx: 6, ty: 9 } },
    "the house search reaches the interior sites (run 2 spent its phase budget on the map before them)");
  const lots = runWithAdvisor(state, 4_800);
  assert.equal(housingLotCount(lots), 24);
  const churches = [...lots.buildings, ...lots.constructionSites.filter(isBuildingConstructionSite)].filter(site => site.kind === "church");
  assert.equal(churches.length, 1);
  assert.ok(!insideWall(lots, "church", churches[0]!), "the town's first church goes outside the wall");
  // F0-A: the town reaches L4 24/24 within the 48,000 ticks; a household's bread gap (winter meals ×1.2) may still
  // hold one home a level below at the last tick, so the check is "reached", not "at the last tick".
  const driver = createAutoplayTraceDriver({ id: "bot-recovery", source: "test", policy: POLICY });
  let later = lots;
  let reachedTick: number | null = null;
  for (let step = 0; step < 48_000; step += 1) {
    later = advanceTick(driver.apply(later));
    if (reachedTick === null && housingLotCount(later) === 24 && later.houses.length === 24 && later.houses.every(house => house.level === 4)) reachedTick = later.tick;
  }
  assert.equal(housingLotCount(later), 24);
  assert.ok(reachedTick !== null, "L4 24/24");
});

test("B4 rules unchanged: the seed 3 stall state advanced 24,000 ticks without the advisor hashes as before BOT-1", () => {
  let state = loadAutoplayFixture(SEED3_STALL);
  for (let step = 0; step < 24_000; step += 1) state = advanceTick(state);
  const { pathCache: _pathCache, ...rest } = state;
  assert.equal(state.tick, 816_000);
  // Recorded at 46f0a54 (trunk before BOT-1) as 475317b0065127d3 / 8d2d3158…; F0-A changes the rules on purpose
  // (winter meals ×1.2, the failure ladder, seasons and eras in the state, spec FP-*), re-recorded at 2820a00.
  assert.equal(hashEconomyState(state), "211657f1e619938a");
  assert.equal(createHash("sha256").update(JSON.stringify(rest)).digest("hex"), "6a7827603ad2392f743ecbb326fecb29f4f4ccf78ba55d6255f49eee17068592");
});
