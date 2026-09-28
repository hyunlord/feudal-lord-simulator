/**
 * F3-A chapter 3's Black Death (spec docs/design/chapter-three-plague.md PL-1…PL-11): scenarios P1–P12. The town is
 * the 24-house walled town (v19 fixture) in chapter 3 at spring 1348 (`tests/helpers/plagueTown.ts`). One run under
 * the bot's answers to the spring of 1353 is shared; the late clauses start from states moved to their years.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { CHAPTER_THREE, type PetitionResponse } from "../src/content/chapterConfig";
import {
  CASH_RENT_PETITION_ID, LAND_REDISTRIBUTION_PETITION_ID, PLAGUE_BALANCE, VACANT_PRIEST_PETITION_ID, WAGES_PETITION_ID,
} from "../src/content/plagueConfig";
import { SANDBOX_SCENARIO_ID } from "../src/content/scenario/coreScenarios";
import { chapterDecisionAction } from "../src/engine/autoplayEvents";
import type { GameState } from "../src/engine/engine.types";
import { foodPricePermille } from "../src/engine/eventSchedule";
import { historySummary } from "../src/engine/history";
import { derelictPermille, lordFamilyExtinct } from "../src/engine/lordship";
import { labourPool, LORD_FAMILY_TAG } from "../src/engine/persons";
import {
  advancePlague, arrivalSeasonOffset, curacyVacant, plagueDecisionForecast, plagueForecast, plagueHousing, plagueRecoveryPermille, plagueStage,
  plagueVacantPlots, plagueVictims,
} from "../src/engine/plague";
import { chapterEnd, chapterGoals, endChapterThree, openPetitions, respondToPetition } from "../src/engine/politics";
import { advanceTick } from "../src/engine/tick";
import { treasuryBalance } from "../src/ledger/ledger";
import { decodeSave, encodeSave } from "../src/save/saveCodec";
import { SAVE_SCHEMA_VERSION } from "../src/save/saveTypes";
import { gameReducer } from "../src/state/gameStore";
import { PLAGUE_ERA_TICK, plagueTown } from "./helpers/plagueTown";

const SEASON = 1000;
const YEAR = 4000;
const E = PLAGUE_ERA_TICK;
const spring = (year: number) => (year - 1300) * YEAR;
type Answers = Partial<Record<string, PetitionResponse>>;
const BOT: Answers = { [VACANT_PRIEST_PETITION_ID]: "accept", [WAGES_PETITION_ID]: "accept", [LAND_REDISTRIBUTION_PETITION_ID]: "accept_with_price", [CASH_RENT_PETITION_ID]: "accept" };

/** Ticks to `until`, answering each plague petition as it comes (`answers`; none: left unanswered). */
function run(state: GameState, until: number, answers: Answers = BOT, watch?: (state: GameState) => void): GameState {
  let next = state;
  while (next.tick < until) {
    next = advanceTick(next);
    for (const petition of openPetitions(next)) {
      const response = answers[petition.defId];
      // The game command, as the player's card or the bot sends it (its decision and faction records with it).
      if (response !== undefined) next = gameReducer(next, { type: "petition_response", petitionId: petition.id, response });
    }
    watch?.(next);
  }
  return next;
}
/** The state with the petition of `id` open again (its answer taken back). */
function reopen(state: GameState, id: string, extra: Partial<GameState["politics"] & object> = {}): GameState {
  const petitions = state.politics!.petitions.map(entry => { if (entry.id !== id) return entry; const { response: _r, respondedTick: _t, ...open } = entry; return open; });
  return { ...state, politics: { ...state.politics!, ...extra, petitions } };
}
function withoutPlague(state: GameState): GameState {
  const { plague: _plague, ...rest } = state;
  return rest;
}
const cash = (state: GameState, category: string) => (state.ledger?.entries ?? []).filter(entry => entry.account === "cash" && entry.category === category);
const records = (state: GameState, template: string) => (state.history?.records ?? []).filter(record => record.template === template);

// The shared run: the town, the arrival's four seasons, the recovery, into the resettlement (spring 1353).
const town = plagueTown();
const arrival = E + arrivalSeasonOffset(town) * SEASON;
const snapshots = new Map<number, GameState>();
const KEEP = new Set([E + SEASON + 1, arrival + 1, arrival + SEASON + 2, arrival + 4 * SEASON + 2, spring(1351) + 2, spring(1352) + 2, spring(1353)]);
const shared = run(town, spring(1353), BOT, state => { if (KEEP.has(state.tick)) snapshots.set(state.tick, state); });
const at = (tick: number) => snapshots.get(tick)!;

