/**
 * DEC-CARD (result side): "after choosing, I know what changed" — the actual's chip when the ledger writes a big decision's
 * actual, the year's card ("올해 당신의 결정이 바꾼 것") and (lord mode, Astra A3) the house card before the petitions. Each
 * read from the engine's own ledger: the lord slice seed 1 played from 1300 with one decision (the estate's policy) and
 * its lord made 20, so the engine's own yearly check begins his wardship at the 1301 turn — the tick the year's first home
 * petition comes.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import type { GameState } from "../src/engine/engine.types";
import type { HistoryRecord } from "../src/engine/history.types";
import { lordshipOf } from "../src/engine/lordshipState";
import { manorLord, personById, personDisplayName } from "../src/engine/persons";
import { advanceTick } from "../src/engine/tick";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";
import { decisionModal, storyBeats } from "../src/ui/eventStory";
import { yearTurned } from "../src/ui/hud/useStoryPresentation";
import { recordSentence } from "../src/ui/legacy/chapterRecords";
import { lordBeats } from "../src/ui/lordStoryBeats";
import { metricsLine } from "../src/ui/results/actualNews";
import { houseChangeView, houseChanges } from "../src/ui/results/houseChange";
import { HouseChangeCard, YearReviewCard } from "../src/ui/results/ResultCards";
import { RESULTS_COPY } from "../src/ui/results/resultsCopy.ko";
import { lastYearReview, yearReview } from "../src/ui/results/yearReview";

const snapshots = new Map<number, GameState>();
/** The run: persons first, the lord made 20 (a ward at the next turn), the estate's policy set, played to 1301's first ticks. */
const town: GameState = (() => {
  let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 1 })!;
  while (state.persons === undefined) state = advanceTick(state);
  const lord = manorLord(state.persons!.people, lordshipOf(state).house.order, 1300)!;
  state = { ...state, persons: { ...state.persons!, people: state.persons!.people.map(person => person.id === lord.id ? { ...person, birthYear: 1281 } : person) } };
  state = gameReducer(state, { type: "set_estate_policy", policy: "revenue" });
  while (state.tick < 4_001) {
    state = advanceTick(state);
    if ([1_000, 2_001, 3_001].includes(state.tick)) snapshots.set(state.tick, state);
  }
  return state;
})();
const policy = town.history!.records.find(record => record.template === "decision.estate_policy")!;
const markup = (element: ReturnType<typeof createElement>) => renderToStaticMarkup(element);

test("DEC-CARD results: the actual's chip says what was expected and what came — the decision record's own numbers, for one season, in every mode", () => {
  const due = policy.decision!.actualDueTick!;
  assert.equal(due, 2_001);
  const before = snapshots.get(1_000)!;
  assert.equal(storyBeats(before).some(beat => beat.kind === "decision_actual"), false, "no actual before it is written");
  const written = snapshots.get(2_001)!;
  const record = written.history!.records.find(entry => entry.id === policy.id)!;
  const beat = storyBeats(written).find(entry => entry.id === `actual:${policy.id}`)!;
  assert.ok(beat !== undefined, "the chip comes when fillActuals writes the actual");
  assert.equal(beat.kind, "decision_actual");
  assert.equal(beat.decision, null);
  assert.ok(beat.line.startsWith("1300년 봄의 영지 방침"), beat.line);
  assert.ok(beat.line.includes(`예상 ${metricsLine(record.decision!.predicted)}`) && beat.line.includes(`실제 ${metricsLine(record.decision!.actual!)}`), beat.line);
  assert.equal(beat.facts.length, Object.keys(record.decision!.predicted).length);
  assert.equal(beat.illustration, null, "the estate's policy has no story picture of its own");
  const { agency: _agency, ...sandbox } = written;
  assert.ok(storyBeats(sandbox as GameState).some(entry => entry.id === `actual:${policy.id}`), "not lord mode only");
  assert.equal(storyBeats(snapshots.get(3_001)!).some(entry => entry.id === `actual:${policy.id}`), false, "a season later it is no news");
});

