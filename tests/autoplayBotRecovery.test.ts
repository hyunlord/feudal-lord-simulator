import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { houseFoodRation } from "../src/content/houseFoodConfig";
import { isBuildingConstructionSite } from "../src/economy/construction";
import { autoplayBuildAction, decideNextAction } from "../src/engine/autoplay";
import { backedUpBarns, barnMillAction, MILL_NEAR_BARN } from "../src/engine/autoplayBarnMill";
import { granaryGapAction, granaryGapHouses, insideWall, marketGapHouses, strandedMarketHouses, type BotRecoveryCollector } from "../src/engine/autoplayBotRecovery";
import { housingLotsStillNeeded, interiorHouseSites, keepsInteriorHouseSites } from "../src/engine/autoplayInteriorPlots";
import { logOverflowKind, timberDemandExpansionKind } from "../src/engine/autoplayTimberDemand";
import { autoplayEraAction, wallInteriorCells } from "../src/engine/autoplayEra";
import { stretchedWallCandidates, wallRoom, WALL_FREE_CELLS_PER_NEW_LOT, WALL_ROAD_SHARE_MAX } from "../src/engine/autoplayWallRoom";
import { confirmPalisadeProclamation } from "../src/engine/palisade";
import { computePalisadeProposalForState } from "../src/engine/palisadeFootprints";
import { runAutoplaySearch } from "../src/engine/autoplaySearchBudget";
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
// F0-A guardrail run 1 (2820a00), seed 4 at 1,200,000 ticks: L4 14/24, two edge barns with 800–900 wheat, nine central
// mills at 0–1 wheat (AR-8).
const SEED4_BARNS = "fixtures/autoplay/seed4-f0a-1200000.json.gz";
// BOT-2: seed 3 the tick before its palisade (F0-B..F0-C2 runs, 9 of 24 lots, water north and east), seed 1 the tick
// before its palisade (24 lots), and seed 5 with logs filling every storehouse (F0-C1 run 2, before AR-10).
const SEED3_PRE_PALISADE = "fixtures/autoplay/seed3-40763-pre-palisade.json.gz";
const SEED1_PRE_PALISADE = "fixtures/autoplay/seed1-78560-pre-palisade.json.gz";
const SEED5_LOG_OVERFLOW = "fixtures/autoplay/seed5-276000-log-overflow.json.gz";
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

test("B3 seed 2: the seven L3 homes the old radius left outside every market are served along the road now (MARKET-1), so no market gap remains", () => {
  const state = loadAutoplayFixture(SEED2_STALL);
  // Before MARKET-1 these seven homes stood more than 8 tiles from the one market (AR-2 built them a second). Within
  // 40 road steps they are served, and the recovery finds no gap.
  assert.deepEqual(marketGapHouses(state), []);
  const services = householdServices(state);
  const l3 = state.houses.filter(house => house.level === 3 && house.residents > 0);
  assert.ok(l3.length >= 7);
  assert.ok(l3.every(house => services.houses.get(house.buildingId)?.market.kind === "served"));
});

test("B5 seed 2: the home the old radius stranded at the market cap is served along the road now (MARKET-1), so nothing is demolished", () => {
  const state = loadAutoplayFixture(SEED2_STRANDED);
  // Before MARKET-1 house-46-42-0 was out of both markets' 8-tile reach at the cap, and AR-5 rebuilt it in reach.
  assert.deepEqual(strandedMarketHouses(state, POLICY.maxHousingLots), []);
  assert.equal(householdServices(state).houses.get("house-46-42-0")?.market.kind, "served");
  assert.notDeepEqual(decideNextAction(state, POLICY), { kind: "demolish_house", buildingId: "house-46-42-0" });
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
  // hold one home a level below at the last tick, so the check is "reached", not "at the last tick". F0-B: the dry
  // summer of 1341 brings a fire (EV-4) that burns three houses at tick 165,0xx; rebuilt and risen again, the town
  // reaches L4 24/24 within 60,000 ticks.
  const driver = createAutoplayTraceDriver({ id: "bot-recovery", source: "test", policy: POLICY });
  let later = lots;
  let reachedTick: number | null = null;
  for (let step = 0; step < 60_000 && reachedTick === null; step += 1) {
    later = advanceTick(driver.apply(later));
    if (reachedTick === null && housingLotCount(later) === 24 && later.houses.length === 24 && later.houses.every(house => house.level === 4)) reachedTick = later.tick;
  }
  assert.equal(housingLotCount(later), 24);
  assert.ok(reachedTick !== null, "L4 24/24");
});

test("B4 rules unchanged: the seed 3 stall state advanced 24,000 ticks without the advisor hashes as before BOT-1", () => {
  let state = loadAutoplayFixture(SEED3_STALL);
  for (let step = 0; step < 24_000; step += 1) state = advanceTick(state);
  // F0-C2: the history ledger records the run and never feeds it (spec HL-9), so the pin hashes the state without it.
  const { pathCache: _pathCache, history: _history, ...rest } = state;
  assert.equal(state.tick, 816_000);
  // Recorded at 46f0a54 (trunk before BOT-1) as 475317b0065127d3 / 8d2d3158…; F0-A changes the rules on purpose
  // (winter meals ×1.2, the failure ladder, seasons and eras in the state, spec FP-*), re-recorded at 2820a00.
  // F0-B changes the rules on purpose again (weather, fires, the dearth rehearsal, spec EV-*), re-recorded at F0-B; F0-C1
  // adds politics to the state (the economy hash stays), re-recorded at F0-C1. PERSON-0 adds the town's persons to the
  // state (the economy hash stays: a fed house fills a dead one's place at once), re-recorded at PERSON-0.
  assert.equal(hashEconomyState(state), "2616bef1538043ac");
  assert.equal(createHash("sha256").update(JSON.stringify(rest)).digest("hex"), "25ee1288136de94778291399ec31281f86ba252041ee83d31518936a6c01139f");
});

