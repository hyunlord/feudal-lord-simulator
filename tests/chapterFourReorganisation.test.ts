/**
 * F4-A chapter 4's reorganisation (spec docs/design/chapter-four-reorganisation.md RG-1…RG-12): scenarios R1–R12. The
 * town is the chapter-4 town (fixture `chapter-four-town`, winter 1368) with two weaver's houses placed by command; one
 * run under the bot's answers from its first season (spring 1369) to the cloth-or-grain question (summer 1373) is shared,
 * and the later clauses start from its end moved to their years (the calendar only).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { CHAPTER_FOUR, PETITION_DEFS, type PetitionResponse } from "../src/content/chapterConfig";
import { CLOTH_BALANCE } from "../src/content/clothConfig";
import {
  BOROUGH_CHARTER_PETITION_ID, BRIDGE_TOLLS_RIGHT_ID, CLOTH_OR_GRAIN_PETITION_ID, GUILD_CHARTER_PETITION_ID, MARKET_TOLLS_RIGHT_ID,
  REORGANISATION_BALANCE as B, REORGANISATION_PETITION_IDS, TAX_COLLECTION_PETITION_ID,
} from "../src/content/reorganisationConfig";
import { chapterDecisionAction } from "../src/engine/autoplayEvents";
import type { GameState } from "../src/engine/engine.types";
import { harvestYieldPermille } from "../src/engine/eventSchedule";
import { factionsList } from "../src/engine/factions";
import { marketSalePrice, settleMarkets } from "../src/engine/marketSettlement";
import { chapterEnd, chapterGoals, openPetitions } from "../src/engine/politics";
import {
  advanceReorganisation, chapterFiveStart, factionInfluence, guildOf, reorganisationDecisionForecast, reorganisationDefinition, reorganisationForecast,
  reorganisationStage, revoltPressure,
} from "../src/engine/reorganisation";
import { endChapterFour } from "../src/engine/politics";
import { advanceTick } from "../src/engine/tick";
import { treasuryBalance } from "../src/ledger/ledger";
import { decodeSave, encodeSave } from "../src/save/saveCodec";
import { SAVE_SCHEMA_VERSION } from "../src/save/saveTypes";
import { gameReducer } from "../src/state/gameStore";
import { BUILDING_CONFIG_BY_KIND } from "../src/content/buildingConfig";
import { movedTo, placeNear, reorganisationTown, runAnswering, type Answers } from "./helpers/reorganisationTown";

const SEASON = 1000;
const YEAR = 4000;
const at = (year: number, season = 0) => (year - 1300) * YEAR + season * SEASON;
const BOT: Answers = Object.fromEntries(REORGANISATION_PETITION_IDS.map(id => [id, "accept" as PetitionResponse]));
const cash = (state: GameState, category: string) => (state.ledger?.entries ?? []).filter(entry => entry.account === "cash" && entry.category === category);
const records = (state: GameState, template: string) => (state.history?.records ?? []).filter(record => record.template === template);
const relation = (state: GameState, id: string) => state.factions!.factions.find(faction => faction.id === id)!.relation;
const lived = (state: GameState) => state.houses.filter(house => house.residents > 0 && house.abandonedTick === undefined).length;
/** The state with the reorganisation's `answers` set as given (a later clause's premise), nothing else edited. */
const answered = (state: GameState, answers: GameState["reorganisation"] extends infer R ? R extends { answers: infer A } ? A : never : never) =>
  ({ ...state, reorganisation: { ...state.reorganisation!, answers: { ...state.reorganisation!.answers, ...answers } } });

// The town (winter 1368) with two weaver's houses by the storehouse (the player's commands, before the run).
const fixture = reorganisationTown();
const store = fixture.buildings.filter(building => building.kind === "storehouse").sort((a, b) => a.id.localeCompare(b.id))[0]!;
const town = placeNear(placeNear(fixture, "weaver_house", store), "weaver_house", store);
const START = at(1369);
const snapshots = new Map<number, GameState>();
const KEEP = new Set([START, START + SEASON, at(1370) + 1, at(1371) + 1, at(1371, 1) + 1, at(1372, 1) + 1, at(1373, 1) + 1]);
const shared = runAnswering(town, at(1373, 1) + 1, BOT, state => { if (KEEP.has(state.tick)) snapshots.set(state.tick, state); });
const snap = (tick: number) => snapshots.get(tick)!;

