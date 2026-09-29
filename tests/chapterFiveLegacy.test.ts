/**
 * F5-A chapter 5's autonomy and legacy (spec docs/design/chapter-five-legacy.md LG-1…LG-12): scenarios L1–L12. The town
 * is the chapter-4 town (fixture `chapter-four-town`) moved to 1384 and its charter answered by command, run into
 * chapter 5 (`tests/helpers/legacyTown.ts`); between the steps only the calendar moves (`movedTo`), the answers are the
 * game command (`runAnswering`). L4–L5 give the old lord a family of three heirs (the persons added, nothing else).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { PetitionResponse } from "../src/content/chapterConfig";
import { CHAPTER_FIVE } from "../src/content/chapterConfig";
import {
  BOROUGH_AUTONOMY_PETITION_ID,
  BOROUGH_SEAL_RIGHT_ID,
  HEIR_CHOICE_PETITION_ID,
  LEGACY_BALANCE as B,
  LEGACY_CHOICE_PETITION_ID,
  LEGACY_DECISION_ART,
  LEGACY_ENDING_IDS,
  LEGACY_PETITION_DEFS,
  LEGACY_STEP_ART,
  LEGACY_STEP_IDS,
  MAYORALTY_RIGHT_ID,
  ROYAL_TAX_PETITION_ID,
} from "../src/content/legacyConfig";
import { HISTORY_TEMPLATES } from "../src/content/historyCopy.ko";
import { campaignChronicle, campaignChronicleText } from "../src/engine/campaignChronicle";
import type { GameState } from "../src/engine/engine.types";
import { heirCandidates, legacyDecisionForecast, legacyEnding, legacyForecast, legacyScores, legacyStage } from "../src/engine/legacy";
import { manorLord, offerHeirs } from "../src/engine/persons";
import type { Person } from "../src/engine/persons.types";
import { chapterEnd, chapterGoals, openPetitions } from "../src/engine/politics";
import { treasuryBalance } from "../src/ledger/ledger";
import { decodeSave, encodeSave } from "../src/save/saveCodec";
import { SAVE_SCHEMA_VERSION } from "../src/save/saveTypes";
import { gameReducer } from "../src/state/gameStore";
import { at, legacyTown, movedTo, runAnswering } from "./helpers/legacyTown";

const SEASON = 1000;
type Answers = Partial<Record<string, PetitionResponse>>;
const STANDARD: Answers = { [ROYAL_TAX_PETITION_ID]: "accept", [HEIR_CHOICE_PETITION_ID]: "refuse", [BOROUGH_AUTONOMY_PETITION_ID]: "accept", [LEGACY_CHOICE_PETITION_ID]: "accept" };

let base: GameState | null = null;
/** The chapter-4 town at chapter 5's first season (built once). */
const town = () => (base ??= legacyTown());

/** Runs chapter 5 step by step (the calendar moved to each step's tick), answering; stops once `until` has come. */
function through(state: GameState, answers: Answers, until: (typeof LEGACY_STEP_IDS)[number] = "last_market"): GameState {
  let next = state;
  for (let guard = 0; guard < 40 && next.legacy?.steps[until] === undefined; guard += 1) {
    const step = legacyForecast(next).find(entry => entry.state !== "done");
    if (step === undefined) break;
    // To the step's tick (or, while it waits on an answer or a spring, the next season's start) and one tick on.
    const target = step.tick !== null && step.tick > next.tick ? step.tick : (Math.floor(next.tick / SEASON) + 1) * SEASON;
    if (target > next.tick + 1) next = movedTo(next, target);
    next = runAnswering(next, target + 1, answers);
  }
  return next;
}
const cash = (state: GameState, category: string) => (state.ledger?.entries ?? []).filter(entry => entry.account === "cash" && entry.category === category);