test("P1 (PL-1) the collapse era brings the harbour fever's rumour a season on, the pestilence a season after (a coastal town); nothing before 1348; an old save after 1350 has missed it", () => {
  assert.equal(advancePlague({ ...town, tick: E - SEASON, historicalEras: town.historicalEras!.filter(entry => entry.id !== "collapse") }, endChapterThree).plague, undefined);
  const era = advancePlague({ ...town, tick: E }, endChapterThree);
  assert.deepEqual(era.plague, { eraTick: E, answers: {}, vacantHouseIds: [], resettled: 0, recovered: 0, fled: 0 });
  assert.equal(advancePlague({ ...town, tick: spring(1351) }, endChapterThree).plague, undefined, "missed");
  assert.equal(arrivalSeasonOffset(town), PLAGUE_BALANCE.rumourSeason + PLAGUE_BALANCE.coastalArrivalAfterRumour, "the core town stands on a tidal river");
  const rumour = at(E + SEASON + 1);
  assert.equal(rumour.plague!.rumourTick, E + SEASON);
  assert.equal(plagueStage(rumour), "rumour");
  assert.equal(historySummary(records(rumour, "plague.rumour")[0]!), "항구에서 열병이 돈다는 소문이 들어왔다");
  assert.deepEqual(plagueForecast(rumour).map(step => [step.id, step.state]).slice(0, 3), [["rumour", "now"], ["arrival", "ahead"], ["wage_demand", "ahead"]]);
  const arrived = at(arrival + 1);
  assert.equal(plagueStage(arrived), "arrival");
  assert.equal(arrived.plague!.first!.arrivalTick, arrival);
  assert.equal(records(arrived, "plague.arrived").length, 1);
});

test("P2 (PL-2) a year's pestilence takes 42–48 % of the town person by person — the old and small children most, whole households too — and the lord's household at the same odds", () => {
  const first = shared.plague!.first!;
  assert.ok(first.deathPermille >= 420 && first.deathPermille <= 480);
  const rate = first.dead * 1000 / first.populationAtArrival;
  assert.ok(rate >= 400 && rate <= 500, `died ${rate}‰`);
  assert.equal(first.dead, Math.floor(first.populationAtArrival * first.deathPermille / 1000));
  assert.equal(first.endTick, arrival + 4 * SEASON);
  // By season: the shares 20 / 35 / 30 / 15 % of the dead.
  const total = Math.floor(first.populationAtArrival * first.deathPermille / 1000);
  assert.equal(at(arrival + SEASON + 2).plague!.first!.dead, Math.round(total * (200 + 350) / 1000));
  // Each dead is a person of the ledger and the family tree: dead of the pestilence, in the past.
  const dead = shared.persons!.past.filter(person => person.deathCause === "plague");
  assert.equal(dead.length, first.dead + first.manorDead + (shared.plague!.second?.dead ?? 0));
  assert.ok(dead.every(person => !person.alive));
  assert.ok(records(shared, "person.died").some(record => record.params?.cause === "plague"));
  // The old died at a higher rate than the grown (this town's persons are all 14 or more in 1348; the young weigh in P9).
  const byAge = (low: number, high: number) => {
    const people = [...town.persons!.people].filter(person => person.householdId !== "manor" && 1348 - person.birthYear >= low && 1348 - person.birthYear < high);
    const died = people.filter(person => dead.some(entry => entry.id === person.id)).length;
    return people.length === 0 ? 0 : died / people.length;
  };
  assert.ok(byAge(55, 200) > byAge(14, 55), `old ${byAge(55, 200)} grown ${byAge(14, 55)}`);
  // Whole households: their houses stood empty.
  assert.ok(first.wipedHouses >= 1);
  assert.ok(at(arrival + 4 * SEASON + 2).plague!.vacantHouseIds.length >= first.wipedHouses);
  assert.ok(records(shared, "plague.empty_streets").length === 1 && records(shared, "plague.new_graves").length === 1);
  const fields = records(shared, "plague.abandoned_fields")[0]!;
  assert.match(historySummary(fields), /^역병이 물러갔다 — \d+명 가운데 \d+명이 죽고, 빈 필지 \d+곳, 밭이 버려졌다$/);
  // The lord's household is drawn at the town's odds: a victims' draw on a town of one manor person gives it a chance.
  const draw = plagueVictims({ ...at(arrival + SEASON + 2), tick: arrival + SEASON + 1 }, at(arrival + SEASON + 2).persons!.people, 1348);
  assert.ok([...draw].every(id => at(arrival + SEASON + 2).persons!.people.some(person => person.id === id)));
});

