/**
 * FAIL-3 failure ladder 3–4 and the chapter continuation (spec docs/design/failure-ladder-campaign.md FL-1…FL-12):
 * scenarios F1–F8.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { BALANCE, MONEY_BALANCE, PRESSURE_BALANCE } from "../src/content/balanceConfig";
import { BUILDING_CONFIG_BY_KIND, type Building } from "../src/content/buildingConfig";
import { CAMPAIGN_CHAPTERS, CHAPTER_TWO, RESTORE_RIGHT_PETITION_ID } from "../src/content/chapterConfig";
import { GREAT_FAMINE_EVENT_ID } from "../src/content/eventConfig";
import { LORDSHIP_BALANCE, LORD_HOUSE_NAMES } from "../src/content/lordshipConfig";
import { SANDBOX_SCENARIO_ID } from "../src/content/scenario/coreScenarios";
import { chapterDecisionAction } from "../src/engine/autoplayEvents";
import type { GameState } from "../src/engine/engine.types";
import { advanceLordship, arrearsPeriods, declineCause, derelictPermille } from "../src/engine/lordship";
import { lordHouse, lordRights, lordshipOf, lordTitle } from "../src/engine/lordshipState";
import { settleMoneyPeriod } from "../src/engine/moneyRules";
import { advancePolitics, chapterGoals, initialPolitics, openPetitions, respondToPetition } from "../src/engine/politics";
import { advanceSeasons } from "../src/engine/seasonPressure";
import { updateSettlementProgress } from "../src/engine/settlementProgress";
import { advanceHistory, historySummary } from "../src/engine/history";
import { LEDGER_PERIOD_TICKS, postLedgerEntries, treasuryBalance } from "../src/ledger/ledger";
import { decodeSave, encodeSave } from "../src/save/saveCodec";
import { SAVE_SCHEMA_VERSION } from "../src/save/saveTypes";

const SEASON = PRESSURE_BALANCE.seasonTicks;
const YEAR = BALANCE.TICKS_PER_YEAR;

/** A walled market town of 24 houses (v18 fixture), one of its palisade's gates built, a market standing, 400d in hand. */
function city(): GameState {
  const state = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v18/palisade-construction.save.json"))).envelope.state as GameState;
  const market: Building = { id: "market-f", kind: "market", tx: 1, ty: 1, workers: BUILDING_CONFIG_BY_KIND.market.workersRequired,
    inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
  const tick = Math.ceil((state.tick + 1) / YEAR) * YEAR;
  const palisade = state.palisade === null ? null : { ...state.palisade,
    segments: state.palisade.segments.map((segment, index) => index === 0 ? { ...segment, completed: true } : segment) };
  const funded = postLedgerEntries({ ...state, tick }, [{ account: "cash", category: "opening_balance", amount: 400 - treasuryBalance(state),
    sourceRefs: [{ type: "scenario", id: "failure-ladder-test" }] }]);
  return { ...state, tick, palisade, buildings: [...state.buildings, market], treasuryCoin: funded.treasuryCoin, ledger: funded.ledger, politics: initialPolitics(state) };
}
/** Marks the first `count` houses derelict (FP-3 stage 2: empty, standing). */
function derelict(state: GameState, count: number): GameState {
  return { ...state, houses: state.houses.map((house, index) => index < count ? { ...house, residents: 0, breadStock: 0, abandonedTick: state.tick - SEASON } : house) };
}
/** Unpaid upkeep spread over `periods` ledger periods. */
function inArrears(state: GameState, periods: number): GameState {
  const arrears = Array.from({ length: periods }, (_, index) => ({ tick: state.tick - (index + 1) * LEDGER_PERIOD_TICKS, amount: 8,
    facility: { type: "building" as const, id: state.buildings[0]!.id } }));
  return { ...state, money: { crossings: {}, millWheat: {}, ...(state.money ?? {}), arrears } };
}
const atSeasonStart = (state: GameState, tick = state.tick) => advanceLordship({ ...state, tick: tick - tick % SEASON });

test("F1 (FL-3, FL-4, FL-5) a third of the houses derelict: the merchants seize the market's dues, the title is demoted, the ledger says so", () => {
  const base = city();
  assert.equal(base.houses.length, 24);
  const before = lordRights(base);
  assert.deepEqual(before.map(right => [right.id, right.present, right.status]), [["market", true, "held"], ["tolls", true, "held"], ["mill", true, "held"]]);
  assert.equal(lordTitle(base).rank, "market");
  const ruined = derelict(base, 8);
  assert.equal(derelictPermille(ruined), 333);
  assert.equal(declineCause(ruined), "derelict");
  const declined = atSeasonStart(ruined);
  const lordship = lordshipOf(declined);
  assert.deepEqual(lordship.decline && { cause: lordship.decline.cause, lost: lordship.decline.lost, by: lordship.decline.by }, { cause: "derelict", lost: "market", by: "merchants" });
  assert.deepEqual(lordRights(declined).find(right => right.id === "market"), { id: "market", present: true, status: "seized", by: "merchants", since: declined.tick });
  assert.deepEqual(lordTitle(declined), { rank: "manor", base: "market", demoted: true });
  // The period close no longer pays the stall fees to the treasury.
  const periodTick = declined.tick + LEDGER_PERIOD_TICKS - declined.tick % LEDGER_PERIOD_TICKS;
  const settled = settleMoneyPeriod({ ...declined, tick: periodTick });
  assert.equal(settled.ledger!.entries.some(entry => entry.tick === periodTick && entry.category === "stall_fee"), false);
  // The ledger names it; the next season's close carries the line.
  const recorded = advanceHistory(ruined, declined);
  const record = recorded.history!.records.find(entry => entry.template === "decline.entered")!;
  assert.equal(historySummary(record), "영지가 쇠퇴했다 — 빈 필지가 늘어, 시장 좌판세를 상인들이 가져갔고 칭호가 강등되었다");
  const closed = advanceSeasons({ ...declined, tick: declined.tick + SEASON }).seasons!.history.at(-1)!;
  assert.deepEqual(closed.lordship, { declined: { cause: "derelict", right: "market", by: "merchants" } });
});

test("F2 (FL-3, FL-4) unpaid upkeep over four periods: the overlord takes the tolls in custody first, and the title is demoted", () => {
  const owing = inArrears(city(), 4);
  assert.equal(arrearsPeriods(owing), 4);
  assert.equal(declineCause(owing), "arrears");
  const declined = atSeasonStart(owing);
  assert.deepEqual(lordRights(declined).find(right => right.id === "tolls")?.status, "suspended");
  assert.equal(lordshipOf(declined).decline!.by, "overlord");
  assert.equal(lordTitle(declined).demoted, true);
  // Both causes at once: the arrears are the cause.
  assert.equal(declineCause(derelict(owing, 8)), "arrears");
  // Without a gate the mill's dues go first; a town holding no right loses none, only its title.
  const noGate = { ...owing, palisade: owing.palisade === null ? null : { ...owing.palisade, segments: owing.palisade.segments.map(segment => ({ ...segment, completed: false })) } };
  assert.equal(lordshipOf(atSeasonStart(noGate)).decline!.lost, "mill");
  const bare = { ...noGate, buildings: noGate.buildings.filter(building => building.kind !== "mill" && building.kind !== "market") };
  const titleOnly = atSeasonStart(inArrears({ ...bare, buildings: [...bare.buildings, { ...noGate.buildings.find(building => building.kind === "mill")!, kind: "well" as const }] }, 4));
  assert.equal(lordshipOf(titleOnly).decline!.lost, null);
  assert.equal(lordTitle(titleOnly).demoted, true);
});

test("F3 (FL-3) below the lines no decline: 29 % derelict, three periods owed, and a town under eight houses is not counted", () => {
  const base = city();
  assert.equal(declineCause(derelict(base, 7)), null, "7 of 24 = 29 %");
  assert.equal(declineCause(inArrears(base, 3)), null);
  assert.equal(atSeasonStart(derelict(base, 7)).lordship, undefined, "nothing changes");
  const small = { ...base, houses: base.houses.slice(0, 7) };
  assert.equal(derelictPermille(derelict(small, 5)), null);
  // Off a season's start the ladder does not step.
  const ruined = derelict(base, 8);
  assert.equal(advanceLordship({ ...ruined, tick: ruined.tick - ruined.tick % SEASON + 1 }).lordship, undefined);
});

test("F4 (FL-6) the cause cleared: the holder offers the right back — bought, haggled or refused", () => {
  const declined = atSeasonStart(derelict(city(), 8));
  // Still derelict: no offer.
  assert.equal(openPetitions(atSeasonStart(declined, declined.tick + SEASON)).length, 0);
  const cleared = atSeasonStart(city() && { ...declined, houses: city().houses }, declined.tick + SEASON);
  const petition = openPetitions(cleared)[0]!;
  assert.equal(petition.defId, RESTORE_RIGHT_PETITION_ID);
  assert.equal(petition.petitioner, "merchants");
  const cash = treasuryBalance(cleared);
  const bought = respondToPetition(cleared, petition.id, "accept");
  assert.equal(treasuryBalance(bought), cash - LORDSHIP_BALANCE.restoreFee);
  assert.equal(lordshipOf(bought).decline, null);
  assert.deepEqual(lordRights(bought).find(right => right.id === "market")?.status, "held");
  assert.equal(lordTitle(bought).demoted, false);
  const haggled = respondToPetition(cleared, petition.id, "accept_with_price");
  assert.equal(treasuryBalance(haggled), cash - LORDSHIP_BALANCE.restoreFeeHaggled);
  assert.equal(lordTitle(haggled).demoted, true, "the title comes a year later");
  assert.equal(lordTitle(advanceLordship({ ...haggled, tick: haggled.tick + LORDSHIP_BALANCE.titleReturnTicks })).demoted, false);
  const refused = respondToPetition(cleared, petition.id, "refuse");
  assert.equal(treasuryBalance(refused), cash);
  assert.equal(lordshipOf(refused).decline!.petitionFrom, cleared.tick + LORDSHIP_BALANCE.restoreRetryTicks);
  assert.equal(openPetitions(atSeasonStart(refused, refused.tick + SEASON)).length, 0, "not again before a year");
  assert.equal(openPetitions(atSeasonStart(refused, refused.tick + LORDSHIP_BALANCE.restoreRetryTicks)).length, 1);
  // A treasury short of the fee restores nothing.
  const { ledger: _ledger, ...unledgered } = cleared;
  const poor = respondToPetition({ ...unledgered, treasuryCoin: 10 }, petition.id, "accept");
  assert.notEqual(lordshipOf(poor).decline, null);
  // The bot pays when it can, haggles on half, and the naive variant refuses.
  assert.deepEqual(chapterDecisionAction(cleared, "relief", "accept"), { kind: "petition_response", petitionId: petition.id, response: "accept" });
  assert.deepEqual(chapterDecisionAction(cleared, "relief", "accept", "refuse"), { kind: "petition_response", petitionId: petition.id, response: "refuse" });
});

test("F5 (FL-7) a decline two years unbroken: the house withdraws, a new one carries on with half the treasury and a softer grudge", () => {
  const declined = atSeasonStart(derelict(city(), 8));
  const first = lordHouse(declined);
  assert.equal(first.order, 1);
  assert.equal(first.heraldrySeed, declined.seed, "the first house's arms are the game seed's");
  assert.ok((LORD_HOUSE_NAMES as readonly string[]).includes(first.name));
  const grudging = { ...declined, politics: { ...declined.politics!, merchantGauge: 10 } };
  const almost = atSeasonStart(grudging, declined.tick + LORDSHIP_BALANCE.houseChangeTicks - SEASON);
  assert.equal(lordHouse(almost).order, 1);
  const cash = treasuryBalance(almost);
  const changed = atSeasonStart(almost, declined.tick + LORDSHIP_BALANCE.houseChangeTicks);
  const house = lordHouse(changed);
  assert.equal(house.order, 2);
  assert.notEqual(house.name, first.name);
  assert.notEqual(house.heraldrySeed, first.heraldrySeed);
  assert.equal(treasuryBalance(changed), cash - Math.floor(cash / 2));
  assert.equal(changed.politics!.merchantGauge, 30, "halfway back to 50");
  const lordship = lordshipOf(changed);
  assert.deepEqual([lordship.decline, lordship.lostRights, lordship.titleDemoted], [null, [], false]);
  assert.deepEqual(lordship.pastHouses.map(past => [past.order, past.name, past.until]), [[1, first.name, changed.tick]]);
  assert.ok(changed.houses.length === 24 && changed.buildings.length === almost.buildings.length, "the town stays");
  const recorded = advanceHistory(almost, changed).history!.records.filter(record => record.template.startsWith("house."));
  assert.deepEqual(recorded.map(record => record.template), ["house.withdrew", "house.arrived"]);
  assert.match(historySummary(recorded[0]!), /가문이 물러났다$/);
});

/** A market town that came through the famine with its people (the FC-5 chapter end), for the campaign or the sandbox. */
function throughFamine(scenarioId?: string): GameState {
  const base = city();
  const arrival = base.tick - 3 * YEAR;
  const famine = { id: `${GREAT_FAMINE_EVENT_ID}@${arrival / SEASON}`, defId: GREAT_FAMINE_EVENT_ID, kind: "dearth" as const, season: arrival / SEASON,
    arrivalTick: arrival, endTick: base.tick - YEAR, recoveryUntilTick: base.tick - 100, losses: { burntHouses: 0, departures: 0, harvestLost: 0 },
    populationAtArrival: base.population, populationAtEnd: base.population };
  return { ...base, ...(scenarioId === undefined ? {} : { scenarioId }), events: { records: [famine], burning: [] } };
}

test("F6 (FL-8) chapter 1's end begins chapter 2 at the same tick, the same town; the sandbox has no chapters", () => {
  const town = throughFamine();
  const next = advancePolitics(town);
  assert.equal(next.politics!.chapterEnds.length, 1);
  assert.deepEqual(next.politics!.chapter, { number: CHAPTER_TWO.chapter, startTick: town.tick, populationStart: town.population, peakPopulation: town.population });
  assert.deepEqual([next.buildings, next.houses, next.treasuryCoin, next.persons], [town.buildings, town.houses, town.treasuryCoin, town.persons], "same town");
  assert.deepEqual(chapterGoals(next).map(goal => [goal.chapter, goal.id, goal.reachedTick]), [[1, "famine_market_town", town.tick], [2, "prosperity", null]]);
  const recorded = advanceHistory(town, next).history!.records.map(record => record.template);
  assert.ok(recorded.includes("milestone.chapter_end") && recorded.includes("milestone.chapter_start"));
  const sandbox = advancePolitics(throughFamine(SANDBOX_SCENARIO_ID));
  assert.equal(sandbox.politics!.chapter.number, 1, "the sandbox goes on without chapters");
});

test("F7 (FL-8, FL-10) chapter 1 → 2 saves and loads; a v18 save whose chapter 1 had ended opens in chapter 2", () => {
  const next = atSeasonStart(derelict(advancePolitics(throughFamine()), 8));
  assert.equal(next.politics!.chapter.number, 2);
  const loaded = decodeSave(encodeSave({ state: next, createdAt: "2026-09-27T00:00:00.000Z", savedAt: "2026-09-27T00:00:00.000Z" }).bytes);
  assert.equal(loaded.envelope.schemaVersion, SAVE_SCHEMA_VERSION);
  assert.ok(SAVE_SCHEMA_VERSION >= 19);
  assert.deepEqual(loaded.envelope.state, next);
  // A v18 town whose chapter 1 ended (chapter still 1, no lordship) opens in chapter 2 from that tick, the first house ruling.
  const ended = advancePolitics(throughFamine());
  const { lordship: _lordship, ...v18State } = { ...ended, politics: { ...ended.politics!, chapter: { ...ended.politics!.chapter, number: 1 } } };
  const v18 = JSON.parse(new TextDecoder().decode(encodeSave({ state: v18State as GameState, createdAt: "2026-09-27T00:00:00.000Z", savedAt: "2026-09-27T00:00:00.000Z" }).bytes));
  const rewound = { ...v18, schemaVersion: 18 };
  const migrated = decodeSave(new TextEncoder().encode(JSON.stringify(rewound)));
  const state = migrated.envelope.state as GameState;
  assert.equal(state.politics!.chapter.number, 2);
  assert.equal(state.politics!.chapter.startTick, ended.politics!.chapterEnds[0]!.tick);
  assert.equal(lordHouse(state).order, 1);
});

test("F8 (FL-9) prosperity is a chapter goal: its milestone stays, the campaign is not won before chapter 5", () => {
  const town = throughFamine();
  const prosperous = { ...town, settlement: { lastUpdatedTick: town.tick - 1, selfSufficientTicks: 600, prosperityTicks: 1_200, foodShortageTicks: 0, emptyTicks: 0,
    hadResidents: true, milestones: { selfSufficient: 1, palisade: 2, prosperity: town.tick - 5 }, outcome: "ongoing" as const } };
  const progressed = updateSettlementProgress(prosperous);
  assert.equal(progressed.settlement!.milestones.prosperity, town.tick - 5, "the milestone stays");
  assert.equal(progressed.settlement!.outcome, "ongoing", "the campaign goes on");
  const finale = { ...prosperous, politics: { ...initialPolitics(town), chapterEnds: [{ chapter: CAMPAIGN_CHAPTERS, tick: town.tick - 1, chronicle: {} as never }] } };
  assert.equal(updateSettlementProgress(finale).settlement!.outcome, "victory", "chapter 5's end is the campaign's victory");
  const sandbox = updateSettlementProgress({ ...prosperous, scenarioId: SANDBOX_SCENARIO_ID,
    settlement: { ...prosperous.settlement, milestones: { ...prosperous.settlement.milestones, prosperity: null } } });
  assert.deepEqual([sandbox.settlement!.milestones.prosperity, sandbox.settlement!.outcome], [null, "ongoing"], "the sandbox has no prosperity goal and no victory");
  assert.ok(MONEY_BALANCE.upkeep.mill > 0);
});
