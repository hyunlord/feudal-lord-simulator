/**
 * LS1-11 (lord-screen-v1.md; the user's rulings 2026-10-16, v1.1 §7 item 4): a decision put off to the rail is not left
 * to lapse in silence. Its held chip says the time left by the engine's deadline and marks its last season; a lapse that
 * does something (an audit tolerated, an off-map petition refused) stops the auto-pause once as that season begins; and
 * once the engine has settled it a chip says what came of it. On the town of tests/lordMatterDeadlines.test.ts (an
 * off-map estate under a greedy steward, a visit at Michaelmas, rights brought up), played on without an answer.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { createGrowthOpening } from "../scripts/phase21OpeningTranslation";
import type { GameState } from "../src/engine/engine.types";
import { estatesOf, LORD } from "../src/engine/estates";
import { SEASON_TICKS } from "../src/engine/eventSchedule";
import { MARRIAGE_ESTATE_ID } from "../src/engine/marriage";
import { stewardCandidates } from "../src/engine/stewardship";
import { advanceTick } from "../src/engine/tick";
import { initialAgency } from "../src/engine/townAgency";
import { gameReducer } from "../src/state/gameStore";
import type { StoryBeat } from "../src/ui/eventStory";
import { storyBeats } from "../src/ui/eventStory";
import { autoPauseLines } from "../src/ui/hud/autoPauseLines";
import { autoPauseMemory, autoPauseStep, type AutoPauseItem, type AutoPauseMemory } from "../src/ui/hud/autoPauseModel";
import { storyChips } from "../src/ui/hud/storyChips";
import { chipDues, heldDeadlines } from "../src/ui/lord/decisions/deadlines";
import { DEADLINE_COPY } from "../src/ui/lord/decisions/deadlinesCopy.ko";
import { deadlineFates, type DeadlineFate } from "../src/ui/lord/decisions/deadlineRail";
import type { HeldDeadline } from "../src/ui/lord/decisions/deadlines";
import { heldChipIds } from "../src/ui/lord/decisions/heldChips";

const ESTATE = MARRIAGE_ESTATE_ID;

const played = (() => {
  let state: GameState = { ...(createGrowthOpening(1).state as GameState), agency: initialAgency() };
  while (state.persons === undefined) state = advanceTick(state);
  for (let tick = 0; tick < 3_990; tick += 1) state = advanceTick(state);
  const estates = estatesOf(state);
  state = { ...state, estates: { ...estates, estates: estates.estates.map(estate => estate.id === ESTATE ? { ...estate, titleHolder: LORD, possessor: LORD } : estate) } };
  while (state.stewardship === undefined) state = advanceTick(state);
  const greedy = stewardCandidates(state, ESTATE).find(entry => entry.record.disposition === "greedy")!.record;
  state = gameReducer(state, { type: "set_estate_oversight", estateId: ESTATE, mode: "steward", stewardId: greedy.personId });
  state = gameReducer(state, { type: "set_audit_mode", estateId: ESTATE, mode: "visit" });
  state = gameReducer(state, { type: "set_exception_rules", rules: { amountAtLeast: null, rights: true, marriage: false } });
  let memory: AutoPauseMemory = autoPauseMemory(state);
  const deadlineStops: { readonly after: GameState; readonly items: readonly AutoPauseItem[] }[] = [];
  const samples: GameState[] = [];
  const lapsed: { readonly state: GameState; readonly beat: StoryBeat }[] = [];
  // LS1-10: each held deadline's fate tick by tick, as the screen remembers them.
  let fateMemory: ReadonlyMap<string, HeldDeadline> = new Map();
  const fates = new Map<string, { readonly tick: number; readonly stage: DeadlineFate["stage"] | "held" }[]>();
  const end = state.tick + 4_100;
  while (state.tick < end) {
    const before = state;
    state = advanceTick(state);
    const step = autoPauseStep(memory, state, before);
    memory = step.memory;
    const items = step.fresh.filter(item => item.kind === "deadline");
    if (items.length > 0) deadlineStops.push({ after: state, items });
    if (state.tick % 250 === 0) samples.push(state);
    const step2 = deadlineFates(fateMemory, state);
    fateMemory = step2.memory;
    for (const due of heldDeadlines(state)) if (!step2.fates.has(due.chipId)) fates.set(due.chipId, [...(fates.get(due.chipId) ?? []), { tick: state.tick, stage: "held" }]);
    for (const [chipId, fate] of step2.fates) fates.set(chipId, [...(fates.get(chipId) ?? []), { tick: state.tick, stage: fate.stage }]);
    const beat = storyBeats(state).find(entry => entry.kind === "decision_lapsed");
    if (beat !== undefined && !lapsed.some(entry => entry.beat.id === beat.id)) lapsed.push({ state, beat });
  }
  return { deadlineStops, samples, lapsed, fates };
})();

test("a held chip's time left is the engine's deadline less the tick now; its last season marks it near", () => {
  let seen = 0;
  for (const state of played.samples) {
    const held = heldChipIds(state);
    const dues = chipDues(state);
    for (const deadline of heldDeadlines(state)) {
      assert.ok(held.has(deadline.chipId), `${deadline.chipId} is a held chip`);
      const due = dues.get(deadline.chipId)!;
      if (deadline.dueTick < state.tick) { assert.deepEqual({ left: due.left, near: due.near }, { left: DEADLINE_COPY.past, near: true }, deadline.chipId); seen += 1; continue; }
      const lastSeason = Math.floor((deadline.dueTick - 1) / SEASON_TICKS);
      const seasons = lastSeason - Math.floor(state.tick / SEASON_TICKS) + 1;
      assert.equal(due.near, seasons <= 1, deadline.chipId);
      assert.equal(due.left, seasons <= 1 ? DEADLINE_COPY.thisSeason : DEADLINE_COPY.seasonsLeft(seasons));
      seen += 1;
    }
  }
  assert.ok(seen > 0, "some held chip had a deadline");
});

test("an effectful deadline stops the auto-pause once, as its last season begins; the season's several make one stop", () => {
  assert.ok(played.deadlineStops.length > 0, "a deadline stopped time");
  const keys = played.deadlineStops.flatMap(stop => stop.items.map(item => item.key));
  assert.equal(new Set(keys).size, keys.length, "each deadline stops once");
  for (const stop of played.deadlineStops) {
    for (const item of stop.items) {
      if (item.kind !== "deadline") continue;
      assert.ok(item.deadline.effect, `${item.key}: only a lapse that does something`);
      assert.equal(Math.floor(stop.after.tick / SEASON_TICKS), Math.floor((item.deadline.dueTick - 1) / SEASON_TICKS), `${item.key}: in its last season`);
      const line = autoPauseLines(stop.after, [item])[0]!;
      assert.equal(line.word, DEADLINE_COPY.pauseWord);
      const name = storyBeats(stop.after).find(beat => beat.id === item.deadline.chipId)?.title ?? null;
      assert.equal(line.sentence, DEADLINE_COPY.pauseLine(item.deadline.kind, name));
      if (name !== null && name !== "") assert.ok(line.sentence.includes(`(${name})`), `${item.key}: the stop names it: ${line.sentence}`);
    }
  }
});

test("a decision left past its deadline is told: a chip says what the engine did with it, among the lord's results", () => {
  const kinds = played.lapsed.flatMap(entry => entry.beat.facts);
  assert.ok(kinds.includes(DEADLINE_COPY.lapsedOne("audit")), `the audit tolerated by its lapse is told: ${kinds.join(" / ")}`);
  assert.ok(kinds.includes(DEADLINE_COPY.lapsedOne("estate_petition")), `the off-map petition refused by its lapse is told: ${kinds.join(" / ")}`);
  for (const { state, beat } of played.lapsed) {
    // Its chip holds its place as the year's results chip does: plain chips do not push it out.
    const plain = Array.from({ length: 4 }, (_, index) => ({ ...beat, id: `plain:${index}`, kind: "fire", title: `plain ${index}` }) as StoryBeat);
    const entries = [beat, ...plain].map((entry, index) => ({ beat: entry, firstSeenMs: 1_000 + index, lastSeenMs: 9_000, dismissed: false }));
    const shown = storyChips(entries, new Set(entries.map(entry => entry.beat.id)), 10_000, 0, () => false, heldChipIds(state)).map(entry => entry.id);
    assert.ok(shown.includes(beat.id), `${beat.id} on the rail`);
  }
});

test("LS1-10: a held chip left past its deadline stays in its place, past then settled, with no tick of nothing between", () => {
  let settled = 0;
  for (const [chipId, timeline] of played.fates) {
    const stages = timeline.map(entry => entry.stage);
    if (!stages.includes("lapsed")) continue;
    settled += 1;
    // From the first tick it was seen to its lapse's end, one entry a tick: held, then past (if the engine waited), then lapsed.
    for (let index = 1; index < timeline.length; index += 1) assert.equal(timeline[index]!.tick, timeline[index - 1]!.tick + 1, `${chipId}: no gap at ${timeline[index]!.tick}`);
    const order = stages.filter((stage, index) => index === 0 || stage !== stages[index - 1]);
    assert.ok(["held,past,lapsed", "held,lapsed"].includes(order.join(",")), `${chipId}: ${order.join(",")}`);
  }
  assert.ok(settled > 0, "a held decision lapsed and was settled in place");
});

test("LS1-12: every held audit and off-map petition still answerable has its own chip (before, only the first did)", () => {
  let seen = 0;
  for (const state of played.samples) {
    const beats = new Set(storyBeats(state).map(entry => entry.id));
    for (const due of heldDeadlines(state)) {
      if ((due.kind !== "audit" && due.kind !== "estate_petition") || due.dueTick < state.tick) continue;
      assert.ok(beats.has(due.chipId), `${due.chipId} at ${state.tick} has its chip`);
      seen += 1;
    }
  }
  assert.ok(seen > 0);
});
