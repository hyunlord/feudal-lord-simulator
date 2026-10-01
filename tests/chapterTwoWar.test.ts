/**
 * F2-A chapter 2's war (spec docs/design/chapter-two-war.md WR-1…WR-10): scenarios E11–E20 (the flow events' E1–E10
 * continue here); E21 the wool in kind (FIX-7, from the stores since C5).
 */
import { moneyWords } from "../src/ledger/moneyWords.ko";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PRESSURE_BALANCE } from "../src/content/balanceConfig";
import { CHAPTER_TWO } from "../src/content/chapterConfig";
import { SANDBOX_SCENARIO_ID } from "../src/content/scenario/coreScenarios";
import {
  LEVY_RESPONSE_PETITION_ID, REFUGEE_ADMISSION_PETITION_ID, WALL_OR_MARKET_PETITION_ID, WAR_BALANCE, WAR_FUNDING_PETITION_ID, WOOL_PAYMENT_PETITION_ID,
} from "../src/content/warConfig";
import { chapterDecisionAction } from "../src/engine/autoplayEvents";
import type { GameState } from "../src/engine/engine.types";
import { advanceHistory, historySummary } from "../src/engine/history";
import { settleMoneyPeriod } from "../src/engine/moneyRules";
import { labourPool } from "../src/engine/persons";
import { chapterEnd, chapterGoals, endChapterTwo, initialPolitics, openPetitions, respondToPetition } from "../src/engine/politics";
import { hashSeed } from "../src/engine/prng";
import {
  advanceWar, beaconLit, levyMen, raidLosses, raidSeasonOffset, recoverySeasonOffset, refugeeRoom, ringDefencePermille, subsidyAmount,
  warDecisionForecast, warForecast, woolInKindPerSeason, woolLevyAmount,
} from "../src/engine/war";
import { townFleece, woolInKindSplit } from "../src/engine/pastureWool";
import { CLOTH_BALANCE, FLEECE_RESOURCE } from "../src/content/clothConfig";
import type { PetitionResponse } from "../src/content/chapterConfig";
import { LEDGER_PERIOD_TICKS, postLedgerEntries, treasuryBalance } from "../src/ledger/ledger";
import { decodeSave, encodeSave } from "../src/save/saveCodec";
import { SAVE_SCHEMA_VERSION } from "../src/save/saveTypes";

const SEASON = PRESSURE_BALANCE.seasonTicks;
/** Spring 1337: the War era enters. */
const M = 148_000;

/** The 24-house walled town (v19 fixture) in chapter 2 at spring 1337, its ring closed (timber), 5,000d in hand. */
function warTown(treasury = 5000): GameState {
  const state = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v19/palisade-construction.save.json"))).envelope.state as GameState;
  const palisade = state.palisade === null ? null : { ...state.palisade, segments: state.palisade.segments.map(segment => ({ ...segment, completed: true, material: "timber" as const })) };
  const funded = postLedgerEntries({ ...state, tick: M }, [{ account: "cash", category: "opening_balance", amount: treasury - treasuryBalance(state),
    sourceRefs: [{ type: "scenario", id: "chapter-two-war-test" }] }]);
  const politics = initialPolitics(state);
  return { ...state, tick: M, palisade, treasuryCoin: funded.treasuryCoin, ledger: funded.ledger,
    historicalEras: [...(state.historicalEras ?? []), { id: "war", enteredTick: M, forced: false }],
    politics: { ...politics, chapter: { number: CHAPTER_TWO.chapter, startTick: 80_000, populationStart: state.population, peakPopulation: state.population } } };
}
/** One season start at `offset` seasons from the messenger's. */
const season = (state: GameState, offset: number) => advanceWar({ ...state, tick: M + offset * SEASON }, endChapterTwo);
/** Every season start from `from` to `to` (inclusive), answering each war petition as it comes with `answer`. */
function run(state: GameState, from: number, to: number, answer?: (defId: string) => PetitionResponse): GameState {
  let next = state;
  for (let offset = from; offset <= to; offset += 1) {
    next = season(next, offset);
    for (const petition of openPetitions(next)) {
      const response = answer?.(petition.defId);
      if (response !== undefined) next = respondToPetition(next, petition.id, response);
    }
  }
  return next;
}
const open = (state: GameState, defId: string) => openPetitions(state).find(petition => petition.defId === defId);
const cashOf = (state: GameState, category: string) => (state.ledger?.entries ?? []).filter(entry => entry.account === "cash" && entry.category === category)
  .reduce((sum, entry) => sum + entry.amount, 0);