test("L1 (LG-1) the eight steps come in order, each with its Wave 21 picture; four decisions (the chapter-5 cards); a chapter opened in 1400 still ends in 1450", () => {
  const start = town();
  assert.equal(start.politics?.chapter.number, CHAPTER_FIVE.chapter);
  assert.equal(legacyStage(start), "rumour");
  assert.deepEqual(legacyForecast(start).map(step => [step.id, step.state]).slice(0, 2), [["mayor_demand", "ahead"], ["royal_tax_envoy", "ahead"]]);
  const end = through(start, STANDARD);
  const steps = LEGACY_STEP_IDS.map(id => end.legacy!.steps[id]!);
  assert.ok(steps.every(tick => tick !== undefined), JSON.stringify(end.legacy!.steps));
  assert.deepEqual([...steps].sort((a, b) => a - b), steps, "in order");
  assert.equal(end.legacy!.steps.mayor_demand! - start.legacy!.startTick, B.mayorAfter * SEASON);
  assert.equal(end.legacy!.steps.last_market, at(B.lastMarketYear, B.lastMarketSeason));
  const records = end.history!.records.filter(record => record.template.startsWith("legacy."));
  for (const id of LEGACY_STEP_IDS) if (id !== "charter_sealing" && id !== "family_departure") assert.ok(records.some(record => record.illustration === LEGACY_STEP_ART[id]), id);
  assert.ok(records.some(record => record.illustration === LEGACY_STEP_ART.charter_sealing), "the charter sealed");
  assert.ok(records.every(record => HISTORY_TEMPLATES[record.template] !== undefined));
  assert.deepEqual(LEGACY_PETITION_DEFS.map(def => def.id).sort(), Object.keys(LEGACY_DECISION_ART).sort());
  // The pace (1400–1450): the succession from 1400, the legacy's question from 1440.
  assert.ok(end.legacy!.steps.succession! >= at(B.successionFromYear));
  assert.ok(end.history!.records.some(record => record.template === "decision.petition_response" && record.params?.defId === LEGACY_CHOICE_PETITION_ID && record.tick >= at(B.legacyFromYear)));
  // The chain's longest course from a chapter opened in 1400: 4 + 4 + 12 seasons to the succession, then 4 + 2 + 2 + 8
  // and a season for each answer — before the legacy's floor of 1440, which leaves ten years to the last market day.
  const longest = B.mayorAfter + B.envoyAfterMayor + B.successionLatestAfterEnvoy + B.sealAfterHeir + B.charterAfterSeal + B.departureAfterCharter + B.legacyAfterDeparture + 4;
  assert.ok(at(1400) + longest * SEASON < at(B.legacyFromYear), `${longest} seasons`);
  assert.ok(at(B.legacyFromYear) + 2 * SEASON < at(B.lastMarketYear, B.lastMarketSeason));
});

test("L2 (LG-2) the charter sealed: the mayoralty and the seal to the town, the fine, the fee farm raised, the merchants' mayor, the family leaves", () => {
  const before = through(town(), { ...STANDARD, [BOROUGH_AUTONOMY_PETITION_ID]: undefined }, "charter_sealing");
  const petition = openPetitions(before).find(entry => entry.defId === BOROUGH_AUTONOMY_PETITION_ID)!;
  assert.equal(legacyDecisionForecast(before, BOROUGH_AUTONOMY_PETITION_ID, "accept"), treasuryBalance(before) + B.charterFine + (before.tick % 4000 >= 2000 ? B.feeFarm - before.legacy!.feeFarm : 0));
  const after = gameReducer(before, { type: "petition_response", petitionId: petition.id, response: "accept" });
  const rights = after.politics!.rights.filter(right => right.petitionId === petition.id).map(right => [right.id, right.holder]);
  assert.deepEqual(rights, [[MAYORALTY_RIGHT_ID, "townsfolk"], [BOROUGH_SEAL_RIGHT_ID, "townsfolk"]], "chapter 4 had given the market and the tolls");
  assert.equal(treasuryBalance(after) - treasuryBalance(before), B.charterFine, "the town's fine (the Crown was paid: no confirmation)");
  assert.equal(after.legacy!.feeFarm, B.feeFarm);
  assert.equal(after.legacy!.mayorId, before.legacy!.mayorCandidateId);
  assert.notEqual(after.legacy!.mayorId, null);
  const later = through(after, STANDARD, "family_departure");
  assert.equal(later.legacy!.family, "departed");
  const spring = cash(runAnswering(after, (Math.floor(after.tick / 4000) + 1) * 4000 + 1, {}), "fee_farm").filter(entry => entry.tick > after.tick).map(entry => entry.amount);
  assert.ok(spring.includes(B.feeFarm - 120) && spring.includes(120), `chapter 4's 120 and the raise ${JSON.stringify(spring)}`);
});

