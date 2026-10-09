/**
 * LM-R3 phase 2a: the lord slice's opening page and its end ("이 도시가 내 결정의 결과인가") — both from the engine's reads
 * (`lordSliceStart`, `lordSliceOutcome`, `traceInRange`, `decisionRemembers`, `yearReview`). The lord slice seed 3 as the
 * lord bot plays it (its first tick files a suit and sets the market dues) to 1301's first tick; the end is that history
 * with the clock moved to the slice's end tick (a 20-year bot run is the DGX's: scripts/sliceEndsStates.ts). TRACE-KEEP
 * (DTR-24): the same history with the twentieth year's turn of the thread (`advanceTrace` at the end tick drops the small
 * decisions older than ten years and keeps the big), so 1300 reads as the twentieth year's end page reads it.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { GENTRY_NAMES_KO } from "../src/content/gentryNames";
import { LORD_SLICE_FACTIONS, LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { traceInRange, yearReview } from "../src/engine/decisionReads";
import { advanceTrace, isBigDecision, traceOf } from "../src/engine/decisionTrace";
import type { GameState } from "../src/engine/engine.types";
import { lordBotCommands } from "../src/engine/lordBot";
import { lordSliceEndTick, lordSliceOutcome, lordSliceStart } from "../src/engine/lordSlice";
import { lordHouse } from "../src/engine/lordshipState";
import { markStorySeen } from "../src/engine/storySeen";
import { advanceTick } from "../src/engine/tick";
import { decodeSave, encodeSave } from "../src/save/saveCodec";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";
import { yearOfTick } from "../src/ui/chronicle/chronicleScreenModel";
import { decisionBy, recordIndex } from "../src/ui/chronicle/historyIndex";
import { moneyFull } from "../src/ui/money.ko";
import { onlyMinds, traceGroups } from "../src/ui/results/decisionThread";
import { SliceEndPage, SliceStartPage } from "../src/ui/slice/SlicePages";
import { SLICE_COPY } from "../src/ui/slice/sliceCopy.ko";
import { requestSliceStart, SLICE_END_ID, SLICE_START_ID, sliceEndDue, sliceEndMarkIds, sliceEndOwnsTurn, sliceLastYear, slicePageDue, sliceStartDue,
  takeSliceStart } from "../src/ui/slice/sliceDue";
import { sliceEndView, sliceYearCard } from "../src/ui/slice/sliceEndModel";
import { yearCardDue, yearCardId } from "../src/ui/hud/useStoryPresentation";
import { lordYearReview } from "../src/ui/results/lordYearReview";
import { sliceStartView } from "../src/ui/slice/sliceStartModel";

const SEASON = 1_000;
const begun = advanceTick(newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 3, house: { name: "de Ravenholt", arms: "ravenholt-7" } })!);
const town: GameState = (() => {
  let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 3 })!;
  while (state.tick < 4_001) {
    for (const { command } of lordBotCommands(state)) state = gameReducer(state, command);
    state = advanceTick(state);
  }
  return state;
})();
const ended: GameState = { ...town, tick: lordSliceEndTick(town) };
const primaries = (markup: string) => markup.match(/ui-btn--primary/g)?.length ?? 0;
const roundTrip = (state: GameState): GameState =>
  decodeSave(encodeSave({ state, createdAt: "2026-10-09T00:00:00.000Z", savedAt: "2026-10-09T00:00:00.000Z" }).bytes).envelope.state as GameState;

test("slice start: the page shows the engine's start facts — the chosen house, the home estate, the town, three neighbours, the five factions, the years; one primary", () => {
  const view = sliceStartView(begun)!;
  const start = lordSliceStart(begun);
  const house = GENTRY_NAMES_KO[lordHouse(begun).name]!;
  assert.equal(lordHouse(begun).name, "de Ravenholt");
  assert.equal(view.house, SLICE_COPY.start.house(house));
  assert.equal(view.town, SLICE_COPY.start.townLine(start.town.population, start.town.houses, moneyFull(start.town.treasury)));
  assert.deepEqual(view.neighbours.map(entry => entry.id), start.neighbours.map(entry => entry.estateId));
  assert.ok(view.neighbours.some(entry => entry.notes.includes(SLICE_COPY.start.daughtersOnly)), "the old lord's house: daughters only");
  assert.deepEqual(view.factions.map(entry => entry.id), [...LORD_SLICE_FACTIONS]);
  assert.deepEqual(view.slice, [SLICE_COPY.start.years(start.end.years, start.startYear, 1320), SLICE_COPY.start.second(start.end.afterSecondEstateYears),
    SLICE_COPY.start.goal(start.goalYears.min, start.goalYears.max)]);
  const markup = renderToStaticMarkup(createElement(SliceStartPage, { view, onBegin: () => {} }));
  assert.equal(primaries(markup), 1);
  assert.match(markup, /data-slice="start"/);
  const { scenarioId: _scenario, ...rest } = begun;
  assert.equal(sliceStartView({ ...rest, scenarioId: "core:sandbox" } as GameState), null, "only the slice has the page");
});

test("slice start: due once, as a game the welcome started begins — from its first tick to its season's end, until marked; a load or a harness's state is no start", () => {
  const fresh = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 3 })!;
  assert.equal(sliceStartDue(begun, false), false, "no start asked: a loaded game opens no opening page");
  assert.equal(sliceStartDue(fresh, true), false, "tick 0: the estates still carry the opening's names");
  assert.equal(sliceStartDue(begun, true), true);
  assert.equal(sliceStartDue({ ...begun, tick: SEASON }, true), false, "past the first season");
  assert.equal(sliceStartDue(markStorySeen(begun, SLICE_START_ID, "opened"), true), false, "seen");
  requestSliceStart();
  assert.equal(slicePageDue(begun), "slice_start");
  takeSliceStart();
  assert.equal(slicePageDue(begun), null);
});

test("slice end: opens once on `ended` — not before, not after its season; marked, it survives a load as seen", () => {
  assert.equal(lordSliceOutcome(town)!.ended, false);
  assert.equal(sliceEndDue(town), false);
  assert.equal(lordSliceOutcome(ended)!.ended, true);
  assert.equal(sliceEndDue(ended), true);
  assert.equal(slicePageDue(ended), "slice_end");
  assert.equal(sliceEndDue({ ...ended, tick: ended.tick + SEASON }), false, "a season after the end");
  const loaded = roundTrip(markStorySeen(ended, SLICE_END_ID, "opened"));
  assert.equal(sliceEndDue(loaded), false, "the save keeps the mark");
  assert.equal(sliceEndDue(roundTrip(ended)), true, "unmarked, a load still finds it due");
});

test("slice end: the decisions ranked by what followed them in the engine's thread; who decided said as such; one primary and the chronicle's way", () => {
  const view = sliceEndView(ended)!;
  const index = recordIndex(ended);
  const counts = new Map<string, number>();
  for (const row of traceInRange(ended, 0, lordSliceEndTick(ended))) counts.set(row.decisionId, (counts.get(row.decisionId) ?? 0) + 1);
  const mindsOnly = new Set(traceGroups(ended, traceInRange(ended, 0, ended.tick)).filter(onlyMinds).map(group => group.decisionId));
  const expected = [...counts].filter(([id]) => index.has(id) && !mindsOnly.has(id))
    .sort((left, right) => right[1] - left[1] || index.get(left[0])!.tick - index.get(right[0])!.tick).slice(0, view.shaped.length);
  assert.ok(view.shaped.length > 0);
  assert.deepEqual(view.shaped.map(entry => entry.id), expected.map(([id]) => id));
  assert.deepEqual(view.shaped.map(entry => entry.followed), expected.map(([, count]) => SLICE_COPY.end.followed(count)));
  for (const entry of view.shaped) {
    const by = decisionBy(index.get(entry.id)!);
    assert.ok(entry.heading.includes(by === "lord" ? "당신의 결정 때문에" : by === "steward" ? "청지기의 처리 때문에" : "답하지 않은 일 때문에"), entry.heading);
  }
  assert.equal(view.why, SLICE_COPY.end.years(20, "1320년 봄"));
  assert.ok(view.remembers.length > 0, "the factions' memories of the decisions");
  assert.equal(view.years.length, 20);
  assert.equal(view.then.snapshot?.tick, 1, "the first map");
  const markup = renderToStaticMarkup(createElement(SliceEndPage, { state: ended, view, onContinue: () => {}, onChronicle: () => {}, onRecord: () => {},
    onYearCard: () => {}, onSeasonCard: () => {} }));
  assert.equal(primaries(markup), 1);
  assert.equal(markup.match(/slice-record/g)?.length, view.shaped.length, "each decision opens its record");
  assert.match(markup, /slice-chronicle/);
  assert.equal(sliceEndView(town), null, "not before the end");
});

test("slice end (the user's ruling): the page takes the live end's cards' place — the last year's card and the end season's card stay shut, are its links, and the year card is marked seen as it opens", () => {
  assert.equal(sliceLastYear(ended), 1319);
  assert.equal(sliceEndOwnsTurn(ended, 1319), true, "1319's card is the page's");
  assert.equal(sliceEndOwnsTurn(ended, 1318), false);
  assert.equal(sliceEndOwnsTurn(ended), true, "the season closing at the end: no card of its own");
  assert.equal(sliceEndOwnsTurn(town), false);
  assert.equal(sliceEndOwnsTurn(markStorySeen(ended, SLICE_END_ID, "opened")), false, "once opened, the turn's cards are the game's again");
  // The marks the page writes: its own and 1319's card — after them neither the page nor that card is due (a live turn or a load).
  assert.deepEqual(sliceEndMarkIds(ended, yearCardId), [SLICE_END_ID, yearCardId(1319)]);
  const marked = sliceEndMarkIds(ended, yearCardId).reduce((state, id) => markStorySeen(state, id, "opened"), ended);
  assert.equal(sliceEndDue(roundTrip(marked)), false);
  assert.equal(yearCardDue({ year: 1319, tick: ended.tick - 1 }, marked), null, "the year card never pops later");
  assert.equal(yearCardDue({ year: 1319, tick: ended.tick - 1 }, ended), 1319, "unmarked, the hook would have shown it");
  // At the top: the last year as its card shows it, and the two links.
  const view = sliceEndView(ended)!;
  const card = lordYearReview(ended, 1319);
  assert.equal(view.last.heading, SLICE_COPY.end.lastYear(1319));
  assert.deepEqual(view.last.house, card.house);
  assert.deepEqual(view.last.changed.map(group => group.heading), card.threads.slice(0, 3).map(group => group.heading));
  assert.deepEqual(sliceYearCard(ended), card);
  assert.equal(view.seasonCard, false, "the end's season is not the last one closed (this history stops in 1301)");
  const history = ended.seasons!.history;
  const closedAtEnd: GameState = { ...ended, seasons: { ...ended.seasons!, history: [...history.slice(0, -1), { ...history.at(-1)!, endTick: ended.tick }] } };
  assert.equal(sliceEndView(closedAtEnd)!.seasonCard, true);
  const markup = renderToStaticMarkup(createElement(SliceEndPage, { state: closedAtEnd, view: sliceEndView(closedAtEnd)!, onContinue: () => {}, onChronicle: () => {},
    onRecord: () => {}, onYearCard: () => {}, onSeasonCard: () => {} }));
  assert.ok(markup.indexOf("slice-last-year") < markup.indexOf("slice-why"), "the last year at the top");
  assert.match(markup, /slice-year-card/);
  assert.match(markup, /slice-season-card/);
  assert.equal(primaries(markup), 1, "the links are secondary");
});

test("slice end (TRACE-KEEP, DTR-24): in the twentieth year each year's big decisions come from the engine's thread with what followed; its small matters are one line by who handled them; zeros unsaid", () => {
  const endTick = lordSliceEndTick(town);
  const at20 = advanceTrace(town, { ...town, tick: endTick });
  const kept = new Map(traceOf(at20).decisions.map(decision => [decision.id, decision] as const));
  assert.ok(kept.size < traceOf(town).decisions.length, "the twentieth year's turn dropped 1300's small decisions from the thread");
  assert.ok(Object.values(yearReview(at20, 1300).summarised).some(count => count > 0), "the engine counts them instead");
  const view = sliceEndView(at20)!;
  const index = recordIndex(at20);
  const rows = traceInRange(at20, 0, endTick);
  for (const entry of view.years) {
    const review = yearReview(at20, entry.year);
    const big = review.decisions.filter(decision => isBigDecision(kept.get(decision.decisionId)!));
    assert.deepEqual(entry.big.map(decision => decision.id), big.map(decision => decision.decisionId), `${entry.year}: the thread's big decisions`);
    for (const decision of entry.big) {
      const followed = rows.filter(row => row.decisionId === decision.id).length;
      assert.equal(decision.followed, followed === 0 ? SLICE_COPY.end.noFollowed : SLICE_COPY.end.followed(followed));
      assert.equal(decision.lines.length > 0, followed > 0, "what followed, from the thread's rows");
    }
    // Nothing the engine does not give: the year's small are its traced small decisions and `summarised`, by who handled them.
    const small = { ...review.summarised };
    for (const decision of review.decisions) if (!big.includes(decision)) small[decisionBy(index.get(decision.decisionId)!)] += 1;
    const counted = small.lord + small.steward + small.lapsed;
    assert.equal(entry.small, counted === 0 ? null : SLICE_COPY.end.small(small.lord, small.steward, small.lapsed));
    const records = (at20.history?.records ?? []).filter(record => record.kind === "decision" && yearOfTick(at20, record.tick) === entry.year).length;
    assert.equal(big.length + counted, records, `${entry.year}: every decision record of the year, listed or counted`);
  }
  const first = view.years[0]!;
  assert.equal(first.year, 1300);
  assert.ok(first.big.length > 0 && first.big.every(decision => decision.lines.length > 0), "1300's big decision with what followed");
  assert.notEqual(first.small, null);
  assert.ok(view.years.some(entry => entry.small === null), "a year without small matters has no line");
  assert.equal(SLICE_COPY.end.small(0, 3, 0), "작은 일 3건은 청지기가 처리");
  assert.equal(SLICE_COPY.end.small(2, 0, 1), "작은 일 2건은 영주가 정함 · 답하지 않은 일 1건은 그대로 둠");
  const total = view.years.reduce((sum, entry) => sum + entry.big.length, 0);
  const markup = renderToStaticMarkup(createElement(SliceEndPage, { state: at20, view, onContinue: () => {}, onChronicle: () => {}, onRecord: () => {},
    onYearCard: () => {}, onSeasonCard: () => {} }));
  assert.equal(markup.match(/<ul class="slice-lines slice-year-big">/g)?.length, view.years.filter(entry => entry.big.length > 0).length);
  assert.equal([...markup.matchAll(/slice-year-big">(.*?)<\/ul>/g)].reduce((sum, match) => sum + (match[1]!.match(/data-record=/g)?.length ?? 0), 0), total);
  const smalls = [...markup.matchAll(/slice-year-small">([^<]*)</g)].map(match => match[1]!);
  assert.equal(smalls.length, view.years.filter(entry => entry.small !== null).length);
  assert.ok(smalls.every(line => !/(^|\D)0건/.test(line)), "no zero said");
  assert.match(markup, /slice-small-total/);
  assert.equal(primaries(markup), 1);
});