test("E11 (WR-1) the War era's messenger opens the sequence at its season; the forecast lists the steps; nothing before 1337", () => {
  const town = warTown();
  const before = advanceWar({ ...town, tick: M - SEASON, historicalEras: town.historicalEras!.filter(entry => entry.id !== "war") }, endChapterTwo);
  assert.equal(before.war, undefined);
  const met = season(town, 0);
  assert.deepEqual(met.war, { messengerTick: M, favour: true, answers: {}, instalments: [] });
  // A town first seen in the War era after 1340 (an old save) has missed the war.
  assert.equal(advanceWar({ ...town, tick: 164_000 }, endChapterTwo).war, undefined);
  const raid = raidSeasonOffset(met);
  assert.ok(WAR_BALANCE.raidSeasons.includes(raid));
  assert.deepEqual(warForecast(met).map(step => [step.id, step.tick, step.state]), [
    ["messenger", M, "now"], ["wool_levy", M + SEASON, "ahead"], ["commission", M + 4 * SEASON, "ahead"], ["subsidy", M + 6 * SEASON, "ahead"],
    ["beacon", M + (raid - 1) * SEASON, "ahead"], ["raid", M + raid * SEASON, "ahead"], ["refugees", M + (raid + 1) * SEASON, "ahead"],
    ["recovery", M + (raid + 2) * SEASON, "ahead"]]);
  const record = advanceHistory(town, met).history!.records.find(entry => entry.template === "war.messenger")!;
  assert.equal(historySummary(record), "국왕의 전령이 왔다 — 프랑스와 전쟁이 시작되었다");
});

test("E12 (WR-2) the wool levy: in kind 125 % over four seasons, in cash 100 % now, refused 150 % seized and the Crown's favour lost", () => {
  const met = season(warTown(), 0);
  const edict = season(met, 1);
  const petition = open(edict, WOOL_PAYMENT_PETITION_ID)!;
  assert.equal(petition.petitioner, "crown");
  const levy = woolLevyAmount(edict);
  assert.equal(levy, 24 * WAR_BALANCE.woolLevyPerHouse);
  const cash = respondToPetition(edict, petition.id, "accept_with_price");
  assert.equal(treasuryBalance(cash), 5000 - levy);
  const refused = respondToPetition(edict, petition.id, "refuse");
  assert.equal(treasuryBalance(refused), 5000 - Math.ceil(levy * 1.5));
  assert.equal(refused.war!.favour, false);
  const inKind = respondToPetition(edict, petition.id, "accept");
  assert.equal(treasuryBalance(inKind), 5000);
  const paid = run(inKind, 2, 6);
  assert.equal(-cashOf(paid, "wool_levy"), 4 * Math.ceil(Math.ceil(levy * 1.25) / 4));
  assert.deepEqual(paid.war!.instalments, []);
  // A treasury short of the levy owes the rest; the period close pays it back under the levy's own line.
  const poor = season(season(warTown(40), 0), 1);
  const owed = respondToPetition(poor, open(poor, WOOL_PAYMENT_PETITION_ID)!.id, "accept_with_price");
  assert.equal(treasuryBalance(owed), 0);
  assert.deepEqual(owed.money!.arrears.at(-1), { tick: M + SEASON, amount: levy - 40, facility: { type: "actor", id: "crown" }, category: "wool_levy" });
  const refilled = postLedgerEntries(owed, [{ account: "cash", category: "opening_balance", amount: 500, sourceRefs: [{ type: "scenario", id: "t" }] }]);
  const periodTick = Math.ceil((owed.tick + 1) / LEDGER_PERIOD_TICKS) * LEDGER_PERIOD_TICKS;
  const settled = settleMoneyPeriod({ ...owed, ...refilled, tick: periodTick });
  assert.equal(settled.money!.arrears.some(arrear => arrear.category === "wool_levy"), false);
  assert.ok(settled.ledger!.entries.some(entry => entry.tick === periodTick && entry.account === "arrears" && entry.category === "wool_levy" && entry.amount === -(levy - 40)));
});