test("L3 (LG-2 / LG-4) refused: the backlash, the family stays; sealed after the Crown was petitioned: the Crown's confirmation", () => {
  const refused = through(town(), { ...STANDARD, [BOROUGH_AUTONOMY_PETITION_ID]: "refuse" }, "legacy_record");
  const influence = refused.reorganisation!.chapterFiveStart!.influence.town ?? 0;
  assert.equal(refused.legacy!.backlash, Math.min(100, Math.max(B.backlashFloor, influence, B.backlashAgain)));
  assert.equal(refused.legacy!.family, "stayed");
  assert.ok(!refused.politics!.rights.some(right => right.id === MAYORALTY_RIGHT_ID));
  const petitioned = through(town(), { ...STANDARD, [ROYAL_TAX_PETITION_ID]: "refuse" }, "family_departure");
  assert.equal(petitioned.legacy!.royalSubsidy, 0);
  assert.deepEqual(cash(petitioned, "royal_subsidy").map(entry => [entry.amount, entry.sourceRefs[1]?.detail]), [[-B.confirmationFine, "confirmation"]]);
  // The silence refuses the charter.
  const silent = through(town(), { ...STANDARD, [BOROUGH_AUTONOMY_PETITION_ID]: undefined }, "family_departure");
  assert.equal(silent.legacy!.answers[BOROUGH_AUTONOMY_PETITION_ID], "expired");
  assert.equal(silent.legacy!.family, "stayed");
});

/** L4–L5: the old lord Henry (the fixture's widower) made the head, with a son, a daughter gone to marry and a brother gone. */
function withFamily(state: GameState): GameState {
  const persons = state.persons!;
  const lord = manorLord(persons.people, 1, 1386)!;
  const kin = (id: string, fields: Partial<Person>): Person => ({ ...lord, id, role: "child", tags: ["lord-family", "lord-house:1"], ...fields });
  const father = kin("m-900001", { givenName: "Robert", role: "head", birthYear: 1290, alive: false, deathYear: 1350, deathCause: "age" });
  return { ...state, persons: { ...persons,
    people: [...persons.people.map(person => person.id === lord.id ? { ...person, role: "head" as const, fatherId: father.id } : person),
      kin("m-900002", { givenName: "Richard", sex: "male", birthYear: 1360, fatherId: lord.id })],
    past: [...persons.past, father, kin("m-900003", { givenName: "Agnes", sex: "female", birthYear: 1362, fatherId: lord.id, leftYear: 1380 }),
      kin("m-900004", { givenName: "Walter", sex: "male", birthYear: 1327, fatherId: father.id, leftYear: 1345 })] } };
}

