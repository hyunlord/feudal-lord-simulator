/**
 * UI-10 chapter 5 screens: the eight steps' and the interlude's story beats (their Wave 21 / Wave 33 pictures, the
 * names quoted from the ledger), the petitions' chips, the season strip and the steward, the chapter-5 chronicle page
 * and record art, the chapter-5 goal line and the manor left empty. The town is the chapter-4 town run into chapter 5
 * (`tests/helpers/legacyTown.ts`); between the steps only the calendar moves (`movedTo`), the answers are the game
 * command.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { PetitionResponse } from "../src/content/chapterConfig";
import { HISTORY_TEMPLATES } from "../src/content/historyCopy.ko";
import {
  BOROUGH_AUTONOMY_PETITION_ID,
  HEIR_CHOICE_PETITION_ID,
  LEGACY_CHOICE_PETITION_ID,
  LEGACY_INTERLUDE_IDS,
  LEGACY_STEP_IDS,
  ROYAL_TAX_PETITION_ID,
} from "../src/content/legacyConfig";
import type { GameState } from "../src/engine/engine.types";
import type { HistoryRecord } from "../src/engine/history.types";
import { legacyForecast, legacyInterludes } from "../src/engine/legacy";
import { openPetitions } from "../src/engine/politics";
import type { ChronicleEntry } from "../src/engine/politics.types";
import { advanceTick } from "../src/engine/tick";
import { petitionGathering } from "../src/render/storyWorldProps";
import { gameReducer } from "../src/state/gameStore";
import { CHRONICLE_COPY } from "../src/ui/chronicleCopy.ko";
import { chronicleIllustration, chronicleView, legacyRecordArt } from "../src/ui/chronicleModel";
import { recordArt } from "../src/ui/chronicle/chronicleScreenModel";
import { forecastStewardLine, storyBeats, type StoryBeat } from "../src/ui/eventStory";
import { inspectorModel } from "../src/ui/inspectorModel";
import { legacyGoalProgress } from "../src/ui/legacyGoalProgress";
import { legacyMarks } from "../src/ui/seasonStrip";
import { SEASON_STRIP_COPY } from "../src/ui/seasonStripCopy.ko";
import { WAVE21_IMAGES } from "../src/ui/wave21ArtManifest.generated";
import { WAVE33_IMAGES } from "../src/ui/wave33ArtManifest.generated";
import { legacyTown, movedTo } from "./helpers/legacyTown";

const SEASON = 1000;
type Answers = Partial<Record<string, PetitionResponse>>;
const STANDARD: Answers = { [ROYAL_TAX_PETITION_ID]: "accept", [HEIR_CHOICE_PETITION_ID]: "refuse", [BOROUGH_AUTONOMY_PETITION_ID]: "accept",
  [LEGACY_CHOICE_PETITION_ID]: "accept", guild_dispute: "accept", church_rebuilding: "accept" };

let base: GameState | null = null;
const town = () => (base ??= legacyTown());

/** What the screens showed along the way: every beat seen (with each petition's chip before its answer). */
type Seen = { readonly beats: StoryBeat[]; readonly steward: string[] };

/**
 * Runs chapter 5 step by step (the calendar moved to each step's or interlude event's tick), a tick at a time from there; each open petition
 * is looked at (its chip) before it is answered. Stops once `until` has come and its beat has had a tick to show.
 */
function through(state: GameState, answers: Answers, until: (typeof LEGACY_STEP_IDS)[number], seen: Seen): GameState {
  let next = state;
  const look = () => { seen.beats.push(...storyBeats(next)); const line = forecastStewardLine(next); if (line !== null) seen.steward.push(line.text); };
  for (let guard = 0; guard < 60 && next.legacy?.steps[until] === undefined; guard += 1) {
    const step = legacyForecast(next).find(entry => entry.state !== "done");
    if (step === undefined) break;
    const stepTick = step.tick !== null && step.tick > next.tick ? step.tick : (Math.floor(next.tick / SEASON) + 1) * SEASON;
    // The interlude's events on their own dates (not all at once on the next step's).
    const target = Math.min(stepTick, ...legacyInterludes(next).filter(entry => entry.state === "ahead" && entry.tick > next.tick).map(entry => entry.tick));
    // A season before the step: the steward's line (a step comes within a season).
    if (target - SEASON > next.tick + 1) { next = movedTo(next, target - SEASON + 1); next = advanceTick(next); look(); }
    if (target > next.tick + 1) next = movedTo(next, target);
    while (next.tick < target + 1) {
      next = advanceTick(next);
      look();
      for (const petition of openPetitions(next)) {
        const response = answers[petition.defId];
        if (response !== undefined) next = gameReducer(next, { type: "petition_response", petitionId: petition.id, response });
      }
      look();
    }
  }
  next = advanceTick(next);
  look();
  return next;
}