test("E13 (WR-3) the commission of array: the men leave the work for two seasons, one in five does not come back; the exemption; a refusal", () => {
  const town = run(warTown(), 0, 4, defId => defId === WOOL_PAYMENT_PETITION_ID ? "accept_with_price" : undefined as never);
  const petition = open(town, LEVY_RESPONSE_PETITION_ID)!;
  const men = levyMen(town);
  const adults = town.houses.reduce((sum, house) => sum + (house.members?.adults ?? Math.ceil(house.residents / 2)), 0);
  assert.equal(men, Math.max(WAR_BALANCE.minMen, Math.ceil(adults / WAR_BALANCE.adultsPerMan)));
  assert.ok(men > 10, `${men} men from ${adults} adults`);
  const pool = labourPool(town);
  const sent = respondToPetition(town, petition.id, "accept");
  assert.equal(labourPool(sent), pool - men);
  assert.equal(sent.war!.conscripts!.returnTick, M + 6 * SEASON);
  const away = run(sent, 5, 5);
  assert.equal(labourPool(away), pool - men);
  const home = run(away, 6, 6);
  const lost = Math.floor(men / WAR_BALANCE.lostEvery);
  assert.equal(home.war!.conscripts!.returned, true);
  assert.equal(home.population, town.population - lost);
  const { war: _war, ...withoutWar } = home;
  assert.equal(labourPool(home), labourPool(withoutWar));
  const recorded = advanceHistory(away, home).history!.records.find(entry => entry.template === "war.conscripts_returned")!;
  assert.equal(historySummary(recorded), lost === 0 ? `징집된 남자 ${men}명이 모두 돌아왔다` : `징집된 남자들이 돌아왔다 — ${lost}명은 돌아오지 못했다`);
  const exempt = respondToPetition(town, petition.id, "accept_with_price");
  assert.equal(treasuryBalance(exempt), treasuryBalance(town) - men * WAR_BALANCE.exemptionPerMan);
  assert.equal(labourPool(exempt), pool);
  const refused = respondToPetition(town, petition.id, "refuse");
  assert.deepEqual([treasuryBalance(refused), labourPool(refused), refused.war!.favour], [treasuryBalance(town), pool, false]);
});

test("E14 (WR-4) the lay subsidy: the merchants' loan repaid with interest over eight seasons; the war tax on rent and the households it drives away", () => {
  const town = run(warTown(), 0, 6, defId => defId === WOOL_PAYMENT_PETITION_ID || defId === LEVY_RESPONSE_PETITION_ID ? "accept_with_price" : undefined as never);
  const petition = open(town, WAR_FUNDING_PETITION_ID)!;
  const subsidy = subsidyAmount(town);
  assert.equal(subsidy, Math.max(24 * WAR_BALANCE.subsidyPerHouse, Math.floor(treasuryBalance(town) / 10)));
  const gauge = town.politics!.merchantGauge;
  const loan = respondToPetition(town, petition.id, "accept");
  assert.equal(treasuryBalance(loan), treasuryBalance(town));
  assert.deepEqual([cashOf(loan, "war_loan"), cashOf(loan, "war_subsidy")], [subsidy, -subsidy]);
  assert.equal(loan.politics!.merchantGauge, gauge + WAR_BALANCE.loanGauge);
  const repaid = run(loan, 7, 14);
  assert.equal(cashOf(repaid, "war_loan"), subsidy - 8 * Math.ceil(Math.ceil(subsidy * 1.2) / 8));
  const taxed = respondToPetition(town, petition.id, "accept_with_price");
  assert.equal(treasuryBalance(taxed), treasuryBalance(town) - subsidy);
  assert.equal(taxed.war!.taxSeasonsLeft, WAR_BALANCE.taxSeasons);
  // The period close adds half the rent while the tax lasts.
  const periodTick = Math.ceil((taxed.tick + 1) / LEDGER_PERIOD_TICKS) * LEDGER_PERIOD_TICKS;
  const settled = settleMoneyPeriod({ ...taxed, tick: periodTick });
  const rent = settled.ledger!.entries.filter(entry => entry.tick === periodTick && entry.category === "rent").reduce((sum, entry) => sum + entry.amount, 0);
  assert.equal(settled.ledger!.entries.find(entry => entry.tick === periodTick && entry.category === "war_tax")?.amount, Math.round(rent * 0.5));
  // Each taxed season a household leaves when the seed's roll falls under a third.
  const expected = [7, 8, 9, 10].filter(offset => hashSeed(town.seed, "war:tax-flight", M + offset * SEASON) % 1000 < WAR_BALANCE.taxFlightPermille).length;
  const after = run(taxed, 7, 11);
  assert.equal(after.houses.filter(house => house.abandonedTick !== undefined).length - taxed.houses.filter(house => house.abandonedTick !== undefined).length, expected);
  assert.equal(after.war!.taxSeasonsLeft, 0);
});