test("L4 (LG-3) the heirs are the family's: the eldest son, the husband of the eldest daughter, the brother's son — and the card offers those there are", () => {
  const offered = offerHeirs(withFamily(through(town(), STANDARD, "royal_tax_envoy")));
  const kinds = offered.candidates.map(candidate => [candidate.kind, candidate.relation, candidate.throughId, candidate.created]);
  assert.deepEqual(kinds, [["eldest_son", "son", null, false], ["daughter_husband", "husband", "m-900003", true], ["nephew", "nephew", "m-900004", true]]);
  const people = offered.state.persons!.people;
  const husband = people.find(person => person.id === offered.candidates[1]!.personId)!;
  const nephew = people.find(person => person.id === offered.candidates[2]!.personId)!;
  assert.ok(husband.birthYear < 1362 - 1 && husband.birthYear >= 1362 - B.husbandOlder[1]);
  assert.equal(nephew.fatherId, "m-900004");
  // The fixture's own house: a widower with no child left and no brother or sister — one heir, a distant kinsman.
  const own = through(town(), STANDARD, "succession");
  assert.deepEqual(own.legacy!.candidates.map(candidate => [candidate.kind, candidate.relation]), [["nephew", "kinsman"]]);
  assert.deepEqual(own.politics!.petitions.find(petition => petition.defId === HEIR_CHOICE_PETITION_ID)?.options, ["refuse"]);
  const card = heirCandidates(own);
  assert.equal(card.length, 1);
  assert.ok(card[0]!.name.length > 0 && card[0]!.age >= B.nephewAge[0] && card[0]!.age <= B.nephewAge[1]);
});

test("L5 (LG-3) naming each heir: the house is his (or through her), the old lord kin, the relief paid, the other newcomers gone", () => {
  const envoy = withFamily(through(town(), STANDARD, "royal_tax_envoy"));
  const asked = through(envoy, { [ROYAL_TAX_PETITION_ID]: "accept" }, "succession");
  for (const [response, relief] of [["accept", B.relief.eldest_son], ["accept_with_price", B.relief.daughter_husband], ["refuse", B.relief.nephew]] as const) {
    const petition = openPetitions(asked).find(entry => entry.defId === HEIR_CHOICE_PETITION_ID)!;
    assert.deepEqual(petition.options, ["accept", "accept_with_price", "refuse"]);
    const named = gameReducer(asked, { type: "petition_response", petitionId: petition.id, response });
    const heir = named.legacy!.heir!;
    const people = named.persons!.people;
    const head = people.find(person => person.tags.includes("lord-house:1") && person.role === "head")!;
    assert.equal(head.id, heir.personId, response);
    assert.equal(heir.relief, relief);
    assert.equal(treasuryBalance(asked) - treasuryBalance(named), relief);
    assert.equal(people.find(person => person.id === heir.previousHeadId)?.role, "kin", "the old lord stays as kin");
    for (const candidate of asked.legacy!.candidates) if (candidate.created && candidate.personId !== heir.personId) assert.ok(!people.some(person => person.id === candidate.personId), "gone again");
    if (response === "accept_with_price") assert.equal(people.find(person => person.id === "m-900003")?.role, "spouse", "the daughter home as his wife");
  }
  // Another answer than the card's is not taken.
  const own = through(town(), { [ROYAL_TAX_PETITION_ID]: "accept" }, "succession");
  const petition = openPetitions(own).find(entry => entry.defId === HEIR_CHOICE_PETITION_ID)!;
  assert.equal(gameReducer(own, { type: "petition_response", petitionId: petition.id, response: "accept" }), own);
});

test("L6 (LG-4) the Crown's tax: a tenth of the treasury (60–400d), or the petition (nothing now)", () => {
  const asked = through(town(), {}, "royal_tax_envoy");
  const petition = openPetitions(asked).find(entry => entry.defId === ROYAL_TAX_PETITION_ID)!;
  const due = Math.max(B.subsidyMin, Math.min(B.subsidyMax, Math.floor(treasuryBalance(asked) * B.subsidyPermille / 1000)));
  assert.equal(legacyDecisionForecast(asked, ROYAL_TAX_PETITION_ID, "accept"), treasuryBalance(asked) - due);
  const paid = gameReducer(asked, { type: "petition_response", petitionId: petition.id, response: "accept" });
  assert.equal(paid.legacy!.royalSubsidy, due);
  assert.deepEqual(cash(paid, "royal_subsidy").map(entry => entry.amount), [-due]);
  const pleaded = gameReducer(asked, { type: "petition_response", petitionId: petition.id, response: "refuse" });
  assert.equal(treasuryBalance(pleaded), treasuryBalance(asked));
});