let standard: { readonly state: GameState; readonly seen: Seen } | null = null;
const standardRun = () => {
  if (standard !== null) return standard;
  const seen: Seen = { beats: [], steward: [] };
  return (standard = { state: through(town(), STANDARD, "last_market", seen), seen });
};

test("UI-10: the eight steps each show a beat with its Wave 21 chapter-5 picture; the names are the ledger's", () => {
  const { state, seen } = standardRun();
  const kinds = new Set(seen.beats.map(beat => beat.kind));
  for (const kind of ["legacy_mayor_demand", "legacy_royal_tax", "legacy_succession", "legacy_city_seal", "legacy_charter", "legacy_departure", "legacy_record", "legacy_last_market"]) {
    assert.ok(kinds.has(kind as StoryBeat["kind"]), `${kind} beat (seen: ${[...kinds].join(", ")})`);
  }
  const beat = (kind: string) => seen.beats.find(entry => entry.kind === kind)!;
  assert.equal(beat("legacy_mayor_demand").illustration, "ch5_event_mayor_demand");
  assert.equal(beat("legacy_city_seal").illustration, "ch5_event_city_seal_making");
  assert.equal(beat("legacy_last_market").illustration, "ch5_event_last_market");
  for (const entry of seen.beats.filter(item => item.kind.startsWith("legacy_"))) assert.ok(entry.illustration in WAVE21_IMAGES && entry.illustration.startsWith("ch5_"), `${entry.kind}: ${entry.illustration}`);
  // The names: the merchants' candidate, the old lord and his heir, the first mayor — as the ledger wrote them.
  const params = (template: string) => state.history!.records.find(record => record.template === template)?.params ?? {};
  const candidate = String(params("legacy.mayor_demand").candidate ?? "");
  if (candidate !== "") assert.ok(beat("legacy_mayor_demand").facts.some(fact => fact.includes(candidate)), candidate);
  const heir = String(params("legacy.heir_seated").heir ?? "");
  assert.ok(heir !== "" && seen.beats.some(entry => entry.kind === "legacy_succession" && entry.facts.some(fact => fact.includes(heir))), `heir ${heir}`);
  const mayor = String(params("legacy.charter_sealed").mayor ?? "");
  if (mayor !== "") assert.ok(seen.beats.some(entry => entry.kind === "legacy_charter" && entry.facts.some(fact => fact.includes(mayor))), `mayor ${mayor}`);
  // The charter sealed: the family leaves (its own painting), the last market names the ending.
  assert.equal(state.legacy!.family, "departed");
  assert.equal(beat("legacy_departure").illustration, "ch5_event_family_departure");
  assert.ok(beat("legacy_departure").title.includes("떠나"));
  assert.ok(seen.beats.some(entry => entry.kind === "legacy_last_market" && entry.facts.some(fact => fact.startsWith("결말"))));
});

test("UI-10: chapter 5's petitions open as chips with their event pictures; the Crown's tax is not the war's", () => {
  const { seen } = standardRun();
  const chips = seen.beats.filter(beat => beat.kind === "petition" && beat.decision === "petition");
  const art = new Map(chips.map(chip => [chip.illustration, chip]));
  for (const id of ["ch5_event_royal_tax_envoy", "ch5_event_succession", "ch5_event_charter_sealing", "ch5_event_legacy_record"]) assert.ok(art.has(id as StoryBeat["illustration"]), id);
  assert.ok(art.get("ch5_event_royal_tax_envoy")!.advice.includes("침묵"), "the Crown's tax chip speaks of the lord's silence");
  // While a petition waits its step's own beat does not show beside the chip (the same tick).
  assert.ok(!seen.beats.some(beat => beat.kind === "legacy_royal_tax" && beat.facts.length === 0), "the envoy's beat after the answer only");
});