test("E15 (WR-5) the beacon a season ahead, then the raid: a stone ring loses less than a timber one, a timber one less than none", () => {
  const town = season(warTown(), 0);
  const raid = raidSeasonOffset(town);
  assert.equal(beaconLit(season(town, raid - 2)), false);
  assert.equal(beaconLit(season(town, raid - 1)), true);
  const stone = { ...town, palisade: { ...town.palisade!, segments: town.palisade!.segments.map(segment => ({ ...segment, material: "stone" as const, replacementConstructionSiteId: null })) } };
  const noRing = { ...town, palisade: null };
  assert.deepEqual([ringDefencePermille(stone), ringDefencePermille(town), ringDefencePermille(noRing)], [1000, 600, 0]);
  const [s, t, n] = [raidLosses(stone), raidLosses(town), raidLosses(noRing)];
  assert.ok(s.burntHouses < t.burntHouses && t.burntHouses < n.burntHouses, `${s.burntHouses} < ${t.burntHouses} < ${n.burntHouses}`);
  assert.ok(s.looted < t.looted && t.looted < n.looted);
  assert.ok(s.coin <= t.coin && t.coin < n.coin);
  assert.equal(n.burntHouses, WAR_BALANCE.raidHouses);
  // The raid itself: houses burnt by the raid's event, the stores and the treasury lighter, the ledger's line.
  const struck = season({ ...town, tick: M + (raid - 1) * SEASON }, raid);
  assert.deepEqual(struck.war!.raid!.losses, { burntHouses: t.burntHouses, looted: t.looted, coin: t.coin });
  const burnt = struck.houses.filter(house => house.burntByEventId === `coastal_raid@${(M / SEASON) + raid}`);
  assert.equal(burnt.length, t.burntHouses);
  assert.equal(treasuryBalance(struck), treasuryBalance(town) - t.coin);
  const record = advanceHistory(town, struck).history!.records.find(entry => entry.template === "war.raid")!;
  assert.equal(historySummary(record), `해안 습격이 닥쳤다 — 불탄 집 ${t.burntHouses}, 빼앗긴 물자 ${t.looted}, 빼앗긴 돈 ${moneyWords(t.coin)}`);
});

test("E16 (WR-6) the refugees: all settle in the empty homes and the room, half pay their fee, or they are turned away", () => {
  const town = season(warTown(), 0);
  const raid = raidSeasonOffset(town);
  const emptied = { ...town, houses: town.houses.map((house, index) => index < 3 ? { ...house, residents: 0, abandonedTick: M } : house) };
  const asked = season(season({ ...emptied, tick: M + (raid - 1) * SEASON }, raid), raid + 1);
  const petition = open(asked, REFUGEE_ADMISSION_PETITION_ID)!;
  assert.equal(petition.petitioner, "refugees");
  const all = WAR_BALANCE.refugeeHouseholds * WAR_BALANCE.refugeesPerHousehold;
  assert.ok(refugeeRoom(asked) >= all);
  const admitted = respondToPetition(asked, petition.id, "accept");
  assert.equal(admitted.population, asked.population + all);
  assert.equal(admitted.houses.filter(house => house.abandonedTick !== undefined).length, asked.houses.filter(house => house.abandonedTick !== undefined).length - 3);
  const half = respondToPetition(asked, petition.id, "accept_with_price");
  assert.equal(half.population, asked.population + all / 2);
  assert.equal(treasuryBalance(half), treasuryBalance(asked) + 2 * WAR_BALANCE.refugeeFeePerHousehold);
  assert.equal(respondToPetition(asked, petition.id, "refuse").population, asked.population);
});