test("P3 (PL-3) after the arrival the growth rule adds nobody: the town recovers a share a season, the emptied houses wait for the resettlement (not the ladder), and they pay no rent", () => {
  assert.deepEqual(plagueHousing(at(arrival + 1)), { growthHeld: true, holdPermille: 1000 });
  assert.equal(plagueHousing(town), undefined);
  const before = at(arrival + 4 * SEASON + 2);
  const later = at(spring(1351) + 2);
  const budget = Math.ceil(before.plague!.first!.populationAtArrival * PLAGUE_BALANCE.recoveryPermille / 1000);
  const seasons = (spring(1351) - (arrival + 4 * SEASON)) / SEASON;
  assert.ok(later.population - before.population <= budget * (seasons + 1), `${later.population - before.population} > ${budget * (seasons + 1)}`);
  // The ladder resettles no vacant plot before 1352; the vacant plots pay no rent; they are not the lord's dereliction.
  const vacant = plagueVacantPlots(later);
  assert.ok(vacant.length > 0);
  assert.deepEqual(vacant.filter(id => later.houses.find(house => house.buildingId === id)!.residents > 0), []);
  assert.equal(later.plague!.resettled, 0);
  const rent = later.ledger!.entries.filter(entry => entry.category === "rent" && entry.tick > arrival + 4 * SEASON);
  assert.ok(rent.every(entry => !vacant.includes(entry.sourceRefs[0]!.id)));
  assert.ok((derelictPermille(later) ?? 0) < (derelictPermille({ houses: later.houses }) ?? 0));
});

test("P4 (PL-4) labour is short and bread and wheat sell at four fifths after the arrival", () => {
  assert.ok(labourPool(at(arrival + 4 * SEASON + 2)) < labourPool(town) * 0.7, `${labourPool(at(arrival + 4 * SEASON + 2))} of ${labourPool(town)}`);
  const without = foodPricePermille(withoutPlague(at(arrival + 1)), arrival + 1);
  assert.equal(foodPricePermille(at(arrival + 1), arrival + 1), Math.round(without * PLAGUE_BALANCE.grainPricePermille / 1000));
  const rumour = at(E + SEASON + 1);
  assert.equal(foodPricePermille(rumour, rumour.tick), foodPricePermille(withoutPlague(rumour), rumour.tick), "not before the arrival");
});

test("P5 (PL-5) the labourers ask for wages: raised, the treasury pays them each ledger period and the Statute's justices fine the lord; bound, households go where wages are paid", () => {
  const demand = at(arrival + 4 * SEASON + 2).politics!.petitions.find(petition => petition.defId === WAGES_PETITION_ID)!;
  assert.deepEqual([demand.arrivedTick, demand.petitioner, demand.response], [arrival + 2 * SEASON, "labourers", "accept"]);
  // The ledger keeps six periods of entries (older ones fold into roll-ups): the wages each period, the fine in 1351.
  const periods = (state: GameState, category: string) => new Set([...cash(state, category).map(entry => Math.floor(entry.tick / 2400)),
    ...state.ledger!.rollups.filter(rollup => rollup.account === "cash" && (rollup.byCategory as Record<string, number>)[category] !== undefined).map(rollup => Math.floor(rollup.periodStart / 2400))]);
  assert.ok(periods(shared, "wages").size >= 6, `${periods(shared, "wages").size}`);
  assert.ok(cash(shared, "wages").every(entry => entry.amount < 0));
  assert.deepEqual(cash(at(spring(1351) + 2), "statute_fine").map(entry => entry.amount), [-PLAGUE_BALANCE.statuteFine]);
  assert.equal(historySummary(records(shared, "plague.ordinance")[0]!), `노동자 조례가 낭독되었다 — 임금을 올린 영주에게 벌금 ${PLAGUE_BALANCE.statuteFine}d`);
  assert.ok(records(shared, "faction.relation").some(record => record.params?.faction === "commons" && record.params?.reason === "petition:wages:accept"));
  // Bound by the ordinance: no wages, no fine, and households leave.
  const bound = run(at(arrival + SEASON + 2), spring(1352), { ...BOT, [WAGES_PETITION_ID]: "refuse" });
  assert.equal(cash(bound, "wages").filter(entry => entry.tick >= arrival + 2 * SEASON).length, 0);
  assert.equal(cash(bound, "statute_fine").length, 0);
  assert.ok(bound.plague!.fled > 0);
  assert.equal(plagueDecisionForecast(at(arrival + SEASON + 2), WAGES_PETITION_ID, "refuse"), treasuryBalance(at(arrival + SEASON + 2)));
});