test("UI-10: the interlude's events show with their Wave 33 paintings; the two petitions' chips too", () => {
  const { state, seen } = standardRun();
  const came = legacyInterludes(state).filter(entry => entry.state === "done").map(entry => entry.id);
  assert.ok(came.length >= 4, `interlude events came: ${came.join(", ")}`);
  for (const id of came) {
    const beat = seen.beats.find(entry => entry.kind === `interlude_${id}`);
    assert.ok(beat !== undefined, `${id} beat`);
    assert.equal(beat.illustration, `interlude_${id}`);
    assert.ok(beat.illustration in WAVE33_IMAGES);
  }
  const chips = seen.beats.filter(beat => beat.kind === "petition").map(beat => beat.illustration);
  assert.ok(chips.includes("interlude_church_rebuilding"), "the nave's petition chip");
  assert.ok(chips.includes("interlude_guild_dispute") || came.includes("market_fire"), "the guild's quarrel chip (or the market's fire instead)");
  assert.ok(seen.beats.some(beat => beat.kind === "interlude_church_rebuilding" && beat.facts.length === 1), "the nave's answer as a fact");
});

test("UI-10: a refused charter — the family stays (the manor hall, not the departure picture)", () => {
  const seen: Seen = { beats: [], steward: [] };
  const state = through(town(), { ...STANDARD, [BOROUGH_AUTONOMY_PETITION_ID]: "refuse" }, "family_departure", seen);
  assert.equal(state.legacy!.family, "stayed");
  const beat = seen.beats.find(entry => entry.kind === "legacy_departure")!;
  assert.ok(beat.title.includes("남"), beat.title);
  assert.equal(beat.illustration, "ch5_event_succession");
  const charter = seen.beats.find(entry => entry.kind === "legacy_charter")!;
  assert.equal(charter.illustration, "ch5_decision_autonomy");
  assert.ok(charter.facts.some(fact => fact.includes("반발")));
  assert.equal(petitionGathering({ ...state, politics: { ...state.politics!, petitions: [{ id: "x@1", defId: "legacy_choice", petitioner: "townsfolk", arrivedTick: state.tick }] } })?.kind === "market", false,
    "a family that stays: the petitioners do not move to the market");
});

test("UI-10: the season strip and the steward show chapter 5's coming steps and the interlude's events", () => {
  const start = town();
  const marks = legacyMarks(legacyForecast(start), legacyInterludes(start), start.tick);
  assert.ok(marks.some(mark => mark.id === "mayor_demand" && !mark.interlude), JSON.stringify(marks));
  for (const id of LEGACY_STEP_IDS) assert.ok(SEASON_STRIP_COPY.legacy[id].length > 0, id);
  for (const id of LEGACY_INTERLUDE_IDS) assert.ok(SEASON_STRIP_COPY.interlude[id].length > 0, id);
  // A step waiting on an answer (no tick yet) is not on the strip.
  assert.ok(!marks.some(mark => mark.id === "city_seal"));
  // The interlude on the strip within the year before it.
  const interlude = legacyInterludes(start)[0]!;
  assert.ok(legacyMarks([], legacyInterludes(start), interlude.tick - 3 * SEASON).some(mark => mark.interlude && mark.id === interlude.id));
  const { seen } = standardRun();
  assert.ok(seen.steward.some(line => line.includes(SEASON_STRIP_COPY.legacy.royal_tax_envoy)), seen.steward.join(" | "));
});

test("UI-10: the chapter-5 goal line counts the eight steps and the years to 1450", () => {
  const start = legacyGoalProgress(town());
  assert.equal(start.steps, 0);
  assert.equal(start.total, 8);
  assert.ok(start.years > 0 && start.line.includes("0/8") && start.line.includes(`${start.years}년`), start.line);
  const end = legacyGoalProgress(standardRun().state);
  assert.equal(end.steps, 8);
  assert.equal(end.years, 0);
});