test("E17 (WR-7) the recovery: with the Crown's favour the purveyance licence sells a tenth of the granaries' wheat a season; the wall-or-market choice comes either way", () => {
  const town = season(warTown(), 0);
  const recovery = recoverySeasonOffset(town);
  const at = (state: GameState) => season({ ...state, tick: M + (recovery - 1) * SEASON }, recovery);
  const favoured = at(town);
  assert.equal(favoured.war!.licenceSeasonsLeft, WAR_BALANCE.licenceSeasons);
  assert.equal(open(favoured, WALL_OR_MARKET_PETITION_ID)!.petitioner, "townsfolk");
  const wheat = favoured.buildings.filter(building => building.kind === "granary").reduce((sum, building) => sum + (building.inventory.wheat ?? 0), 0);
  const sold = season(favoured, recovery + 1);
  assert.ok(cashOf(sold, "purveyance") > 0);
  assert.equal(sold.buildings.filter(building => building.kind === "granary").reduce((sum, building) => sum + (building.inventory.wheat ?? 0), 0),
    wheat - favoured.buildings.filter(building => building.kind === "granary").reduce((sum, building) => sum + Math.floor((building.inventory.wheat ?? 0) / 10), 0));
  const disfavoured = at({ ...town, war: { ...town.war!, favour: false } });
  assert.equal(disfavoured.war!.licenceSeasonsLeft, undefined);
  const choice = open(disfavoured, WALL_OR_MARKET_PETITION_ID)!;
  // Without the Crown's favour there is no murage: the townsfolk's wall is built from the treasury.
  assert.equal(respondToPetition(disfavoured, choice.id, "accept_with_price").war!.wall, "stone_wall");
  assert.equal(respondToPetition(favoured, open(favoured, WALL_OR_MARKET_PETITION_ID)!.id, "accept_with_price").war!.wall, "murage");
});

test("E18 (WR-8) murage doubles the tolls while the stone wall is building; the market chosen doubles the dues", () => {
  const town = season(warTown(), 0);
  const periodTick = Math.ceil((town.tick + 1) / LEDGER_PERIOD_TICKS) * LEDGER_PERIOD_TICKS;
  const gate = Object.keys(town.money?.crossings ?? {})[0] ?? "gate:0,0";
  const crossing = { ...town, money: { crossings: { [gate]: 10 }, millWheat: {}, arrears: [], ...(town.money === undefined ? {} : { millWheat: town.money.millWheat }) } };
  const plain = settleMoneyPeriod({ ...crossing, tick: periodTick });
  const murage = settleMoneyPeriod({ ...crossing, tick: periodTick, war: { ...town.war!, wall: "murage" } });
  const toll = (state: GameState, category: string) => state.ledger!.entries.filter(entry => entry.tick === periodTick && entry.category === category).reduce((sum, entry) => sum + entry.amount, 0);
  assert.equal(toll(murage, "murage"), toll(plain, "toll"));
  assert.equal(toll(plain, "murage"), 0);
  const market = settleMoneyPeriod({ ...crossing, tick: periodTick, war: { ...town.war!, wall: "market" } });
  assert.ok(toll(market, "stall_fee") >= toll(plain, "stall_fee"));
  assert.equal(toll(market, "stall_fee"), Math.round(toll(plain, "stall_fee") * WAR_BALANCE.marketExpansionPermille / 1000));
});