test("R1 (RG-1) the reorganisation begins with chapter 4's first season, the neighbours' wages a season on, the textile street and the alehouses when the town has them, the petitions the season after", () => {
  assert.equal(fixture.reorganisation, undefined, "the v26 town has not begun it");
  const chapterThree = { ...fixture, tick: at(1369), politics: { ...fixture.politics!, chapter: { ...fixture.politics!.chapter, number: 3 } } };
  assert.equal(advanceReorganisation(chapterThree, endChapterFour), chapterThree, "nothing in chapter 3");
  const start = snap(START);
  assert.equal(start.reorganisation!.startTick, START);
  assert.equal(reorganisationStage(start), "rumour");
  assert.equal(snap(START + SEASON).reorganisation!.wageCompetitionTick, START + SEASON);
  const r = shared.reorganisation!;
  assert.equal(r.textileStreetTick, START + B.textileStreetAfter * SEASON, "two weaver's houses by then");
  assert.equal(r.alehouseBoomTick, START + B.alehouseBoomAfter * SEASON, "24 alehouses, a cask each a season");
  assert.equal(r.surgeTick, r.alehouseBoomTick! + SEASON);
  assert.equal(reorganisationStage(shared), "arrival");
  const steps = reorganisationForecast(shared);
  assert.deepEqual(steps.map(step => step.id), ["wage_competition", "textile_street", "alehouse_boom", "petitions_surge", "guild_demand", "cloth_or_grain",
    "overlord_warning", "poll_tax", "rebellion_rumour", "autonomy_request", "end"]);
  assert.equal(steps.find(step => step.id === "poll_tax")!.tick, at(1377));
  for (const template of ["reorg.wage_competition", "reorg.textile_street", "reorg.alehouse_boom", "reorg.petitions_surge"]) assert.equal(records(shared, template).length, 1, template);
});

test("R2 (RG-2) the neighbours lure households with wages for a year — the poorest go, the neighbour is remembered", () => {
  const r = shared.reorganisation!;
  assert.ok(r.wageLeavers >= 1 && r.wageLeavers <= B.wageCompetitionSeasons, `left ${r.wageLeavers}`);
  const moves = records(shared, "faction.relation").filter(record => record.params?.reason === "reorg:wage_competition");
  assert.equal(moves.reduce((sum, record) => sum + Number(record.params?.delta), 0), -2 * r.wageLeavers);
  const late = runAnswering(movedTo(shared, at(1375)), at(1375) + 2 * SEASON, BOT);
  assert.equal(late.reorganisation!.wageLeavers, r.wageLeavers, "no more after the year");
});

test("R3 (RG-3) from chapter 4 cloth sells at 40d (50d specialised), apart from the market's everyday trade, with an 8d seal and a fifth of its price as the lord's toll; before, 30d and 4d", () => {
  const cloth = (state: GameState) => ({ ...state, tick: state.tick - (state.tick % 80) + 80, buildings: state.buildings.map(building => building.id === store.id
    ? { ...building, inventory: { ...building.inventory, finished_cloth: 5 } } : building) });
  const before = { ...cloth(fixture) };
  assert.equal(marketSalePrice(before, "finished_cloth"), CLOTH_BALANCE.clothPrice);
  const old = settleMarkets(before);
  assert.deepEqual(cash(old, "ulnage").slice(-1).map(entry => entry.amount), [CLOTH_BALANCE.ulnagePerCloth]);
  assert.equal(cash(old, "cloth_toll").length, 0);
  const grain = answered(cloth(snap(START)), {});
  assert.equal(marketSalePrice(grain, "finished_cloth"), B.clothPrice);
  const now = settleMarkets(grain);
  const markets = now.buildings.filter(building => building.kind === "market").length;
  const sold = (state: GameState) => (state.ledger?.entries ?? []).filter(entry => entry.tick === state.tick && entry.category === "ulnage");
  assert.equal(sold(now).length, markets, "a cloth a market, the everyday trade apart");
  assert.ok(sold(now).every(entry => entry.amount === B.ulnagePerCloth));
  assert.ok(cash(now, "cloth_toll").filter(entry => entry.tick === now.tick).every(entry => entry.amount === B.clothPrice * B.clothTollPermille / 1000));
  const specialised = answered(grain, { [CLOTH_OR_GRAIN_PETITION_ID]: "accept" });
  assert.equal(marketSalePrice(specialised, "finished_cloth"), B.specialisedClothPrice);
});

