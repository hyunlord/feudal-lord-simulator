/**
 * LS1-9 follow-up (render-VIS-ls19-5ade799: six whole-rail swaps of 3–10 ticks, each right after a completion toast):
 * the presentation clock, started again after a rest, read the stamp from when it last stopped for one render, and the
 * story rail drew itself as it stood then — the chips seen since gone, chips long closed back. The start reads the wall
 * clock now.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { StoryBeat } from "../src/ui/eventStory";
import { storyChips } from "../src/ui/hud/storyChips";
import { presentationClockReading } from "../src/ui/usePresentationClock";

const beat = (id: string, kind = "fire") => ({ id, kind, illustration: null, tile: null, decision: null, title: id, line: "", facts: [], advice: "" }) as unknown as StoryBeat;
// The clock last stopped at 440 s (a toast's end); the wall clock is at 500 s when the next toast starts it again.
const STOPPED_MS = 440_000;
const WALL_MS = 500_000;
const entries = [
  { beat: beat("registry:closed-offer"), firstSeenMs: 400_000, lastSeenMs: 430_000, dismissed: false },
  { beat: beat("results:1307", "decision_trace"), firstSeenMs: 450_000, lastSeenMs: WALL_MS, dismissed: false },
  { beat: beat("lord-moment:newest", "lord_moment"), firstSeenMs: 480_000, lastSeenMs: WALL_MS, dismissed: false },
];
const current = new Set(["results:1307", "lord-moment:newest"]);
const rail = (nowMs: number) => storyChips(entries, current, nowMs, 500, () => false).map(chip => chip.id);

test("the stamp from the clock's last stop draws the rail as it stood then (the swap the judgement run saw)", () => {
  assert.deepEqual(rail(STOPPED_MS), ["registry:closed-offer"], "the chips seen since gone, the closed offer back");
  assert.deepEqual(rail(WALL_MS), ["results:1307", "lord-moment:newest"]);
});

test("the render that starts the clock again reads the wall clock; a running clock its stamp; a resting one the wall", () => {
  const start = presentationClockReading({ nowMs: STOPPED_MS, running: false }, true, WALL_MS);
  assert.equal(start, WALL_MS, "not the stamp from when it stopped");
  assert.deepEqual(rail(start), ["results:1307", "lord-moment:newest"]);
  assert.equal(presentationClockReading({ nowMs: WALL_MS - 40, running: true }, true, WALL_MS), WALL_MS - 40);
  assert.equal(presentationClockReading({ nowMs: STOPPED_MS, running: true }, false, WALL_MS), WALL_MS);
});
