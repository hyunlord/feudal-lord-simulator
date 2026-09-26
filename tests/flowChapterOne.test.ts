import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { CHAPTER_ONE, FAMINE_RESPONSE_CONFIG, MARKET_CHARTER_PETITION_ID, PETITION_DEFS } from "../src/content/chapterConfig";
import { EVENT_DEF_BY_ID, FAMINE_ERA_ID, GREAT_FAMINE_EFFECTS, GREAT_FAMINE_EVENT_ID } from "../src/content/eventConfig";
import { MONEY_BALANCE } from "../src/content/balanceConfig";
import type { GameState } from "../src/engine/engine.types";
import { dearthEndTick, departureCapPerSeason, eraPlannedSeason, eventForecast, famineShortHouses, foodPricePermille, harvestYieldPermille, weatherOfSeason } from "../src/engine/eventSchedule";
import { advanceEvents } from "../src/engine/events";
import { marketSalePrice } from "../src/engine/marketSettlement";
import { settleMoneyPeriod } from "../src/engine/moneyRules";
import {
  advancePolitics,
  chapterEnd,
  initialPolitics,
  famineRecord,
  famineResponse,
  famineStatus,
  openPetitions,
  petitionSeason,
  respondToPetition,
  rightsEffectRegistry,
  stallFeePermille,
} from "../src/engine/politics";
import { advanceHistoricalEras, historicalEra, historicalEraEffectRegistry } from "../src/engine/scenarioState";
import { advanceSeasons } from "../src/engine/seasonPressure";
import { advanceHistory } from "../src/engine/history";
import { advanceTick } from "../src/engine/tick";
import { LEDGER_PERIOD_TICKS, postLedgerEntries } from "../src/ledger/ledger";
import { decodeSave, encodeSave } from "../src/save/saveCodec";
import { SAVE_SCHEMA_VERSION } from "../src/save/saveTypes";
import { gameReducer } from "../src/state/gameStore";
import { migrateStateV13ToV14 } from "../src/save/migrations/v13ToV14";

// F0-C1 chapter 1 scenarios (spec docs/design/flow-chapter-one.md FC-1…FC-6), C1–C10.

const SEASON = 1000;
const YEAR = 4000;
const FAMINE = EVENT_DEF_BY_ID.get(GREAT_FAMINE_EVENT_ID)!;
const PETITION = PETITION_DEFS.find(def => def.id === MARKET_CHARTER_PETITION_ID)!;

/** The 176-person town (seed 1, a granary, a market, 15 houses) without its saved season, event and politics state. */
function town(): GameState {
  const state = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v13/population-176.save.json"))).envelope.state as GameState;
  const { seasons: _seasons, events: _events, politics: _politics, historicalEras: _eras, ...rest } = state;
  return rest;
}