test("R4 (RG-4) the town's and the merchants' influence grow with people, cloth, the guild and rights; the earl warns a strong town once", () => {
  const start = snap(START);
  const r = start.reorganisation!;
  const people = Math.min(40, Math.floor(start.population / 20));
  const townRights = start.politics!.rights.filter(right => right.holder === "townsfolk" || right.holder === "craftsmen").length;
  assert.equal(r.influence.town, people + Math.min(10, townRights * 5), "no cloth, no guild yet");
  const merchantCharter = start.politics!.rights.some(right => right.holder === "merchants" && right.id === "market_charter") ? 10 : 0;
  assert.equal(r.influence.merchant_house_1, merchantCharter + Math.min(20, Math.floor(start.politics!.merchantGauge / 5)));
  assert.equal(r.influence.merchant_house_2, Math.floor(r.influence.merchant_house_1! * 600 / 1000));
  assert.equal(factionInfluence(shared, "town"), shared.reorganisation!.influence.town);
  assert.ok((factionInfluence(shared, "town") ?? 0) > r.influence.town!, "grown with the cloth and the guild");
  assert.equal(factionsList(shared).find(faction => faction.id === "town")!.influence, shared.reorganisation!.influence.town);
  assert.equal(factionsList(shared).find(faction => faction.id === "overlord")!.influence, undefined);
  assert.equal(factionInfluence(fixture, "town"), null, "none before chapter 4");
  const warned = shared.reorganisation!.warningTick;
  assert.notEqual(warned, undefined, "the town passed 50");
  assert.equal(records(shared, "reorg.overlord_warning").length, 1);
  assert.ok(records(shared, "faction.relation").some(record => record.params?.reason === "reorg:overlord_warning" && record.params?.faction === "overlord"));
});

test("R5 (RG-5) the guild: granted, it stands with a head and speeds the cloth buildings; refused, two weavers' households go and the looms slow", () => {
  const guildAt = shared.politics!.petitions.find(petition => petition.defId === GUILD_CHARTER_PETITION_ID)!;
  assert.equal(guildAt.arrivedTick, shared.reorganisation!.surgeTick! + B.guildAfterSurge * SEASON);
  assert.equal(guildAt.petitioner, "craftsmen");
  const guild = guildOf(shared)!;
  assert.equal(guild.foundedTick, guildAt.respondedTick);
  assert.ok(shared.persons!.people.some(person => person.id === guild.headId), "a living head");
  for (const kind of ["weaver_house", "fulling_mill", "dyehouse", "tenter_yard"] as const) {
    assert.equal(reorganisationDefinition(shared, kind).production!.ticksPerOutput, Math.round(BUILDING_CONFIG_BY_KIND[kind].production!.ticksPerOutput * 0.75), kind);
  }
  assert.equal(reorganisationDefinition(shared, "mill"), BUILDING_CONFIG_BY_KIND.mill);
  // Refused (the same town answering the guild's demand the other way): the season after, the two households nearest
  // the looms leave; the weaving slows.
  const refused = runAnswering(snap(at(1371, 1) + 1), guildAt.arrivedTick + 1, { ...BOT, [GUILD_CHARTER_PETITION_ID]: "refuse" });
  assert.equal(guildOf(refused), null);
  assert.equal(reorganisationDefinition(refused, "weaver_house").production!.ticksPerOutput, Math.round(BUILDING_CONFIG_BY_KIND.weaver_house.production!.ticksPerOutput * 1.25));
  const after = runAnswering(refused, Math.ceil((refused.tick + 1) / SEASON) * SEASON + 1, {});
  assert.equal(after.reorganisation!.weaverLeavers, B.refusedWeaverHouseholds);
  assert.equal(lived(after), lived(refused) - B.refusedWeaverHouseholds);
  assert.ok(records(after, "faction.relation").some(record => record.params?.reason === `petition:${GUILD_CHARTER_PETITION_ID}:refuse` && record.params?.faction === "merchant_house_1"));
});