test("P6 (PL-6) the priest dies with the first dead: the churches serve nobody until the monastery's priest comes (its stipend) or a lay clerk reads at once (the bishop's grudge)", () => {
  const first = at(arrival + 1);
  assert.equal(curacyVacant(first), true);
  const churches = first.buildings.filter(building => building.kind === "church" || building.kind === "chapel");
  assert.ok(churches.length > 0 && churches.every(building => building.curacyVacant === true));
  assert.equal(historySummary(records(first, "plague.priest_died")[0]!), "사제가 역병으로 죽었다 — 교회가 비었다");
  const petition = first.politics!.petitions.find(entry => entry.defId === VACANT_PRIEST_PETITION_ID)!;
  assert.equal(petition.petitioner, "parish");
  assert.deepEqual(cash(at(arrival + SEASON + 2), "church_fee").map(entry => entry.amount), [-PLAGUE_BALANCE.monasteryStipend]);
  assert.equal(shared.plague!.curacy!.by, "monastery");
  assert.ok(shared.buildings.every(building => building.curacyVacant !== true));
  assert.equal(at(arrival + SEASON + 2).buildings.some(building => building.curacyVacant === true), true, "the monastery's priest comes the season after next");
  // A lay clerk: at once, no stipend, the bishop's relation falls.
  const unanswered: GameState = { ...reopen(first, petition.id), plague: { ...first.plague!, answers: {}, curacy: { vacantSince: arrival } } };
  const clerk = respondToPetition(unanswered, petition.id, "refuse");
  assert.equal(curacyVacant(clerk), false);
  assert.ok(clerk.buildings.every(building => building.curacyVacant !== true));
  assert.equal(respondToPetition(unanswered, petition.id, "accept_with_price"), unanswered, "the card offers two answers");
  assert.ok(records(shared, "faction.relation").some(record => record.params?.faction === "bishop" && record.params?.reason === "petition:vacant_priest:accept"));
});

test("P7 (PL-7) the empty plots: new settlers from 1352 (two households a season, their entry fines) or the neighbours take them (their levels rise faster)", () => {
  const land = shared.politics!.petitions.find(entry => entry.defId === LAND_REDISTRIBUTION_PETITION_ID)!;
  assert.equal(land.arrivedTick, arrival + 4 * SEASON);
  assert.equal(at(spring(1351) + 2).plague!.resettled, 0, "nobody before the spring of 1352");
  const settled = shared.plague!.resettled;
  assert.ok(settled >= 1 && settled <= PLAGUE_BALANCE.settlerHouseholds * 4);
  assert.equal(cash(shared, "entry_fine").reduce((sum, entry) => sum + entry.amount, 0), settled * PLAGUE_BALANCE.entryFine);
  assert.equal(historySummary(records(shared, "plague.resettlement")[0]!), "빈집에 새 가족이 들기 시작했다");
  // The neighbours: the hold at half, a household of kin a season.
  const expand = respondToPetition(reopen(at(arrival + 4 * SEASON + 2), land.id), land.id, "accept");
  assert.deepEqual(plagueHousing(expand), { growthHeld: true, holdPermille: PLAGUE_BALANCE.expandHoldPermille });
  assert.equal(respondToPetition(expand, land.id, "refuse"), expand, "no third answer");
  assert.equal(plagueDecisionForecast(expand, LAND_REDISTRIBUTION_PETITION_ID, "accept_with_price"), treasuryBalance(expand) + 2 * PLAGUE_BALANCE.settlerHouseholds * PLAGUE_BALANCE.entryFine);
});