test("E19 (WR-9) chapter 2 ends once the war has passed and the market is chosen or the stone wall stands, by 1348 at the latest; chapter 3 begins", () => {
  const town = season(warTown(), 0);
  const recovery = recoverySeasonOffset(town);
  const asked = season({ ...town, tick: M + (recovery - 1) * SEASON }, recovery);
  const market = respondToPetition(asked, open(asked, WALL_OR_MARKET_PETITION_ID)!.id, "refuse");
  const ended = season(market, recovery + 1);
  const end = chapterEnd(ended, CHAPTER_TWO.chapter)!;
  assert.equal(end.tick, M + (recovery + 1) * SEASON);
  assert.equal(end.chronicle.stats.war!.wall, "market");
  assert.equal(ended.politics!.chapter.number, 3);
  // F3-A: chapter 3's goal (the resettlement) follows chapter 2's, not yet reached.
  assert.deepEqual(chapterGoals(ended).map(goal => [goal.chapter, goal.id, goal.reachedTick]).slice(-2), [[2, "wall_or_market", end.tick], [3, "resettled", null]]);
  const history = advanceHistory(market, ended).history!.records.map(record => record.template);
  assert.ok(history.includes("milestone.chapter_end") && history.includes("milestone.chapter_start"));
  // The stone wall chosen: the chapter waits for it — and ends in 1348 whatever its state.
  const wall = respondToPetition(asked, open(asked, WALL_OR_MARKET_PETITION_ID)!.id, "accept_with_price");
  assert.equal(chapterEnd(season(wall, recovery + 1), CHAPTER_TWO.chapter), null);
  const built = { ...wall, palisade: { ...wall.palisade!, segments: wall.palisade!.segments.map(segment => ({ ...segment, material: "stone" as const, replacementConstructionSiteId: null })) } };
  assert.equal(chapterEnd(season(built, recovery + 1), CHAPTER_TWO.chapter)!.chronicle.stats.war!.wall, "stone_wall");
  const late = season({ ...wall, tick: 191_000 }, (192_000 - M) / SEASON);
  assert.equal(chapterEnd(late, CHAPTER_TWO.chapter)!.chronicle.stats.war!.wall, "unfinished");
  // The sandbox has the war but no chapters.
  const sandbox = season({ ...market, scenarioId: SANDBOX_SCENARIO_ID }, recovery + 1);
  assert.equal(chapterEnd(sandbox, CHAPTER_TWO.chapter), null);
});

test("E20 (WR-10) the bot's answers, an unanswered demand refused, the save round trip (v20) and the same sequence twice", () => {
  const town = season(warTown(), 0);
  const edict = season(town, 1);
  const bot = chapterDecisionAction(edict, "relief", "accept")!;
  assert.deepEqual(bot, { kind: "petition_response", petitionId: open(edict, WOOL_PAYMENT_PETITION_ID)!.id, response: "accept_with_price" });
  const poor = season(season(warTown(10), 0), 1);
  assert.equal((chapterDecisionAction(poor, "relief", "accept") as { response: string }).response, "accept");
  // The wall only when its project can begin now (this town has no masonry): else the market.
  const recovery = recoverySeasonOffset(town);
  const choice = season({ ...town, tick: M + (recovery - 1) * SEASON }, recovery);
  assert.equal((chapterDecisionAction(choice, "relief", "accept") as { response: string }).response, "refuse");
  assert.equal((chapterDecisionAction(choice, "relief", "accept", "pay", "wall") as { response: string }).response, "accept_with_price");
  // Left a season unanswered, the Crown takes the refusal: seized wool, the favour lost, the ledger's line.
  const ignored = season(edict, 2);
  assert.deepEqual([ignored.war!.answers[WOOL_PAYMENT_PETITION_ID], ignored.war!.favour], ["expired", false]);
  assert.equal(treasuryBalance(ignored), treasuryBalance(edict) - Math.ceil(woolLevyAmount(edict) * 1.5));
  const record = advanceHistory(edict, ignored).history!.records.find(entry => entry.template === "war.unanswered")!;
  assert.equal(historySummary(record), "양모 공납 칙령에 답하지 않았다");
  // The whole sequence under the bot's answers, twice, and through a save.
  const once = (state: GameState) => {
    let next = state;
    for (let offset = 1; offset <= recoverySeasonOffset(state) + 1; offset += 1) {
      next = season(next, offset);
      for (let action = chapterDecisionAction(next, "relief", "accept"); action?.kind === "petition_response"; action = chapterDecisionAction(next, "relief", "accept")) {
        next = respondToPetition(next, action.petitionId, action.response);
      }
    }
    return next;
  };
  const a = once(town), b = once(town);
  assert.deepEqual(a, b);
  assert.ok(a.war!.raid !== undefined);
  const saved = decodeSave(encodeSave({ state: a, createdAt: "2026-09-27T00:00:00.000Z", savedAt: "2026-09-27T00:00:00.000Z" }).bytes);
  assert.equal(saved.envelope.schemaVersion, SAVE_SCHEMA_VERSION);
  assert.ok(SAVE_SCHEMA_VERSION >= 20);
  assert.deepEqual(saved.envelope.state, a);
  // A v19 save has had no war.
  const v19 = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v19/palisade-construction.save.json")));
  assert.deepEqual([v19.migratedFrom, (v19.envelope.state as GameState).war], [19, undefined]);
});