test("R6 (RG-6) the poll tax of 1377: left to the town, a penny an adult a collection; the lord's collectors, three pence", () => {
  const spring = runAnswering(movedTo(shared, at(1377)), at(1377) + 1, {});
  const petition = openPetitions(spring).find(entry => entry.defId === TAX_COLLECTION_PETITION_ID)!;
  assert.equal(petition.petitioner, "townsfolk");
  const collect = (response: PetitionResponse) => {
    const answer = gameReducer(spring, { type: "petition_response", petitionId: petition.id, response });
    return runAnswering(answer, at(1377, 1) + 1, {});
  };
  const delegated = collect("accept"), direct = collect("refuse");
  const adults = cash(delegated, "poll_tax").at(-1)!.amount / B.delegatedPerAdult;
  assert.ok(adults > 100, `adults ${adults}`);
  assert.equal(cash(direct, "poll_tax").at(-1)!.amount, adults * B.directPerAdult);
  const counted = reorganisationDecisionForecast(spring, TAX_COLLECTION_PETITION_ID, "accept") - treasuryBalance(spring);
  assert.equal(reorganisationDecisionForecast(spring, TAX_COLLECTION_PETITION_ID, "refuse") - treasuryBalance(spring), counted * B.directPerAdult, "the card's prediction");
  assert.ok(relation(delegated, "commons") > relation(direct, "commons"));
  // Unanswered a season: the lord's collectors (direct).
  const silent = runAnswering(spring, at(1377, 1) + 1, {});
  assert.equal(silent.reorganisation!.answers[TAX_COLLECTION_PETITION_ID], "expired");
  assert.equal(cash(silent, "poll_tax").at(-1)!.amount, adults * B.directPerAdult);
});

test("R7 (RG-7) cloth or grain: turned to cloth, the price rises and the harvest falls for good; grain keeps both", () => {
  const petition = shared.politics!.petitions.find(entry => entry.defId === CLOTH_OR_GRAIN_PETITION_ID)!;
  assert.equal(petition.arrivedTick, shared.politics!.petitions.find(entry => entry.defId === GUILD_CHARTER_PETITION_ID)!.arrivedTick + B.clothAfterGuild * SEASON);
  assert.equal(petition.petitioner, "merchants");
  const grain = answered(shared, { [CLOTH_OR_GRAIN_PETITION_ID]: "refuse" });
  const tick = at(1374, 2);
  assert.equal(harvestYieldPermille(shared, tick), Math.round(harvestYieldPermille(grain, tick) * B.specialisedHarvestPermille / 1000));
  assert.equal(marketSalePrice(grain, "finished_cloth"), B.clothPrice);
  assert.equal(marketSalePrice(shared, "finished_cloth"), B.specialisedClothPrice);
  assert.ok(revoltPressure(shared).causes.some(cause => cause.id === "cloth_specialised"));
  assert.ok(!revoltPressure(grain).causes.some(cause => cause.id === "cloth_specialised"));
});

/** 1381: the bot's town with the tax answered `tax` and the guild `guild`, just before the rumour. */
function beforeRumour(tax: PetitionResponse, guild: PetitionResponse = "accept"): GameState {
  return movedTo(answered(shared, { [TAX_COLLECTION_PETITION_ID]: tax, [GUILD_CHARTER_PETITION_ID]: guild }), at(1381, 1));
}

