/**
 * DEC-CARD-2 (the result thread): "○○년 당신의 결정 때문에" — the season's news chips, the chronicle's thread and the
 * lord's year card on the engine's `yearReview`, all read from the engine's thread (DEC-TRACE §2–§3) and its sentences.
 * The lord slice seed 3 as the lord bot plays it (its first tick: a suit filed and the market dues set; the steward
 * answers the home petitions by the customary policy), to 1301's first tick.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { decisionRemembers, traceInRange } from "../src/engine/decisionReads";
import type { GameState } from "../src/engine/engine.types";
import { historySummary } from "../src/engine/history";
import type { HistoryRecord } from "../src/engine/history.types";
import { lordBotCommands } from "../src/engine/lordBot";
import { markStorySeen } from "../src/engine/storySeen";
import { advanceTick } from "../src/engine/tick";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";
import { CHRONICLE_SCREEN_COPY } from "../src/ui/chronicle/chronicleScreenCopy.ko";
import { decisionCompare, recordCard } from "../src/ui/chronicle/chronicleScreenModel";
import { DecisionThread } from "../src/ui/chronicle/DecisionThread";
import { decisionThread } from "../src/ui/chronicle/decisionThreadModel";
import { DECISION_CARD_COPY } from "../src/ui/decisionCard/decisionCardCopy.ko";
import { storyBeats } from "../src/ui/eventStory";
import { yearCardDue, yearCardId } from "../src/ui/hud/useStoryPresentation";
import { recordSentence } from "../src/ui/legacy/chapterRecords";
import { traceNews } from "../src/ui/results/decisionThread";
import { lordYearReview, yearCard } from "../src/ui/results/lordYearReview";
import { YearReviewCard } from "../src/ui/results/ResultCards";
import { RESULTS_COPY } from "../src/ui/results/resultsCopy.ko";

const snapshots = new Map<number, GameState>();
const town: GameState = (() => {
  let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 3 })!;
  while (state.tick < 4_001) {
    for (const { command } of lordBotCommands(state)) state = gameReducer(state, command);
    state = advanceTick(state);
    if ([999, 1_999].includes(state.tick)) snapshots.set(state.tick, state);
  }
  return state;
})();
const records = (state: GameState) => state.history!.records;
const byTemplate = (state: GameState, template: string, decisionKind?: string) =>
  records(state).find(record => record.template === template && (decisionKind === undefined || record.params?.decisionKind === decisionKind))!;
const markup = (element: ReturnType<typeof createElement>) => renderToStaticMarkup(element);
const { agency: _agency, ...sandboxOf } = town;
const sandbox = sandboxOf as GameState;

test("DEC-CARD-2 news: one chip per decision whose consequences landed this season — the year it was made, the engine's sentence for what followed, the factions' moves in the card's words", () => {
  const season = snapshots.get(999)!;
  const dues = byTemplate(season, "decision.market_dues");
  const suit = byTemplate(season, "decision.card", "lawsuit");
  const news = traceNews(season);
  assert.deepEqual(news.map(entry => entry.decisionId).sort(), [dues.id, suit.id].sort(), "the season's two decisions with consequences");
  const duesNews = news.find(entry => entry.decisionId === dues.id)!;
  assert.equal(duesNews.title, RESULTS_COPY.trace.title(1300, "lord"));
  assert.equal(duesNews.title, "1300년 당신의 결정 때문에");
  const rows = traceInRange(season, 0, season.tick + 1).filter(row => row.decisionId === dues.id);
  // Each consequence is its record's own sentence (a share among other causes said so); the relation rows are feelings.
  for (const row of rows.filter(entry => entry.key !== "relation")) {
    const record = records(season).find(entry => entry.id === row.recordId)!;
    const sentence = historySummary(record, season);
    assert.ok(duesNews.facts.includes(row.part ? RESULTS_COPY.trace.part(sentence) : sentence), `${sentence} in ${duesNews.facts.join(" | ")}`);
  }
  for (const row of rows.filter(entry => entry.key === "relation")) {
    assert.ok(duesNews.facts.some(fact => fact.endsWith(DECISION_CARD_COPY.feels(row.delta!))), `${row.actor} ${row.delta}`);
  }
  const beat = storyBeats(season).find(entry => entry.id === `trace:${dues.id}:0`)!;
  assert.equal(beat.kind, "decision_trace");
  assert.equal(beat.decision, null, "no choice in it: no primary");
  assert.deepEqual({ recordId: beat.chronicle!.recordId, tick: beat.chronicle!.tick }, { recordId: dues.id, tick: dues.tick }, "it opens the decision in the chronicle");
  assert.equal(traceNews(sandbox).length, 0, "lord mode only (the thread is lord mode's)");
});

test("DEC-CARD-2 news: the steward's answers that only moved minds are his season report's, not a chip; the decisions' chips come before the season's other chips", () => {
  const second = snapshots.get(1_999)!;
  const steward = traceInRange(second, 1_000, 2_000).filter(row => records(second).find(record => record.id === row.decisionId)?.template === "decision.steward");
  assert.ok(steward.length > 0 && steward.every(row => row.key === "relation"), "the steward's customary answer moved the factions at once");
  assert.equal(traceNews(second).some(entry => steward.some(row => row.decisionId === entry.decisionId)), false);
  const beats = storyBeats(snapshots.get(999)!);
  const first = beats.findIndex(entry => entry.kind === "decision_trace");
  assert.ok(beats.slice(0, first).every(entry => entry.kind === "house_change"), "only the house's chips before them");
});

test("DEC-CARD-2 chronicle: a record that followed from a decision says so and links to it; the decision lists what followed and who remembers it", () => {
  const suit = byTemplate(town, "decision.card", "lawsuit");
  const turned = records(town).find(record => record.template === "consequence" && record.because?.[0]?.decisionId === suit.id)!;
  const card = recordCard(town, { key: turned.id, tick: turned.tick, record: turned, bundle: null });
  assert.equal(card.sentence, `1300년 당신의 결정 때문에 — ${recordSentence(town, turned)}`);
  const project = records(town).find(record => record.because?.[0]?.part === true)!;
  assert.ok(recordCard(town, { key: project.id, tick: project.tick, record: project, bundle: null }).sentence.startsWith("1300년 당신의 결정도 한몫해 — "), "a share among other causes");
  const because = decisionThread(town, turned)!;
  assert.equal(because.followed, null);
  assert.equal(because.because.length, 1);
  assert.equal(because.because[0]!.recordId, suit.id);
  assert.ok(because.because[0]!.line.startsWith(RESULTS_COPY.trace.because(1300, "lord", false)), because.because[0]!.line);
  const thread = decisionThread(town, suit)!;
  const later = records(town).filter(record => record.because?.some(entry => entry.decisionId === suit.id));
  assert.equal(thread.followed!.length, later.length, "every record that followed it");
  assert.deepEqual(thread.followed!.map(link => link.recordId), later.map(record => record.id));
  const remembered = decisionRemembers(town, suit.id);
  assert.equal(thread.remembers.length, new Set(remembered.map(entry => entry.actor)).size);
  assert.ok(thread.remembers.every(line => line.includes("(관계 ")), thread.remembers.join(" | "));
  const html = markup(createElement(DecisionThread, { view: thread, onOpen: () => undefined }));
  for (const heading of [CHRONICLE_SCREEN_COPY.followedHeading, CHRONICLE_SCREEN_COPY.remembersHeading]) assert.ok(html.includes(heading), heading);
  assert.equal(html.match(/<button[^>]*chronicle-thread-link/g)?.length, thread.followed!.length);
  assert.doesNotMatch(html, /ui-btn--primary|\stitle="/);
  assert.equal(decisionThread(sandbox, suit), null, "lord mode only");
});

test("DEC-CARD-2 chronicle: the card's, the steward's and a lapse's decisions are named (DECISION_KIND_NAMES), with who answered", () => {
  const suit = byTemplate(town, "decision.card", "lawsuit");
  assert.ok(decisionCompare(town, suit)!.heading.endsWith("· 소송"), decisionCompare(town, suit)!.heading);
  const steward = byTemplate(town, "decision.steward");
  const view = decisionCompare(town, steward)!;
  assert.ok(view.heading.endsWith("· 장원 청원 · 청지기의 처리"), view.heading);
  assert.ok(["들어줌", "물리침"].includes(view.chosen), view.chosen);
});

test("DEC-CARD-2 year card (lord mode): the engine's yearReview — the lord's decisions and the steward's, what followed grouped by decision, the town; one primary", () => {
  const view = yearCard(town);
  assert.equal(view.lord, true);
  assert.deepEqual(view, lordYearReview(town, 1300));
  const dues = byTemplate(town, "decision.market_dues");
  const suit = byTemplate(town, "decision.card", "lawsuit");
  assert.deepEqual(view.decisions.map(entry => entry.id).filter(id => [dues.id, suit.id].includes(id)).sort(), [dues.id, suit.id].sort());
  const stewardIds = records(town).filter(record => record.template === "decision.steward" && record.tick < 4_000).map(record => record.id);
  assert.deepEqual(view.steward.map(entry => entry.id), stewardIds.slice(0, view.steward.length));
  const suitGroup = view.threads.find(group => group.key === suit.id)!;
  assert.ok(suitGroup.heading.startsWith("1300년 당신의 결정 때문에 — "), suitGroup.heading);
  assert.ok(view.threads.some(group => group.key === "steward-minds" && group.heading === RESULTS_COPY.year.stewardMinds), "the steward's answers' moves as one group");
  assert.equal(view.town.length, 2, "the year's people and money");
  assert.equal(view.empty, null);
  const html = markup(createElement(YearReviewCard, { view, onContinue: () => undefined, onChronicle: () => undefined }));
  assert.equal(html.match(/ui-btn--primary/g)?.length, 1, "one primary: [계속]");
  for (const part of [RESULTS_COPY.year.lordDecisions, RESULTS_COPY.year.stewardDecisions, RESULTS_COPY.year.threads, RESULTS_COPY.year.town]) assert.ok(html.includes(part), part);
  assert.match(html, /data-year-source="engine"/);
  assert.doesNotMatch(html, /\stitle="/);
  assert.equal(yearCard(sandbox).lord, false, "the sandbox and the campaign keep v1");
});

test("DEC-CARD-2 year card: due on a live turn, or after a load in the new year's first season in a game the screen marked — and never once opened (the engine's seen mark)", () => {
  const live = yearCardDue({ year: 1300, tick: 3_999 }, town);
  assert.equal(live, 1300);
  const opened = markStorySeen(town, yearCardId(1300), "opened");
  assert.equal(yearCardDue({ year: 1300, tick: 3_999 }, opened), null, "opened once: not again");
  assert.equal(yearCardDue(null, opened), null, "nor after a load");
  assert.equal(yearCardDue(null, town), null, "a state no screen marked (the bot's, a harness's) opens nothing by itself");
  const played = markStorySeen(town, "house:h-000001", "opened");
  assert.equal(yearCardDue(null, played), 1300, "an unseen card after a load of a played game");
  assert.equal(yearCardDue({ year: 1301, tick: 4_000 }, played), null, "no turn and no load");
  const later: GameState = { ...played, tick: 5_000 };
  assert.equal(yearCardDue(null, later), null, "only in the new year's first season");
});

/** A ledger line appended as the engine would write it. */
const appended = (state: GameState, record: Pick<HistoryRecord, "kind" | "template"> & Partial<HistoryRecord>): GameState => ({
  ...state, history: { ...state.history!, records: [...state.history!.records, { id: "h-test-1", tick: state.tick, severity: 3, subject: { type: "town", id: "town" }, ...record } as HistoryRecord] },
});

test("DEC-CARD-2 year card: the house's succession comes first, in the engine's sentence", () => {
  const lord = town.persons!.people.find(person => person.alive)!;
  const after = appended(town, { kind: "person", template: "house.succession", tick: 3_000, subject: { type: "person", id: lord.id },
    params: { deceasedId: lord.id, deadAge: 50, died: 1, cause: "age", heirId: lord.id, heirAge: 20, kin: "son" } });
  const view = lordYearReview(after, 1300);
  assert.equal(view.house.length, 1);
  assert.ok(view.house[0]!.endsWith(historySummary(after.history!.records.at(-1)!, after)), view.house[0]);
  const html = markup(createElement(YearReviewCard, { view, onContinue: () => undefined, onChronicle: () => undefined }));
  assert.ok(html.indexOf(RESULTS_COPY.year.house) < html.indexOf(RESULTS_COPY.year.lordDecisions), "the house first");
});
