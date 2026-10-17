/**
 * LS1-12 (the user's ruling 2026-10-17; render-VIS-ls110-7222860, seed 4: 38 off-map petitions over twenty years, the chip
 * budget over 8 a year in 8 years): held decisions of one kind fold into one chip, "영지 밖 청원 3건", its time left and
 * near look the earliest deadline's; its card lists them and answers each; one past its deadline leaves the fold and
 * changes in its own place, the others stay folded.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { StoryBeat } from "../src/ui/eventStory";
import { heldFoldId } from "../src/ui/hud/heldFold";
import { storyChips } from "../src/ui/hud/storyChips";
import { fatedDues } from "../src/ui/lord/decisions/deadlineRail";
import { DEADLINE_COPY } from "../src/ui/lord/decisions/deadlinesCopy.ko";
import { askDecision, askedOrFirst } from "../src/ui/lord/decisions/decisionFocus";

const beat = (id: string, extra: Partial<StoryBeat> = {}) =>
  ({ id, kind: "lord_decision", illustration: null, tile: null, decision: "estate_petition_offmap", title: id, line: "", facts: [], advice: "", ...extra }) as unknown as StoryBeat;
const petitions = ["estate-petition:p1", "estate-petition:p2", "estate-petition:p3"].map(id => beat(id));
const results = beat("results:1316", { kind: "decision_trace", decision: null });
const plain = beat("fire:1", { kind: "fire", decision: null });
const entries = (beats: readonly StoryBeat[]) => beats.map((entry, index) => ({ beat: entry, firstSeenMs: 1_000 + index, lastSeenMs: 9_000, dismissed: false }));
const rail = (beats: readonly StoryBeat[], held: readonly string[]) =>
  storyChips(entries(beats), new Set(beats.map(entry => entry.id)), 10_000, 0, () => false, new Set(held));

test("held decisions of one kind fold into one chip, the count its title, its members kept for the card", () => {
  const shown = rail([...petitions, results, plain], petitions.map(entry => entry.id));
  assert.deepEqual(shown.map(entry => entry.id), [heldFoldId("estate-petition"), "results:1316", "fire:1"]);
  assert.equal(shown[0]!.title, DEADLINE_COPY.heldFold("estate-petition", 3));
  assert.deepEqual(shown[0]!.members!.map(member => member.id), petitions.map(entry => entry.id));
  // One alone stays as it is.
  assert.deepEqual(rail([petitions[0]!, results], [petitions[0]!.id]).map(entry => entry.id), ["estate-petition:p1", "results:1316"]);
});

test("one past its deadline leaves the fold and changes in its own place; the others stay folded", () => {
  const past = { ...petitions[0]!, decision: null, fated: true as const };
  const shown = rail([past, petitions[1]!, petitions[2]!, results], petitions.map(entry => entry.id));
  assert.deepEqual(shown.map(entry => entry.id), ["estate-petition:p1", heldFoldId("estate-petition"), "results:1316"]);
  assert.equal(shown[1]!.title, DEADLINE_COPY.heldFold("estate-petition", 2));
});

test("the folded chip's time left is its earliest member's, near when that one is", () => {
  const folded = rail(petitions, petitions.map(entry => entry.id));
  const dues = new Map([["estate-petition:p1", { left: "3철 남음", near: false, dueTick: 30_000 }], ["estate-petition:p2", { left: "이번 철까지", near: true, dueTick: 25_000 }],
    ["estate-petition:p3", { left: "2철 남음", near: false, dueTick: 27_000 }]]);
  assert.deepEqual(fatedDues(dues, new Map(), folded).get(heldFoldId("estate-petition")), { left: "이번 철까지", near: true, dueTick: 25_000 });
});

test("a member's [결정하기] opens that one's card; with none asked, the first", () => {
  const open = [{ id: "p1" }, { id: "p2" }, { id: "p3" }];
  askDecision(null);
  assert.equal(askedOrFirst(open, entry => `estate-petition:${entry.id}`)?.id, "p1");
  askDecision("estate-petition:p3");
  assert.equal(askedOrFirst(open, entry => `estate-petition:${entry.id}`)?.id, "p3");
  // Answered (no longer open): the first again.
  assert.equal(askedOrFirst(open.slice(0, 2), entry => `estate-petition:${entry.id}`)?.id, "p1");
  askDecision(null);
});
