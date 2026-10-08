/**
 * LM-R3 phase 2a: the lord slice's opening page and its end ("이 도시가 내 결정의 결과인가") — both from the engine's reads
 * (`lordSliceStart`, `lordSliceOutcome`, `traceInRange`, `decisionRemembers`, `yearReview`). The lord slice seed 3 as the
 * lord bot plays it (its first tick files a suit and sets the market dues) to 1301's first tick; the end is that history
 * with the clock moved to the slice's end tick (a 20-year bot run is the DGX's: scripts/sliceEndsStates.ts).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { GENTRY_NAMES_KO } from "../src/content/gentryNames";
import { LORD_SLICE_FACTIONS, LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { traceInRange } from "../src/engine/decisionReads";
import type { GameState } from "../src/engine/engine.types";
import { lordBotCommands } from "../src/engine/lordBot";
import { lordSliceEndTick, lordSliceOutcome, lordSliceStart } from "../src/engine/lordSlice";
import { lordHouse } from "../src/engine/lordshipState";
import { markStorySeen } from "../src/engine/storySeen";
import { advanceTick } from "../src/engine/tick";
import { decodeSave, encodeSave } from "../src/save/saveCodec";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";
import { decisionBy, recordIndex } from "../src/ui/chronicle/historyIndex";
import { moneyFull } from "../src/ui/money.ko";
import { onlyMinds, traceGroups } from "../src/ui/results/decisionThread";
import { SliceEndPage, SliceStartPage } from "../src/ui/slice/SlicePages";
import { SLICE_COPY } from "../src/ui/slice/sliceCopy.ko";
import { requestSliceStart, SLICE_END_ID, SLICE_START_ID, sliceEndDue, slicePageDue, sliceStartDue, takeSliceStart } from "../src/ui/slice/sliceDue";
import { sliceEndView } from "../src/ui/slice/sliceEndModel";
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
  assert.equal(slicePageDue(begun, false), "slice_start");
  takeSliceStart();
  assert.equal(slicePageDue(begun, false), null);
});

test("slice end: opens once on `ended` — not before, not with the year's card waiting, not after its season; marked, it survives a load as seen", () => {
  assert.equal(lordSliceOutcome(town)!.ended, false);
  assert.equal(sliceEndDue(town), false);
  assert.equal(lordSliceOutcome(ended)!.ended, true);
  assert.equal(sliceEndDue(ended), true);
  assert.equal(slicePageDue(ended, false), "slice_end");
  assert.equal(slicePageDue(ended, true), null, "the year's card first");
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
  const markup = renderToStaticMarkup(createElement(SliceEndPage, { state: ended, view, onContinue: () => {}, onChronicle: () => {}, onRecord: () => {} }));
  assert.equal(primaries(markup), 1);
  assert.equal(markup.match(/slice-record/g)?.length, view.shaped.length, "each decision opens its record");
  assert.match(markup, /slice-chronicle/);
  assert.equal(sliceEndView(town), null, "not before the end");
});