test("B8 seed 4 (F0-A run 1): backed-up edge barns get a mill beside them while homes lose levels, and the town reaches L4 24/24", () => {
  const state = loadAutoplayFixture(SEED4_BARNS);
  const barns = backedUpBarns(state);
  assert.deepEqual(barns.map(barn => `${barn.tx},${barn.ty}`).sort(), ["11,28", "11,33"]);
  const collector: BotRecoveryCollector = {};
  const action = barnMillAction(state, (current, kind, accepts) => autoplayBuildAction(current, kind, accepts), collector);
  assert.equal(action.kind, "place_building");
  assert.equal(collector.recovery?.[0]?.kind, "barn_mill");
  assert.ok(action.kind === "place_building" && Math.abs(action.tx - barns[0]!.tx) + Math.abs(action.ty - barns[0]!.ty) <= MILL_NEAR_BARN);
  const driver = createAutoplayTraceDriver({ id: "bot-recovery", source: "test", policy: POLICY });
  let current = state;
  let reached: number | null = null;
  for (let step = 0; step < 20_000 && reached === null; step += 1) {
    current = advanceTick(driver.apply(current));
    if (current.houses.filter(house => house.level === 4).length === 24) reached = current.tick;
  }
  assert.ok(reached !== null, "L4 24/24 within 20,000 ticks (it stood at 13–16 for 970,000 ticks)");
  assert.deepEqual(backedUpBarns(current), []);
});

test("B8 a healthy town with a full barn right after its harvest gets no barn mill (no home has lost a level)", () => {
  const state = loadAutoplayFixture(SEED4_BARNS);
  const healthy = { ...state, houses: state.houses.map(house => ({ ...house, level: Math.max(house.level, house.builtLevel ?? house.level) })) };
  assert.deepEqual(backedUpBarns(healthy), []);
});

test("B9 AR-11 seed 3: the hull of its buildings has no room for 15 more lots, so the bot proclaims a wall stretched toward open land", () => {
  const state = loadAutoplayFixture(SEED3_PRE_PALISADE);
  const remaining = 24 - housingLotCount(state);
  assert.equal(remaining, 15);
  // The old choice: the panel's first proposal, the hull of the buildings.
  const hull = computePalisadeProposalForState(state);
  assert.ok(hull.ok);
  const hullRoom = wallRoom(state, hull.path, remaining);
  assert.equal(hullRoom.interior, 131);
  assert.equal(hullRoom.roomy, false, `${hullRoom.free} free cells for ${remaining} lots`);
  // Stretched candidates exist only toward open land (south); every one encloses the core and clears the buildings.
  assert.ok(stretchedWallCandidates(state).length >= 1);
  const action = runAutoplaySearch(() => autoplayEraAction(state, (current, kind) => autoplayBuildAction(current, kind), 24));
  assert.equal(action.kind, "proclaim_era");
  const path = (action as { candidatePath: Parameters<typeof confirmPalisadeProclamation>[1] }).candidatePath;
  const room = wallRoom(state, path, remaining);
  assert.ok(room.roomy);
  assert.ok(room.free >= remaining * WALL_FREE_CELLS_PER_NEW_LOT && room.roads <= room.interior * WALL_ROAD_SHARE_MAX);
  const proclaimed = confirmPalisadeProclamation(state, path);
  assert.notEqual(proclaimed, state, "the stretched wall is a valid proclamation");
  assert.equal(wallInteriorCells(proclaimed), room.interior);
  assert.ok(room.interior > hullRoom.interior + 50, `${room.interior} cells`);
});

test("B9 AR-11 seed 1: a hamlet already at its lots proclaims the same wall as before (no room check)", () => {
  const state = loadAutoplayFixture(SEED1_PRE_PALISADE);
  assert.equal(housingLotCount(state), 24);
  const action = runAutoplaySearch(() => autoplayEraAction(state, (current, kind) => autoplayBuildAction(current, kind), 24));
  assert.equal(action.kind, "proclaim_era");
  const proclaimed = confirmPalisadeProclamation(state, (action as { candidatePath: Parameters<typeof confirmPalisadeProclamation>[1] }).candidatePath);
  assert.equal(wallInteriorCells(proclaimed), 182, "the wall of the F0-C2 guardrail run");
});

test("B10 AR-10 seed 5 (F0-C1 run 2): logs fill the storehouses while the sawmill is the short side, and the bot places another sawmill first", () => {
  const state = loadAutoplayFixture(SEED5_LOG_OVERFLOW);
  assert.equal(state.tick, 276_000);
  assert.equal(logOverflowKind(state), "sawmill");
  const action = runAutoplaySearch(() => decideNextAction(state));
  assert.equal(action.kind, "place_building");
  assert.equal((action as { building: string }).building, "sawmill");
});