/** The war town with `fleece` fleeces in its first storehouse (C5: the fleece is a good the pastoral farms shear). */
function withFleece(state: GameState, fleece: number): GameState {
  const store = state.buildings.filter(building => building.kind === "storehouse").sort((a, b) => a.id.localeCompare(b.id))[0]!;
  return { ...state, buildings: state.buildings.map(building => building === store ? { ...building, inventory: { ...building.inventory, fleece } } : building) };
}

test("E21 (WR-2 in kind, FIX-7 → C5) the wool in kind is the town's fleece first, taken from the stores onto the ledger's in-kind account, and only the rest in cash", () => {
  const levy = 24 * WAR_BALANCE.woolLevyPerHouse;
  const perSeason = woolInKindPerSeason(levy);
  assert.equal(perSeason, Math.ceil(Math.ceil(levy * 1.25) / 4));
  const need = Math.ceil(perSeason / CLOTH_BALANCE.fleeceValue);
  const answered = (fleece: number) => {
    const edict = season(season(withFleece(warTown(), fleece), 0), 1);
    return respondToPetition(edict, open(edict, WOOL_PAYMENT_PETITION_ID)!.id, "accept");
  };
  const inKindOf = (state: GameState) => (state.ledger?.entries ?? []).filter(entry => entry.account === "in_kind" && entry.category === "wool_levy");
  const fleeceOf = (state: GameState) => townFleece(state);
  // No fleece: all in cash, as before FIX-7.
  const bare = run(answered(0), 2, 6);
  assert.equal(-cashOf(bare, "wool_levy"), 4 * perSeason);
  assert.equal(inKindOf(bare).length, 0);
  // Fleece for a season and a half: the first season wholly in kind, the second half, then cash; the stores are emptied.
  const some = Math.floor(need * 1.5);
  const part = run(answered(some), 2, 6);
  assert.deepEqual(inKindOf(part).map(entry => [entry.amount, entry.resource, entry.sourceRefs.at(-1)!.detail]),
    [[-perSeason, FLEECE_RESOURCE, `fleece:${need}`], [-(some - need) * CLOTH_BALANCE.fleeceValue, FLEECE_RESOURCE, `fleece:${some - need}`]]);
  assert.equal(-cashOf(part, "wool_levy"), 4 * perSeason - perSeason - (some - need) * CLOTH_BALANCE.fleeceValue);
  assert.equal(fleeceOf(part), 0, "the collectors carried the fleece off");
  // Fleece enough: no cash at all; each season takes what it needs and no more.
  const full = run(answered(400), 2, 6);
  assert.equal(cashOf(full, "wool_levy"), 0);
  assert.deepEqual(inKindOf(full).map(entry => entry.amount), [-perSeason, -perSeason, -perSeason, -perSeason]);
  assert.equal(fleeceOf(full), 400 - 4 * need);
  assert.deepEqual(woolInKindSplit(withFleece(warTown(), 400), perSeason), { fleeces: need, inKind: perSeason, cash: 0 });
  // The forecast (HL-3) counts only the cash: two seasons, the second with what the first left.
  const edict = season(season(withFleece(warTown(), some), 0), 1);
  assert.equal(warDecisionForecast(edict, WOOL_PAYMENT_PETITION_ID, "accept"), 5000 - (perSeason - (some - need) * CLOTH_BALANCE.fleeceValue));
  // A treasury short of the shortfall owes it as arrears, as before; the fleece is still paid.
  const poor = run((() => { const e = season(season(withFleece(warTown(0), 10), 0), 1); return respondToPetition(e, open(e, WOOL_PAYMENT_PETITION_ID)!.id, "accept"); })(), 2, 2);
  assert.equal(poor.money!.arrears.at(-1)!.amount, perSeason - 10 * CLOTH_BALANCE.fleeceValue);
  assert.equal(inKindOf(poor).length, 1);
});