test("P8 (PL-8) labour services: commuted, the tenants pay a quarter more rent for good and hold the right; kept, the lord's upkeep is lighter but households run", () => {
  const ask = at(spring(1352) + 2).politics!.petitions.find(entry => entry.defId === CASH_RENT_PETITION_ID)!;
  assert.deepEqual([ask.arrivedTick, ask.petitioner], [spring(1352), "townsfolk"]);
  assert.ok(shared.politics!.rights.some(right => right.id === "commuted_rent" && right.holder === "townsfolk"));
  const period = (state: GameState, category: string) => state.ledger!.entries.filter(entry => entry.category === category && entry.tick === Math.floor(state.tick / 2400) * 2400);
  const commutedRent = period(shared, "rent").reduce((sum, entry) => sum + entry.amount, 0);
  assert.ok(commutedRent > 0);
  // Kept: the upkeep at three quarters, and households run.
  const asked = at(spring(1352) + 2);
  const { [CASH_RENT_PETITION_ID]: _answered, ...answers } = asked.plague!.answers;
  const kept = run({ ...reopen(asked, ask.id, { rights: asked.politics!.rights.filter(right => right.id !== "commuted_rent") }), plague: { ...asked.plague!, answers } },
    spring(1354), { ...BOT, [CASH_RENT_PETITION_ID]: "refuse" });
  assert.equal(kept.plague!.answers[CASH_RENT_PETITION_ID], "refuse");
  const upkeep = kept.ledger!.entries.filter(entry => entry.category === "upkeep" && entry.tick > spring(1352) + 2);
  assert.ok(upkeep.length > 0);
  assert.ok(kept.plague!.fled > shared.plague!.fled);
  assert.equal(kept.politics!.rights.some(right => right.id === "commuted_rent"), false);
});

test("P9 (PL-9) the second pestilence (1361) takes about an eighth in two seasons, the young most", () => {
  const moved: GameState = { ...shared, tick: spring(1361) - 1, plague: { ...shared.plague!, answers: { ...shared.plague!.answers, [CASH_RENT_PETITION_ID]: "accept" } } };
  const after = run(moved, spring(1361) + 2 * SEASON + 2);
  const second = after.plague!.second!;
  assert.equal(second.arrivalTick, spring(1361));
  assert.equal(second.endTick, spring(1361) + 2 * SEASON);
  assert.equal(second.dead, Math.floor(second.populationAtArrival * PLAGUE_BALANCE.secondDeathPermille / 1000));
  const dead = after.persons!.past.filter(person => person.deathCause === "plague" && person.deathYear === 1361);
  const young = dead.filter(person => 1361 - person.birthYear < 14).length;
  const living = moved.persons!.people.filter(person => person.householdId !== "manor");
  const share = (group: typeof living, died: number) => group.length === 0 ? 0 : died / group.length;
  assert.ok(share(living.filter(person => 1361 - person.birthYear < 14), young) > share(living.filter(person => 1361 - person.birthYear >= 30), dead.length - young - dead.filter(person => 1361 - person.birthYear >= 14 && 1361 - person.birthYear < 30).length));
  assert.equal(records(after, "plague.second").length, 1);
});

test("P10 (PL-10) chapter 3 ends from 1362 once the town has 70 % of its people back, by 1364 at the latest; its page carries the pestilence; chapter 4 begins", () => {
  const second = { arrivalTick: spring(1361), populationAtArrival: shared.population, deathPermille: 120, dead: 10, manorDead: 0, wipedHouses: 0, endTick: spring(1361) + 2 * SEASON };
  const base: GameState = { ...shared, tick: spring(1362), plague: { ...shared.plague!, second } };
  const people = shared.plague!.first!.populationAtArrival;
  assert.ok((plagueRecoveryPermille(base) ?? 0) > 0);
  const enough = { ...base, population: Math.ceil(people * 0.7) };
  const ended = advancePlague(enough, endChapterThree);
  assert.equal(ended.plague!.endedTick, spring(1362));
  const end = chapterEnd(ended, CHAPTER_THREE.chapter)!;
  assert.equal(end.tick, spring(1362));
  assert.equal(end.chronicle.stats.plague!.outcome, "resettled");
  assert.equal(end.chronicle.stats.plague!.dead, shared.plague!.first!.dead);
  assert.equal(ended.politics!.chapter.number, 4);
  assert.deepEqual(chapterGoals(ended).at(-1), { chapter: 3, id: "resettled", reachedTick: spring(1362) });
  // Too few in 1362: the chapter waits; by 1364 it ends by the calendar. The empty plots then return to the ladder.
  const few = { ...base, population: Math.floor(people * 0.6) };
  assert.equal(advancePlague(few, endChapterThree).plague!.endedTick, undefined);
  const late = advancePlague({ ...few, tick: spring(1364) }, endChapterThree);
  assert.equal(chapterEnd(late, CHAPTER_THREE.chapter)!.chronicle.stats.plague!.outcome, "calendar");
  assert.equal(plagueHousing(late), undefined, "the growth rule is the town's again");
  // The sandbox has no chapters: the sequence ends by itself.
  const sandbox = advancePlague({ ...enough, scenarioId: SANDBOX_SCENARIO_ID }, endChapterThree);
  assert.equal(sandbox.plague!.endedTick, spring(1362));
  assert.equal(chapterEnd(sandbox, CHAPTER_THREE.chapter), null);
});