test("R8 (RG-8) the rumour of 1381: with pressure of 50 or more the town chases the collectors (no tax, the rent withheld, the lords estranged, the demand at once); below, it passes — nobody dies", () => {
  const quiet = runAnswering(beforeRumour("accept"), at(1381, 1) + 1, {});
  assert.equal(quiet.reorganisation!.rebellion!.outcome, "quiet");
  assert.equal(quiet.reorganisation!.rebellion!.pressure, B.pressure.cloth_specialised);
  assert.equal(cash(quiet, "poll_tax").at(-1)?.tick, at(1381, 1), "collected");
  const direct = beforeRumour("refuse");
  assert.deepEqual(revoltPressure(direct).causes.map(cause => cause.id), ["direct_collection", "cloth_specialised"]);
  const chased = runAnswering(direct, at(1381, 1) + 1, {});
  assert.equal(chased.reorganisation!.rebellion!.outcome, "chased");
  assert.equal(cash(chased, "poll_tax").filter(entry => entry.tick === at(1381, 1)).length, 0, "the collectors chased");
  assert.equal(records(chased, "reorg.rebellion_rumour").length, 1);
  assert.equal(chased.population, quiet.population, "nobody dies");
  assert.ok(relation(chased, "overlord") < relation(quiet, "overlord") && relation(chased, "crown") < relation(quiet, "crown"));
  // The next period's rent withheld; the town's demand the season after.
  const period = runAnswering(chased, Math.ceil(chased.tick / 2400) * 2400 + 1, {});
  assert.equal(cash(period, "rent").filter(entry => entry.tick > chased.tick).length, 0, "the court rolls burnt");
  const demand = runAnswering(chased, at(1381, 2) + 1, {});
  assert.equal(demand.reorganisation!.autonomyTick, at(1381, 2));
  assert.ok(openPetitions(demand).some(petition => petition.defId === BOROUGH_CHARTER_PETITION_ID));
});

test("R9 (RG-9) the charter: granted in part, the market's dues and half the tolls go to the town for a fee farm; refused, the backlash waits in chapter 5", () => {
  const due = runAnswering(movedTo(answered(shared, { [TAX_COLLECTION_PETITION_ID]: "accept" }), at(1382)), at(1382) + 1, {});
  assert.equal(due.reorganisation!.autonomyTick, at(B.autonomyWithGuildYear), "sooner with the guild");
  const noGuild = answered(shared, { [GUILD_CHARTER_PETITION_ID]: "refuse" });
  assert.equal(reorganisationForecast(noGuild).find(step => step.id === "autonomy_request")!.tick, at(B.autonomyYear));
  const petition = openPetitions(due).find(entry => entry.defId === BOROUGH_CHARTER_PETITION_ID)!;
  const partial = gameReducer(due, { type: "petition_response", petitionId: petition.id, response: "accept" });
  const held = partial.politics!.rights.filter(right => right.holder === "townsfolk").map(right => right.id);
  assert.ok(held.includes(MARKET_TOLLS_RIGHT_ID) && held.includes(BRIDGE_TOLLS_RIGHT_ID));
  const refused = gameReducer(due, { type: "petition_response", petitionId: petition.id, response: "refuse" });
  assert.ok(relation(partial, "town") > relation(refused, "town"));
  assert.ok(relation(partial, "overlord") < relation(refused, "overlord"), "the earl against the charter");
  const warnedLine = records(partial, "faction.relation").find(record => record.params?.reason === `petition:${BOROUGH_CHARTER_PETITION_ID}:accept` && record.params?.faction === "overlord")!;
  assert.equal(warnedLine.params?.delta, -25, "the earl warned first");
  // The next period: no stall fee, half the tolls; the next spring, the fee farm.
  const year = runAnswering(partial, at(1383) + 1, {});
  assert.equal(cash(year, "stall_fee").filter(entry => entry.tick > partial.tick && entry.sourceRefs.some(ref => ref.detail?.startsWith("stalls:"))).length, 0);
  assert.deepEqual(cash(year, "fee_farm").map(entry => [entry.tick, entry.amount]), [[at(1383), B.feeFarm]]);
  const fiveStart = chapterFiveStart(year)!;
  assert.equal(fiveStart.charter, "partial");
  assert.deepEqual(fiveStart.rights, [MARKET_TOLLS_RIGHT_ID, BRIDGE_TOLLS_RIGHT_ID]);
  assert.equal(fiveStart.backlash, 0);
  const no = runAnswering(refused, at(1382, 1) + 1, {});
  assert.equal(chapterFiveStart(no)!.charter, "refused");
  assert.equal(chapterFiveStart(no)!.backlash, Math.max(B.backlashFloor, no.reorganisation!.influence.town!));
});