test("UI-10: the chapter-5 chronicle page — its legacy lines, the ch5_ending page, each legacy record's picture", () => {
  const { state } = standardRun();
  const view = chronicleView(state);
  assert.equal(view?.chapter, 5);
  const joined = view!.stats.join("\n");
  for (const word of ["자치와 유산 시작", "후계자 조카", "국왕 과세 납부", "자치 특허 인장을 찍음", "영주관을 떠나", "남긴 유산 길드홀과 시청", "결말", "유산 점수"]) assert.ok(joined.includes(word), `${word} in\n${joined}`);
  assert.equal(chronicleIllustration({ template: "milestone.chapter_end", params: { chapter: 5 } }), "ch5_ending");
  const legacyRecords = state.history!.records.filter(record => record.template.startsWith("legacy."));
  assert.ok(legacyRecords.length >= 8);
  for (const record of legacyRecords) {
    const art = recordArt(state, record);
    assert.ok(art !== null && (art.kind === "wave21" || art.kind === "wave33"), `${record.template}: ${JSON.stringify(art)}`);
    if (art.kind === "wave21") assert.ok(art.id.startsWith("ch5_"), `${record.template}: ${art.id}`);
  }
  const scenes = new Set(legacyRecords.map(record => legacyRecordArt(record)));
  for (const id of ["ch5_chronicle_heir", "ch5_chronicle_city_seal", "ch5_chronicle_charter_sealing", "ch5_chronicle_legacy_sealing", "ch5_chronicle_last_market"]) assert.ok(scenes.has(id as never), id);
  const sealed = state.history!.records.find(record => record.template === "decision.petition_response" && record.params?.defId === "borough_autonomy");
  assert.ok(sealed !== undefined && legacyRecordArt(sealed) === "ch5_chronicle_mayor_election");
});

test("UI-10: every legacy.* ledger line has a picture; a family that stays shows its arms in the chronicle", () => {
  const record = (template: string, params: Record<string, string | number> = {}) => ({ template, params } as unknown as HistoryRecord);
  for (const template of Object.keys(HISTORY_TEMPLATES).filter(key => key.startsWith("legacy."))) {
    const id = legacyRecordArt(record(template, { defId: "royal_tax" }));
    assert.ok(id !== null && (id in WAVE21_IMAGES || id in WAVE33_IMAGES), `${template}: ${id}`);
  }
  assert.equal(legacyRecordArt(record("legacy.unanswered", { defId: "church_rebuilding" })), "interlude_church_rebuilding");
  const stayed = { ...record("legacy.family_stayed", { house: "x" }), kind: "event", tick: 0, subject: { type: "actor", id: "town" } } as unknown as HistoryRecord;
  assert.equal(recordArt(town(), stayed)?.kind, "emblem");
});

test("UI-10: the empty manor — the petitioners gather at the market, the keep's inspector says the family left", () => {
  const { state } = standardRun();
  const market = state.buildings.find(building => building.kind === "market")!;
  const waiting = { ...state, politics: { ...state.politics!, petitions: [...state.politics!.petitions, { id: "x@1", defId: "legacy_choice", petitioner: "townsfolk" as const, arrivedTick: state.tick }] } };
  assert.equal(petitionGathering(waiting)?.id, market.id);
  // The town has no keep; one stood where the market is (a copy of its record, nothing else changed).
  const keep = { ...market, id: "keep-test", kind: "keep" as const };
  const withKeep = { ...state, buildings: [...state.buildings.filter(building => building.id !== market.id), keep] };
  const model = inspectorModel(withKeep, keep.id);
  assert.ok(model !== null);
  const year = Math.floor(state.legacy!.steps.family_departure! / 4000) + 1300;
  assert.ok(model.why[0]!.text.includes(`${year}년`) && model.why[0]!.text.includes("시골 장원"), model.why[0]!.text);
  const before = town();
  assert.equal(inspectorModel({ ...before, buildings: [...before.buildings.filter(building => building.kind !== "market"), { ...before.buildings.find(building => building.kind === "market")!, id: "keep-test", kind: "keep" as const }] }, "keep-test")
    ?.why.some(line => line.text.includes("시골 장원")), false);
});

test("UI-10: CHRONICLE_COPY.stats — no legacy lines without chapter 5", () => {
  const stats: ChronicleEntry["stats"] = { populationStart: 1, populationEnd: 1, peakPopulation: 1, houses: 1, burntHouses: 0, departures: 0, harvestLost: 0, treasury: 0, famine: null };
  assert.ok(!CHRONICLE_COPY.stats(stats, 5).join("\n").includes("유산"));
});