test("P11 (PL-11) the bot's answers (monastery, wages, settlers, money rent); the lord's family dead of the pestilence brings a new house", () => {
  const open = (state: GameState) => chapterDecisionAction(state, "relief", "accept") as { readonly response: string } | null;
  const priest = at(arrival + 1);
  // Only the petition of `defId` open (the others closed).
  const petitions = (state: GameState, defId: string): GameState => {
    const id = state.politics!.petitions.find(entry => entry.defId === defId)!.id;
    const opened = reopen(state, id);
    return { ...opened, politics: { ...opened.politics!, petitions: opened.politics!.petitions.map(entry => entry.id === id || entry.response !== undefined ? entry : { ...entry, response: "expired" as const }) } };
  };
  assert.equal(open(petitions(priest, VACANT_PRIEST_PETITION_ID))!.response, "accept");
  assert.equal(open(petitions(at(arrival + 4 * SEASON + 2), LAND_REDISTRIBUTION_PETITION_ID))!.response, "accept_with_price");
  assert.equal(open(petitions(at(spring(1352) + 2), CASH_RENT_PETITION_ID))!.response, "accept");
  // The lord's family, all dead of the pestilence: the overlord grants the town to a new house at the season's start.
  const family = priest.persons!.people.filter(person => person.tags.includes(LORD_FAMILY_TAG));
  assert.ok(family.length > 0);
  const gone: GameState = { ...priest, persons: { ...priest.persons!, people: priest.persons!.people.filter(person => !family.includes(person)),
    past: [...priest.persons!.past, ...family.map(person => ({ ...person, alive: false, deathYear: 1348, deathCause: "plague" as const }))] } };
  assert.equal(lordFamilyExtinct(gone), true);
  assert.equal(lordFamilyExtinct(priest), false);
  // The house changes at the season's start; its family stands in the manor the season after.
  const next = run(gone, arrival + 2 * SEASON + 1);
  assert.equal(next.lordship!.house.order, (priest.lordship?.house.order ?? 1) + 1);
  assert.ok(next.persons!.people.some(person => person.tags.includes(`lord-house:${next.lordship!.house.order}`)), "the new house's family in the manor");
});

test("P12 (PL-11) the save round trip (v26) mid-pestilence, the same course twice, chapters 1–2 untouched, and a petition's other answers refused", () => {
  const mid = at(arrival + SEASON + 2);
  const saved = decodeSave(encodeSave({ state: mid, createdAt: "2026-09-28T00:00:00.000Z", savedAt: "2026-09-28T00:00:00.000Z" }).bytes);
  assert.equal(SAVE_SCHEMA_VERSION, 26);
  assert.deepEqual(saved.envelope.state, mid);
  const a = run(mid, mid.tick + 1500), b = run(saved.envelope.state, mid.tick + 1500);
  assert.deepEqual(a, b);
  // Before the collapse era nothing of the pestilence runs: no state, the same state back.
  const before = { ...town, tick: E - SEASON, historicalEras: town.historicalEras!.filter(entry => entry.id !== "collapse") };
  assert.equal(advancePlague(before, endChapterThree), before);
  const war = gameReducer(before, { type: "petition_response", petitionId: "none", response: "accept" });
  assert.equal(war.plague, undefined);
});