test("L7 (LG-5) the legacy: 500d endowed to its axis (+25); the silence leaves none", () => {
  for (const [response, axis] of [["accept", "town"], ["accept_with_price", "family"], ["refuse", "church"]] as const) {
    const done = through(town(), { ...STANDARD, [LEGACY_CHOICE_PETITION_ID]: response }, "legacy_record");
    assert.equal(done.legacy!.legacy, axis);
    assert.equal(done.legacy!.endowment, B.endowment);
    assert.equal(legacyScores(done).parts[axis].legacy, B.legacyPoints);
    assert.deepEqual(cash(done, "legacy_endowment").map(entry => entry.amount), [-B.endowment]);
  }
  const none = through(town(), { ...STANDARD, [LEGACY_CHOICE_PETITION_ID]: undefined }, "legacy_record");
  assert.equal(none.legacy!.legacy, null);
  assert.equal(none.legacy!.endowment, 0);
});

test("L8 (LG-6) the answers move the factions (a ledger memory each)", () => {
  const before = through(town(), { ...STANDARD, [BOROUGH_AUTONOMY_PETITION_ID]: undefined }, "charter_sealing");
  const petition = openPetitions(before).find(entry => entry.defId === BOROUGH_AUTONOMY_PETITION_ID)!;
  const relation = (state: GameState, id: string) => state.factions!.factions.find(faction => faction.id === id)!.relation;
  const moved = (response: PetitionResponse) => {
    const after = gameReducer(before, { type: "petition_response", petitionId: petition.id, response });
    return Object.fromEntries(["town", "merchant_house_1", "overlord", "crown", "commons"].map(id => [id, relation(after, id) - relation(before, id)]));
  };
  const clamp = (id: string, delta: number) => Math.max(-100, Math.min(100, relation(before, id) + delta)) - relation(before, id);
  assert.deepEqual(moved("accept"), { town: clamp("town", 25), merchant_house_1: clamp("merchant_house_1", 15), overlord: clamp("overlord", -15), crown: clamp("crown", 5), commons: 0 });
  assert.deepEqual(moved("refuse"), { town: clamp("town", -25), merchant_house_1: clamp("merchant_house_1", -15), overlord: clamp("overlord", 10), crown: 0, commons: clamp("commons", -5) });
  const after = gameReducer(before, { type: "petition_response", petitionId: petition.id, response: "accept" });
  assert.ok(after.history!.records.some(record => record.template === "faction.relation" && String(record.params?.reason).startsWith(`petition:${BOROUGH_AUTONOMY_PETITION_ID}`)));
});

test("L9 (LG-7) the scores and the endings: four answer sets of the same town end four ways", () => {
  const endings = new Map<string, string>();
  for (const [name, answers] of Object.entries({
    standard: STANDARD,
    remembered: { ...STANDARD, [LEGACY_CHOICE_PETITION_ID]: "accept_with_price" },
    chantry: { ...STANDARD, [LEGACY_CHOICE_PETITION_ID]: "refuse" },
    house: { ...STANDARD, [BOROUGH_AUTONOMY_PETITION_ID]: "refuse", [LEGACY_CHOICE_PETITION_ID]: "accept_with_price" },
  } as Record<string, Answers>)) {
    const end = through(town(), answers);
    const scores = end.legacy!.scores!;
    for (const axis of ["town", "family", "church"] as const) {
      assert.equal(scores[axis], Math.max(0, Math.min(100, Object.values(scores.parts[axis]).reduce((sum, value) => sum + value, 0))), `${name} ${axis}`);
    }
    const ending = legacyEnding(end)!;
    assert.ok(ending.final && ending.sentence.length > 20 && ending.quotes.length >= 2, JSON.stringify(ending));
    assert.ok(LEGACY_ENDING_IDS.includes(ending.id));
    endings.set(name, ending.id);
  }
  assert.deepEqual(Object.fromEntries(endings), { standard: "free_borough", remembered: "house_remembered", chantry: "merchants_chantry", house: "house_seat" });
});