test("DEC-CARD results: the year's card lists the year's decisions with their actuals (or when it is written), the projects they moved, and the town", () => {
  const review = yearReview(town, 1300);
  assert.equal(review.title, RESULTS_COPY.year.title(1300));
  assert.deepEqual(lastYearReview(town), review, "at 1301's first tick the card is 1300's");
  const decision = review.decisions.find(entry => entry.id === policy.id)!;
  assert.ok(decision.line.includes(recordSentence(town, policy)), decision.line);
  const record = town.history!.records.find(entry => entry.id === policy.id)!;
  assert.equal(decision.outcome, RESULTS_COPY.year.outcome(metricsLine(record.decision!.predicted), metricsLine(record.decision!.actual!)));
  // Before the actual: the date it will be written.
  assert.equal(yearReview(snapshots.get(1_000)!, 1300).decisions[0]!.outcome, "실제는 1300년 가을에 적힙니다");
  // The receipts that name the decision among their reasons (TA-6).
  const moved = town.history!.records.filter(entry => entry.template === "agency.project_started" && String(entry.params?.decisions).split(",").includes(policy.id));
  assert.equal(review.receipts.length, moved.length === 0 ? 0 : 1);
  assert.equal(review.town.length, 2, "the year's people and money (the season ledgers)");
  assert.equal(review.empty, null);
  const html = markup(createElement(YearReviewCard, { view: review, onContinue: () => undefined, onChronicle: () => undefined }));
  assert.equal(html.match(/ui-btn--primary/g)?.length, 1, "one primary: [계속]");
  assert.ok(html.includes(RESULTS_COPY.year.continue) && html.includes(RESULTS_COPY.year.chronicle));
  assert.match(html, /story-modal-later[^"]*results-card-continue/);
  assert.doesNotMatch(html, /\stitle="/);
});

test("DEC-CARD results: a quiet year still shows what changed in the town, and a year with nothing says so in one line", () => {
  const quiet: GameState = { ...town, history: { ...town.history!, records: town.history!.records.filter(record => record.kind !== "decision" && record.template !== "faction.relation") } };
  const review = yearReview(quiet, 1300);
  assert.deepEqual(review.decisions, []);
  assert.equal(review.empty, null);
  assert.equal(review.town.length, 2);
  assert.ok(markup(createElement(YearReviewCard, { view: review, onContinue: () => undefined, onChronicle: () => undefined })).includes(RESULTS_COPY.year.noDecision));
  const nothing = yearReview(quiet, 1299);
  assert.equal(nothing.empty, RESULTS_COPY.year.nothing);
  assert.deepEqual([nothing.decisions, nothing.answers, nothing.relations, nothing.receipts, nothing.town], [[], [], [], [], []]);
});

test("DEC-CARD results: the year's card is due at the next year's first tick the hook sees — not on a load, not twice", () => {
  assert.equal(yearTurned(null, 1301, 4_001), null, "the first sight is the baseline");
  assert.equal(yearTurned({ year: 1300, tick: 3_975 }, 1301, 4_000), 1300);
  assert.equal(yearTurned({ year: 1300, tick: 3_000 }, 1301, 4_600), 1300, "a jump of seasons over the turn still counts");
  assert.equal(yearTurned({ year: 1301, tick: 4_000 }, 1301, 4_025), null);
  assert.equal(yearTurned({ year: 1305, tick: 20_000 }, 1301, 4_001), null, "a load of an earlier town");
  assert.equal(yearTurned({ year: 1300, tick: 10 }, 1313, 52_030), null, "a load of a later town");
});

test("DEC-CARD results (A3): the wardship begun is one house card, before the year's first home petition of the same tick — its Wave 40 moment is the card's picture, not a chip", () => {
  const changes = houseChanges(town);
  assert.equal(changes.length, 1);
  const change = changes[0]!;
  assert.equal(change.kind, "wardship_begun");
  assert.equal(change.tick, 4_000);
  const beats = storyBeats(town);
  const house = beats.findIndex(beat => beat.id === `house:${change.id}`);
  const petition = beats.findIndex(beat => beat.kind === "home_petition");
  // DEC-TRACE (GP7-ENGINE): no winter home petition is forced on the lord any more (FX14-1 gone) and the steward answers
  // them by the standing policy — a petition's card, when one comes, is after the house's. (렌더 파일을 엔진이 예외로 갱신 — 렌더가 인계)
  assert.ok(house === 0 && (petition === -1 || petition > house), `house ${house}, petition ${petition}`);
  assert.equal(decisionModal(beats[house]!.decision!), "house_change");
  assert.equal(beats[house]!.openLabel, RESULTS_COPY.house.openLabel);
  assert.equal(beats.some(beat => beat.id === `lord-moment:${change.records[0]!.id}`), false, "no second chip for the same event");
  assert.equal(lordBeats(town).some(beat => beat.kind === "lord_moment" && beat.illustration === "moment_child_lord_guardian"), false);
  const view = houseChangeView(town)!;
  const guardian = personById(town, lordshipOf(town).wardship!.guardianId!)!;
  const lord = manorLord(town.persons!.people, lordshipOf(town).house.order, 1301)!;
  assert.equal(view.illustration, "moment_child_lord_guardian");
  assert.ok(view.heir.includes(personDisplayName(lord)) && view.heir.includes(personDisplayName(guardian)), view.heir);
  assert.deepEqual(view.rights, [RESULTS_COPY.house.noRights]);
  assert.deepEqual(view.next, { kind: "person", personId: lord.id, label: RESULTS_COPY.house.toPerson(personDisplayName(lord)) });
  const html = markup(createElement(HouseChangeCard, { view, onContinue: () => undefined, onNext: () => undefined }));
  assert.equal(html.match(/ui-btn--primary/g)?.length, 1, "one primary: the next act");
  for (const part of [RESULTS_COPY.house.happened, RESULTS_COPY.house.heir, RESULTS_COPY.house.rights, RESULTS_COPY.house.next]) assert.ok(html.includes(part), part);
  assert.doesNotMatch(html, /\stitle="/);
  const { agency: _agency, ...sandbox } = town;
  assert.deepEqual(houseChanges(sandbox as GameState), [], "lord mode only");
});

/** A ledger line appended as the engine would write it (the model reads only the ledger and the persons). */
type Line = Pick<HistoryRecord, "kind" | "template"> & Partial<HistoryRecord>;
const appended = (state: GameState, records: readonly Line[]): GameState => ({
  ...state, history: { ...state.history!, records: [...state.history!.records, ...records.map((record, index) => ({ id: `h-test-${index}`, tick: state.tick, severity: 2 as const,
    subject: { type: "town" as const, id: "town" }, ...record }) as HistoryRecord)] },
});

test("DEC-CARD results (A3, DEC-CARD-2): the lord's death is the engine's succession — its own sentence, and the heir it names leads the house now", () => {
  const lord = manorLord(town.persons!.people, lordshipOf(town).house.order, 1301)!;
  const heir = town.persons!.people.find(person => person.id !== lord.id && person.alive)!;
  const dead = { ...lord, alive: false, deathYear: 1301 };
  const after = appended({ ...town, persons: { ...town.persons!, people: town.persons!.people.filter(person => person.id !== lord.id), past: [...town.persons!.past, dead] } },
    [{ kind: "person", template: "house.succession", subject: { type: "person", id: heir.id }, actors: [{ type: "person", id: lord.id }],
      params: { deceasedId: lord.id, deadAge: 20, died: 1, cause: "age", heirId: heir.id, heirAge: 1301 - heir.birthYear, kin: "kin" } }]);
  const view = houseChangeView(after)!;
  assert.equal(view.kind, "lord_died");
  assert.equal(view.title, RESULTS_COPY.house.titles.lord_died);
  const record = after.history!.records.at(-1)!;
  assert.deepEqual(view.happened, [recordSentence(after, record)]);
  assert.ok(view.happened[0]!.includes(personDisplayName(lord)) && view.happened[0]!.includes(personDisplayName(heir)), view.happened[0]);
  assert.equal(view.heirId, heir.id);
  assert.ok(view.heir.startsWith(RESULTS_COPY.house.lordNow(personDisplayName(heir), 1301 - heir.birthYear)), view.heir);
  const seated = appended(town, [{ ...record, params: { ...record.params!, died: 0 } }]);
  assert.equal(houseChangeView(seated)!.kind, "heir_seated", "a succession without a death seats the heir");
});

test("DEC-CARD results (A3): an inheritance shows the estate that changed hands (the ledger's own lines) and opens the estates screen on it", () => {
  const after = appended(town, [
    { kind: "event", template: "estate.title_changed", params: { estate: "estate-neighbour-3", piece: "", from: "estate:estate-neighbour-3", to: "lord" } },
    { kind: "event", template: "marriage.inherited", params: { estate: "estate-neighbour-3", rival: "" } },
  ]);
  const view = houseChangeView(after)!;
  assert.equal(view.kind, "inherited");
  assert.equal(view.illustration, "moment_inheritance_fealty");
  assert.equal(view.rights.length, 1);
  assert.ok(view.rights[0]!.includes("권원"), view.rights[0]);
  assert.deepEqual(view.next, { kind: "screen", screen: "estates", focus: "estate-neighbour-3", label: RESULTS_COPY.house.toEstate });
});

test("DEC-CARD results: the cards' text is 12 px or more", () => {
  const css = readFileSync("src/styles/results.css", "utf8");
  const sizes = [...css.matchAll(/font-size:\s*(\d+)px/g)].map(match => Number(match[1]));
  assert.ok(sizes.length > 0 && sizes.every(size => size >= 12), sizes.join(","));
});