test("R10 (RG-10) chapter 4 ends the season after the charter's answer (by 1400 at the latest); its page carries the reorganisation; chapter 5 begins", () => {
  const due = runAnswering(movedTo(answered(shared, { [TAX_COLLECTION_PETITION_ID]: "accept" }), at(1382)), at(1382) + 1, BOT);
  assert.equal(chapterEnd(due, CHAPTER_FOUR.chapter), null, "answered, not yet ended");
  const ended = runAnswering(due, at(1382, 1) + 1, BOT);
  const end = chapterEnd(ended, CHAPTER_FOUR.chapter)!;
  assert.equal(end.tick, at(1382, 1));
  assert.equal(ended.politics!.chapter.number, 5);
  assert.equal(end.chronicle.stats.reorganisation!.charter, "partial");
  assert.equal(end.chronicle.stats.reorganisation!.guild, true);
  assert.deepEqual(chapterGoals(ended).at(-1), { chapter: 4, id: "charter", reachedTick: end.tick });
  assert.equal(reorganisationStage(ended), "done");
  // The calendar: 1400 with no charter.
  const late = runAnswering(movedTo(shared, at(1400)), at(1400) + 1, {});
  assert.equal(chapterFiveStart(late)!.charter, "calendar");
  assert.equal(late.politics!.chapter.number, 5);
});

test("R11 (RG-11) the bot's answers (the guild, the town's collection, cloth, the charter in part) and its textile street", () => {
  for (const defId of REORGANISATION_PETITION_IDS) {
    const state = { ...shared, politics: { ...shared.politics!, petitions: [{ id: `${defId}@1`, defId, petitioner: "townsfolk" as const, arrivedTick: 1 }] } };
    assert.deepEqual(chapterDecisionAction(state, "relief", "accept"), { kind: "petition_response", petitionId: `${defId}@1`, response: "accept" }, defId);
  }
  assert.equal(shared.reorganisation!.answers[GUILD_CHARTER_PETITION_ID], "accept");
  assert.equal(shared.reorganisation!.answers[CLOTH_OR_GRAIN_PETITION_ID], "accept");
});

test("R12 (RG-11) the save round trip (v27) mid-chapter, the same course twice, chapters 1–3 untouched, and a card's other answers refused", () => {
  const mid = snap(at(1371) + 1);
  const loaded = decodeSave(encodeSave({ state: mid, createdAt: "2026-09-29T00:00:00.000Z", savedAt: "2026-09-29T00:00:00.000Z" }).bytes).envelope;
  assert.equal(loaded.schemaVersion, SAVE_SCHEMA_VERSION);
  assert.equal(SAVE_SCHEMA_VERSION, 27);
  const a = runAnswering(loaded.state as GameState, at(1371) + 2 * SEASON, BOT);
  const b = runAnswering(mid, at(1371) + 2 * SEASON, BOT);
  assert.deepEqual(a.reorganisation, b.reorganisation);
  assert.equal(treasuryBalance(a), treasuryBalance(b));
  // Before chapter 4: cloth at its chapter-3 price, the rules untouched.
  assert.equal(advanceReorganisation({ ...fixture, tick: at(1369) - 1 }, endChapterFour).reorganisation, undefined);
  assert.equal(reorganisationDefinition(fixture, "weaver_house"), BUILDING_CONFIG_BY_KIND.weaver_house);
  // A card offers accept and refuse only.
  for (const id of REORGANISATION_PETITION_IDS) assert.deepEqual(PETITION_DEFS.find(def => def.id === id)!.responses, ["accept", "refuse"]);
  const spring = runAnswering(movedTo(shared, at(1377)), at(1377) + 1, {});
  const tax = openPetitions(spring).find(entry => entry.defId === TAX_COLLECTION_PETITION_ID)!;
  assert.equal(gameReducer(spring, { type: "petition_response", petitionId: tax.id, response: "accept_with_price" }), spring);
  assert.equal(advanceTick(spring).reorganisation!.answers[TAX_COLLECTION_PETITION_ID], undefined);
});