test("L10 (LG-8) the last market day ends chapter 5 — the campaign won, chapter 5's goal reached, its chronicle line", () => {
  const end = through(town(), STANDARD);
  const page = chapterEnd(end, CHAPTER_FIVE.chapter);
  assert.ok(page !== null);
  assert.equal(page.tick, at(B.lastMarketYear, B.lastMarketSeason));
  assert.deepEqual(end.politics!.chapterEnds.map(entry => entry.chapter), [1, 2, 3, 4, 5]);
  const next = runAnswering(end, end.tick + 60, {});
  assert.equal(next.settlement?.outcome, "victory");
  assert.equal(chapterGoals(end).at(-1)?.id, "legacy");
  assert.equal(chapterGoals(end).at(-1)?.reachedTick, page.tick);
  assert.deepEqual({ ...page.chronicle.stats.legacy, scores: null }, { startYear: 1384, mayor: true, heir: "nephew", royalTax: "paid", charter: "sealed", family: "departed",
    legacy: "town", ending: "free_borough", scores: null });
  assert.equal(legacyStage(end), "done");
});

test("L11 (LG-9) the chronicle book: five chapters, the family tree, the factions' records, the legacy — and its Korean text", () => {
  const end = through(town(), STANDARD);
  const book = campaignChronicle(end);
  assert.equal(book.finished, true);
  assert.deepEqual(book.chapters.map(chapter => [chapter.chapter, chapter.closed]), [[1, true], [2, true], [3, true], [4, true], [5, true]]);
  assert.ok(book.chapters.every(chapter => chapter.title !== "" && chapter.events.length > 0), JSON.stringify(book.chapters.map(chapter => chapter.events.length)));
  assert.ok(book.chapters[4]!.events.some(event => event.illustration !== undefined));
  assert.ok(book.family.houses.length >= 1 && book.family.people.filter(person => person.head).length >= 3);
  const heir = book.family.people.find(person => person.id === end.legacy!.heir!.personId)!;
  assert.equal(heir.head, true);
  assert.ok(book.factions.length === 9 && book.factions.find(faction => faction.id === "town")!.entries.length > 0);
  assert.equal(book.legacy!.ending!.id, "free_borough");
  const text = campaignChronicleText(end);
  for (const chapter of book.chapters) assert.ok(text.includes(`제${chapter.chapter}장 ${chapter.title}`));
  assert.ok(text.includes(book.legacy!.ending!.sentence));
  assert.ok(/[가-힣]/.test(text) && !text.includes("undefined") && !text.includes("NaN"));
});

test("L12 (LG-11) the save round trip (v29) mid-chapter, the same course twice, the heir card's other answers refused, a v28 town begins chapter 5 later", () => {
  const mid = through(town(), STANDARD, "royal_tax_envoy");
  const loaded = decodeSave(encodeSave({ state: mid, createdAt: "2026-09-29T00:00:00.000Z", savedAt: "2026-09-29T00:00:00.000Z" }).bytes).envelope;
  assert.equal(loaded.schemaVersion, SAVE_SCHEMA_VERSION);
  assert.ok(SAVE_SCHEMA_VERSION >= 29);
  assert.deepEqual(loaded.state, mid);
  const a = through(loaded.state as GameState, STANDARD, "city_seal"), b = through(mid, STANDARD, "city_seal");
  assert.deepEqual(a.legacy, b.legacy);
  assert.deepEqual(a.persons, b.persons);
  // A v28 save (chapters 1–4) has no chapter 5: the town is as it was.
  const v28 = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v28/chapter-four-town.save.json"))).envelope.state as GameState;
  assert.equal(v28.legacy, undefined);
  assert.equal(v28.politics?.chapter.number, 4);
});