/** A town that is ready for the famine (a granary, 12 lots and a market, set beside it), with money. */
function readyTown(): GameState {
  const state = town();
  assert.ok(state.buildings.filter(building => building.kind === "house").length >= 12, "the fixture has twelve lots");
  const market = { id: "market-test", kind: "market" as const, tx: 2, ty: 2, workers: 3, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
  // Money through the ledger (the treasury is its cash balance): a year's rent, as one posting.
  const posted = postLedgerEntries(state, [{ account: "cash", category: "rent", amount: 5_000, sourceRefs: [{ type: "building", id: state.houses[0]!.buildingId }] }]);
  return { ...state, treasuryCoin: posted.treasuryCoin, ledger: posted.ledger, buildings: [...state.buildings, market] };
}

/** The seed 1 24-lot city (operating markets) with the merchants' petition waiting. */
function petitionedCity(): GameState {
  const state = JSON.parse(readFileSync("fixtures/determinism/seed1/final-state.json", "utf8")) as GameState;
  const politics = initialPolitics(state);
  return { ...state, politics: { ...politics, petitions: [{ id: "market_charter@1", defId: PETITION.id, petitioner: "merchants", arrivedTick: state.tick }] } };
}

/** The pressure, events and politics steps on their 50-tick samples, the rest of the town standing still. */
function samples(state: GameState, from: number, to: number, edit: (state: GameState) => GameState = current => current): GameState {
  let current: GameState = { ...state, tick: from };
  for (let tick = from; tick <= to; tick += 50) current = step(edit({ ...current, tick }));
  return current;
}

/** The season, event, politics and history steps of one tick (the history ledger reads the before and after). */
function step(state: GameState): GameState {
  return advanceHistory(state, advancePolitics(advanceEvents(advanceSeasons(state))));
}

const SPRING_1315 = 15 * YEAR;

test("C1 the famine is rumoured in 1312, signed by the wet summers of 1313–14 with prices rising, and waits for readiness", () => {
  const state = readyTown();
  const planned = eraPlannedSeason(state, FAMINE)!;
  assert.equal(planned, 15 * 4 + 1, "summer 1315");
  const stage = (tick: number) => eventForecast({ ...state, tick }).find(entry => entry.defId === GREAT_FAMINE_EVENT_ID)?.stage ?? null;
  assert.equal(stage((planned - 13) * SEASON), null);
  assert.equal(stage((planned - 12) * SEASON), "rumour", "summer 1312");
  assert.equal(stage((planned - 8) * SEASON), "sign", "summer 1313");
  assert.equal(weatherOfSeason(state, planned - 8), "wet");
  assert.equal(weatherOfSeason(state, planned - 4), "wet");
  assert.equal(foodPricePermille(state, (planned - 8) * SEASON), FAMINE.signFoodPricePermille, "prices rise ahead of it");
  assert.equal(foodPricePermille(state, (planned - 9) * SEASON), 1000);
  // Not ready (no market): no famine in 1315; it stays signed and comes forced in 1320.
  const unready: GameState = { ...state, buildings: state.buildings.filter(building => building.kind !== "market") };
  const waiting = samples(unready, SPRING_1315, SPRING_1315 + 2 * YEAR);
  assert.equal(famineRecord(waiting), undefined);
  assert.equal(eventForecast(waiting).find(entry => entry.defId === GREAT_FAMINE_EVENT_ID)?.stage, "sign", "still signed while it waits");
  const forced = advancePolitics(advanceEvents(advanceSeasons({ ...waiting, tick: 20 * YEAR })));
  assert.equal(forced.historicalEras?.find(entry => entry.id === FAMINE_ERA_ID)?.forced, true);
  assert.equal(famineRecord(forced)?.arrivalTick, 20 * YEAR);
  // Ready: it arrives in spring 1315 with the era.
  const ready = advanceEvents(advanceSeasons({ ...state, tick: SPRING_1315 }));
  assert.equal(famineRecord(ready)?.arrivalTick, SPRING_1315);
  assert.equal(historicalEra(ready).id, FAMINE_ERA_ID);
});

test("C2 the famine takes two or three harvests at half and sells food at three times the price until the next good harvest", () => {
  const arrived = advanceEvents(advanceSeasons({ ...readyTown(), tick: SPRING_1315 }));
  const record = famineRecord(arrived)!;
  assert.equal(record.harvestFromYear, 15, "arriving before the harvest, 1315's harvest is the first");
  assert.ok(record.harvestYears === 2 || record.harvestYears === 3);
  for (let year = 15; year < 15 + record.harvestYears!; year += 1) {
    assert.equal(harvestYieldPermille(arrived, year * YEAR + 2_000), 500);
    assert.equal(weatherOfSeason(arrived, year * 4 + 1), "wet");
  }
  assert.notEqual(harvestYieldPermille(arrived, (15 + record.harvestYears!) * YEAR + 2_000), 500);
  const end = dearthEndTick(record);
  assert.equal(end, (15 + record.harvestYears!) * YEAR + 1_500);
  assert.equal(foodPricePermille(arrived, SPRING_1315 + 10), 3000);
  assert.equal(marketSalePrice({ ...arrived, tick: SPRING_1315 + 10 }, "bread"), 15);
  assert.equal(foodPricePermille(arrived, end), 1000);
  assert.deepEqual(historicalEraEffectRegistry(arrived).active(arrived.tick).map(effect => effect.spec), GREAT_FAMINE_EFFECTS, "the era's effects");
  const ended = samples(arrived, end, end + 50);
  assert.equal(famineRecord(ended)!.endTick, end);
  assert.equal(famineRecord(ended)!.populationAtEnd, ended.population);
});

test("C3 relief buys bread into the granary with the treasury, posted as famine relief, and lets one household leave a season", () => {
  const arrived = advanceEvents(advanceSeasons({ ...readyTown(), tick: SPRING_1315 }));
  assert.deepEqual(famineStatus(arrived)?.choices, ["relief", "price_control", "laissez_faire", "speculation"]);
  const answered = famineResponse(arrived, "relief");
  assert.equal(famineRecord(answered)!.response?.choice, "relief");
  assert.equal(famineResponse(answered, "speculation"), answered, "answered once");
  assert.deepEqual(famineStatus(answered)?.choices, []);
  const granaryBread = (state: GameState) => state.buildings.filter(building => building.kind === "granary").reduce((sum, building) => sum + (building.inventory.bread ?? 0), 0);
  // The last closed season earned 1,200 in cash: relief spends at most that (and half the treasury) a season.
  const earned = { season: 3 as const, year: 1314, startTick: SPRING_1315 - SEASON, endTick: SPRING_1315, income: 1_200, expense: 0,
    stockDelta: { bread: 0, wheat: 0, timber: 0, stone: 0 }, popDelta: 0, notableEvents: [], nextObjectiveHint: null };
  const hungry: GameState = { ...answered, seasons: { ...answered.seasons!, history: [earned] },
    buildings: answered.buildings.map(building => ({ ...building, inventory: { ...building.inventory, bread: 0, wheat: 0 } })) };
  const relieved = advancePolitics({ ...hungry, tick: SPRING_1315 + SEASON });
  const bought = granaryBread(relieved);
  assert.ok(bought > 0, "bread bought");
  assert.equal(hungry.treasuryCoin - relieved.treasuryCoin, bought * 15, "at the famine price");
  const posting = relieved.ledger!.entries.at(-1)!;
  assert.equal(posting.category, "famine_relief");
  assert.deepEqual(posting.sourceRefs[0], { type: "event", id: famineRecord(arrived)!.id, detail: "relief" });
  assert.equal(departureCapPerSeason({ ...relieved, tick: SPRING_1315 + SEASON }, 2), FAMINE_RESPONSE_CONFIG.reliefDepartureCap);
  assert.ok(hungry.treasuryCoin - relieved.treasuryCoin <= Math.min(1_200, hungry.treasuryCoin * FAMINE_RESPONSE_CONFIG.reliefTreasuryPermille / 1000),
    "at most the last season's income and half the treasury");
  const broke: GameState = { ...hungry, seasons: { ...hungry.seasons!, history: [{ ...earned, income: 0 }] } };
  assert.equal(advancePolitics({ ...broke, tick: SPRING_1315 + SEASON }).treasuryCoin, broke.treasuryCoin, "no income, no relief bought");
  // The price shock: standing by, the poorest quarter cannot buy bread at three times its price; relief feeds them.
  const idle = famineResponse(arrived, "laissez_faire");
  const poor = famineShortHouses({ ...idle, tick: SPRING_1315 + 50 });
  const lived = idle.houses.filter(house => house.residents > 0).length;
  assert.equal(poor.length, Math.floor(lived / 4));
  assert.deepEqual(famineShortHouses({ ...answered, tick: SPRING_1315 + 50 }), [], "relief feeds the poor");
  // A well-stocked town (its stores last years, every larder full): only the price keeps the poor from bread.
  const stocked = (current: GameState): GameState => ({ ...current, houses: current.houses.map(house => ({ ...house, breadStock: 6 })),
    buildings: current.buildings.map(building => building.kind === "granary" ? { ...building, inventory: { ...building.inventory, bread: 3_000 } } : building) });
  const poorStocked = famineShortHouses({ ...stocked(idle), tick: SPRING_1315 + 50 });
  const short = samples(stocked(idle), SPRING_1315 + 50, SPRING_1315 + SEASON + 50, stocked);
  assert.ok(poorStocked.every(id => short.houses.find(house => house.buildingId === id)!.leavingSinceTick !== undefined), "a season short: preparing to leave");
  assert.equal(short.houses.filter(house => house.leavingSinceTick !== undefined).length, poorStocked.length, "only the poor");
  const fed = samples(stocked(answered), SPRING_1315 + 50, SPRING_1315 + SEASON + 50, stocked);
  assert.ok(poorStocked.every(id => fed.houses.find(house => house.buildingId === id)!.leavingSinceTick === undefined));
});

test("C4 price control caps food at × 1.5 (the poor can buy again) and costs the merchants' goodwill each season", () => {
  const arrived = advancePolitics(advanceEvents(advanceSeasons({ ...readyTown(), tick: SPRING_1315 })));
  const controlled = famineResponse(arrived, "price_control");
  assert.equal(foodPricePermille(controlled, SPRING_1315 + 10), FAMINE_RESPONSE_CONFIG.priceCapPermille);
  assert.equal(marketSalePrice({ ...controlled, tick: SPRING_1315 + 10 }, "wheat"), 3);
  const gauge = controlled.politics!.merchantGauge;
  const later = advancePolitics({ ...controlled, tick: SPRING_1315 + SEASON });
  assert.equal(later.politics!.merchantGauge, gauge + FAMINE_RESPONSE_CONFIG.priceControlMerchantPerSeason);
  assert.equal(departureCapPerSeason({ ...later, tick: SPRING_1315 + SEASON }, 2), 2);
  assert.deepEqual(famineShortHouses({ ...controlled, tick: SPRING_1315 + 50 }), []);
});

test("C5 standing by changes nothing; C6 speculation sells a quarter of the granaries into the treasury and lets three leave", () => {
  const arrived = advancePolitics(advanceEvents(advanceSeasons({ ...readyTown(), tick: SPRING_1315 })));
  const idle = famineResponse(arrived, "laissez_faire");
  const idleLater = advancePolitics({ ...idle, tick: SPRING_1315 + SEASON });
  assert.equal(idleLater.treasuryCoin, idle.treasuryCoin);
  assert.deepEqual(idleLater.buildings, idle.buildings);
  assert.equal(departureCapPerSeason({ ...idleLater, tick: SPRING_1315 + SEASON }, 2), 2);

  const granary = arrived.buildings.find(building => building.kind === "granary")!;
  const stocked: GameState = { ...arrived, buildings: arrived.buildings.map(building => building === granary ? { ...building, inventory: { ...building.inventory, bread: 400, wheat: 200 } } : building) };
  const speculating = famineResponse(stocked, "speculation");
  const sold = advancePolitics({ ...speculating, tick: SPRING_1315 + SEASON });
  const after = sold.buildings.find(building => building.id === granary.id)!;
  assert.equal(after.inventory.bread, 300);
  assert.equal(after.inventory.wheat, 150);
  assert.equal(sold.treasuryCoin - speculating.treasuryCoin, 100 * 15 + 50 * 6, "at the famine prices");
  assert.equal(sold.ledger!.entries.at(-1)!.category, "famine_sale");
  assert.equal(departureCapPerSeason({ ...sold, tick: SPRING_1315 + SEASON }, 2), FAMINE_RESPONSE_CONFIG.speculationDepartureCap);
});

test("C7 the merchants' charter petition comes in 1305–1308 to a village of six lots, and expires unanswered after 1308", () => {
  const state = readyTown();
  const season = petitionSeason(state, PETITION);
  assert.ok(season >= (1305 - 1300) * 4 && season < (1308 - 1300) * 4, `season ${season}`);
  const before = samples(state, season * SEASON - 100, season * SEASON - 50);
  assert.deepEqual(openPetitions(before), []);
  const arrived = samples(before, season * SEASON, season * SEASON);
  assert.equal(openPetitions(arrived).length, 1);
  assert.equal(openPetitions(arrived)[0]!.petitioner, "merchants");
  const houses = state.houses.slice(0, 5);
  const hamlet: GameState = { ...state, houses, buildings: state.buildings.filter(building => building.kind !== "house" || houses.some(house => house.buildingId === building.id)) };
  assert.deepEqual(openPetitions(samples(hamlet, season * SEASON, season * SEASON + 100)), [], "five lots: no merchants yet");
  const expired = samples(arrived, 9 * YEAR, 9 * YEAR);
  assert.deepEqual(openPetitions(expired), []);
  assert.equal(expired.politics!.petitions[0]!.response, "expired");
  assert.equal(expired.politics!.merchantGauge, arrived.politics!.merchantGauge + PETITION.expiredGauge);
});

test("C8 the answer: accept grants the charter (dues × 0.75), with a price takes 150 into the treasury, refuse angers the merchants", () => {
  const arrived = petitionedCity();
  const id = openPetitions(arrived)[0]!.id;
  const gauge = arrived.politics!.merchantGauge;

  const accepted = respondToPetition(arrived, id, "accept");
  assert.deepEqual(accepted.politics!.rights.map(right => [right.id, right.holder, right.stallFeePermille]), [["market_charter", "merchants", 750]]);
  assert.equal(accepted.politics!.merchantGauge, gauge + 15);
  assert.equal(stallFeePermille(accepted), 750);
  assert.equal(rightsEffectRegistry(accepted).active(accepted.tick)[0]!.source.type, "right");
  const period = (current: GameState) => settleMoneyPeriod({ ...current, tick: Math.ceil((current.tick + 1) / LEDGER_PERIOD_TICKS) * LEDGER_PERIOD_TICKS });
  const fees = (current: GameState) => (current.ledger?.entries ?? []).filter(entry => entry.category === "stall_fee" && entry.tick === current.tick);
  const acceptedFees = fees(period(accepted));
  const usualFees = fees(period(arrived));
  assert.ok(usualFees.length > 0, "the city's markets set out stalls");
  assert.deepEqual(acceptedFees.map(entry => entry.amount), usualFees.map(entry => Math.round(entry.amount * 0.75)));
  assert.ok(acceptedFees.every(entry => entry.sourceRefs.some(ref => ref.type === "right" && ref.id === "market_charter")));

  const priced = respondToPetition(arrived, id, "accept_with_price");
  assert.equal(priced.treasuryCoin - arrived.treasuryCoin, 150);
  assert.equal(priced.ledger!.entries.at(-1)!.category, "charter_fee");
  assert.equal(stallFeePermille(priced), 1000);
  assert.equal(priced.politics!.rights.length, 1);
  assert.equal(priced.politics!.merchantGauge, gauge + 5);

  const refused = respondToPetition(arrived, id, "refuse");
  assert.deepEqual(refused.politics!.rights, []);
  assert.equal(refused.politics!.merchantGauge, gauge - 20);
  assert.equal(respondToPetition(refused, id, "accept"), refused, "answered once");
  assert.ok(MONEY_BALANCE.stallFeePerStall > 0);
});

/** A market town through the famine: arrives in 1315, answered, runs to its end with the town standing still. */
function throughFamine(edit: (state: GameState) => GameState = current => current): GameState {
  const base = readyTown();
  const season = petitionSeason(base, PETITION);
  const petitioned = samples({ ...base, era: "palisade", eraProclaimedTick: 9 * YEAR }, season * SEASON, season * SEASON);
  // The answers go through the game's commands, as a player's would (F0-C2: the history ledger records them).
  const answered = gameReducer(petitioned, { type: "petition_response", petitionId: openPetitions(petitioned)[0]!.id, response: "accept" });
  const arrived = step({ ...answered, tick: SPRING_1315 });
  const relieved = gameReducer(arrived, { type: "famine_response", choice: "relief" });
  return samples(relieved, SPRING_1315 + 50, dearthEndTick(famineRecord(relieved)!) + 100, edit);
}

test("C9 the chronicle page is written at the chapter's end: its events, three decisions quoted, the statistics", () => {
  const ended = throughFamine();
  const end = chapterEnd(ended)!;
  assert.ok(end !== null);
  const page = end.chronicle;
  assert.equal(page.chapter, 1);
  // F0-C2 (HL-6): quoted from the history ledger's big decisions, weightiest first (the market town here was set, not proclaimed).
  assert.deepEqual(page.decisions.map(decision => decision.kind), ["famine_response", "petition_response"], "the weightiest first");
  assert.ok(page.decisions.length <= CHAPTER_ONE.quotedDecisions);
  assert.deepEqual(page.decisions[0]!.alternatives, ["price_control", "laissez_faire", "speculation"]);
  assert.ok(page.decisions[0]!.actual !== undefined, "two seasons on, the famine answer has its actual");
  assert.ok(page.events.some(event => event.defId === GREAT_FAMINE_EVENT_ID && event.year === 1315));
  assert.equal(page.stats.famine?.year, 1315);
  assert.equal(page.stats.populationEnd, ended.population);
  assert.ok(page.stats.peakPopulation >= page.stats.populationEnd);
});

test("C10 the chapter ends with a market town that kept 60 % of its people; not below; and round-trips through the save (v14+)", () => {
  const ended = throughFamine();
  const end = chapterEnd(ended)!;
  const famine = famineRecord(ended)!;
  assert.ok(famine.populationAtEnd! * 1000 >= famine.populationAtArrival! * 600);
  assert.equal(end.tick, dearthEndTick(famine) + (50 - dearthEndTick(famine) % 50) % 50);
  // Below 60 % at the famine's end: not survived, no chapter end. A village (no proclamation) has no chapter end either.
  const next = (current: GameState) => advancePolitics({ ...current, tick: current.tick + 50 });
  const lost: GameState = { ...ended, politics: { ...ended.politics!, chapterEnds: [] }, events: { ...ended.events!, records: ended.events!.records.map(record =>
    record.defId === GREAT_FAMINE_EVENT_ID ? { ...record, populationAtEnd: Math.floor(record.populationAtArrival! * 0.59) } : record) } };
  assert.equal(chapterEnd(next(lost)), null, "below 60 %");
  assert.equal(chapterEnd(next({ ...ended, era: "hamlet", politics: { ...ended.politics!, chapterEnds: [] } })), null, "not a market town");
  assert.notEqual(chapterEnd(next({ ...ended, politics: { ...ended.politics!, chapterEnds: [] } })), null);

  const loaded = decodeSave(encodeSave({ state: ended, createdAt: "2026-09-26T00:00:00.000Z", savedAt: "2026-09-26T00:00:00.000Z" }).bytes);
  assert.equal(loaded.envelope.schemaVersion, SAVE_SCHEMA_VERSION);
  assert.ok(SAVE_SCHEMA_VERSION >= 14);
  assert.deepEqual(loaded.envelope.state, ended);
  let a: GameState = ended;
  let b: GameState = loaded.envelope.state as GameState;
  for (let step = 0; step < 300; step += 1) { a = advanceTick(a); b = advanceTick(b); }
  const { pathCache: _a, ...restA } = a;
  const { pathCache: _b, ...restB } = b;
  assert.deepEqual(restB, restA);

  const promoted = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v13/population-176.save.json")));
  assert.equal(promoted.migratedFrom, 13);
  // A v13 town already in the famine era had no Great Famine: it is missed, not started late.
  const late = advanceHistoricalEras({ ...(promoted.envelope.state as GameState), tick: 21 * YEAR });
  assert.ok(late.historicalEras?.some(entry => entry.id === FAMINE_ERA_ID));
  const migrated = migrateStateV13ToV14(late);
  assert.deepEqual(migrated.events!.missed, [`${GREAT_FAMINE_EVENT_ID}@61`]);
  assert.equal(famineRecord(advanceEvents({ ...migrated, tick: migrated.tick + 50 })), undefined);
});
