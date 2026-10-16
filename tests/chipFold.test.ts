/**
 * CHIP-FOLD (user 2026-10-11; VIS-1, render-VIS-run-929f5f7: of 320 chips over twenty years at 10x most were one cause
 * again — "N년 당신의 결정 때문에: 시장 부담" ×36): the chips of one cause fold into one, at the newest's place, its title
 * the cause and how many ("당신의 결정 때문에: 시장 부담 ×12"); one folded chip takes one of the rail's three slots; the
 * other chips are as they were.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { StoryBeat } from "../src/ui/eventStory";
import { foldChips } from "../src/ui/hud/chipFold";
import { storyChips } from "../src/ui/hud/storyChips";
import { RESULTS_COPY } from "../src/ui/results/resultsCopy.ko";

const DUES = { key: "lord:시장 부담", title: RESULTS_COPY.trace.foldTitle("lord", "시장 부담") };
const trace = (id: string, year: number, fold = DUES) => ({ id, kind: "decision_trace", illustration: null, tile: null, decision: null,
  title: RESULTS_COPY.trace.chipTitle(year, "lord", "시장 부담"), line: "", facts: [], advice: "", fold }) as unknown as StoryBeat;
const other = (id: string) => ({ id, kind: "fire", illustration: null, tile: null, decision: null, title: id, line: "", facts: [], advice: "" }) as unknown as StoryBeat;
const entries = (beats: readonly StoryBeat[]) => beats.map((beat, index) => ({ beat, firstSeenMs: 1_000 + index, lastSeenMs: 9_000, dismissed: false }));
const chips = (beats: readonly StoryBeat[]) => storyChips(entries(beats), new Set(beats.map(beat => beat.id)), 10_000, 500, () => false);

test("one cause's chips fold into one at the newest's place: the cause and how many, standing for them all", () => {
  const seasons = Array.from({ length: 12 }, (_, index) => trace(`trace:dues:${index}`, 1300 + Math.floor(index / 4)));
  const shown = chips([other("fire-1"), ...seasons]);
  const folded = shown.find(beat => beat.kind === "decision_trace")!;
  assert.equal(shown.filter(beat => beat.kind === "decision_trace").length, 1);
  assert.equal(folded.title, "당신의 결정 때문에: 시장 부담 ×12");
  assert.equal(folded.id, "fold:lord:시장 부담", "the cause's chip, the same one season after season");
  assert.equal(folded.line, seasons.at(-1)!.line, "its card is the newest season's");
  assert.deepEqual(folded.folded, seasons.map(beat => beat.id));
  assert.ok(shown.some(beat => beat.id === "fire-1"), "the other chip stays");
});

test("a cause seen once keeps its own title; two causes fold apart; chips without a cause never fold", () => {
  assert.deepEqual(foldChips([trace("trace:a:0", 1300)]).map(beat => [beat.id, beat.title, beat.folded]),
    [["fold:lord:시장 부담", RESULTS_COPY.trace.chipTitle(1300, "lord", "시장 부담"), ["trace:a:0"]]], "seen once: its own title, already the cause's chip");
  const suit = { key: "lord:소송을 걸었다", title: RESULTS_COPY.trace.foldTitle("lord", "소송을 걸었다") };
  const folded = foldChips([trace("d0", 1300), trace("s0", 1300, suit), trace("d1", 1301), trace("s1", 1301, suit), other("x"), other("x2")]);
  assert.deepEqual(folded.map(beat => beat.title), ["당신의 결정 때문에: 시장 부담 ×2", "당신의 결정 때문에: 소송을 걸었다 ×2", "x", "x2"]);
  assert.deepEqual(folded.map(beat => beat.id), ["fold:lord:시장 부담", "fold:lord:소송을 걸었다", "x", "x2"], "chips without a cause keep their ids");
});

test("a folded chip takes one of the rail's three slots: the news after it is not pushed out", () => {
  const shown = chips([...Array.from({ length: 8 }, (_, index) => trace(`trace:dues:${index}`, 1300)), other("news-1"), other("news-2")]);
  assert.deepEqual(shown.map(beat => beat.id), ["fold:lord:시장 부담", "news-1", "news-2"]);
  // Before the fold the eight would have taken the rail and shown only one of the news.
  assert.equal(chips([...Array.from({ length: 8 }, (_, index) => trace(`trace:dues:${index}`, 1300, undefined as never)), other("news-1"), other("news-2")])
    .filter(beat => beat.kind === "decision_trace").length, 1);
});

test("fewer chips than the rail's room all show (a negative slice start once kept only the last of two)", () => {
  assert.deepEqual(chips([other("a"), other("b")]).map(beat => beat.id), ["a", "b"]);
  assert.deepEqual(chips([other("a")]).map(beat => beat.id), ["a"]);
  assert.deepEqual(chips([other("a"), other("b"), other("c"), other("d")]).map(beat => beat.id), ["b", "c", "d"], "four: the newest three");
});

test("LS1-6: the year's results chip goes the moment its year is over (the year card takes it): one on the rail at a time", () => {
  const year = (id: string) => ({ ...other(id), kind: "decision_trace" }) as unknown as StoryBeat;
  const last = year("results:1302"); const now = year("results:1303"); const fire = other("fire-2");
  const seen = [last, fire, now].map((beat, index) => ({ beat, firstSeenMs: 1_000 + index, lastSeenMs: 9_000, dismissed: false }));
  const shown = storyChips(seen, new Set([now.id]), 10_000, 500, () => false);
  assert.deepEqual(shown.map(beat => beat.id).filter(id => id.startsWith("results:")), ["results:1303"], "last year's chip is not kept its minute");
  assert.ok(shown.some(beat => beat.id === "fire-2"), "another chip over keeps its minute");
});

test("LS1-8: the year's results chip keeps its place on a full rail — the oldest plain chip goes; held chips still come first", () => {
  const year = ({ ...other("results:1305"), kind: "decision_trace" }) as unknown as StoryBeat;
  const plain = ["wet-1", "family-1", "actual-1"].map(other);
  const order = [year, ...plain];
  const seen = order.map((beat, index) => ({ beat, firstSeenMs: 1_000 + index, lastSeenMs: 9_000, dismissed: false }));
  const ids = storyChips(seen, new Set(order.map(beat => beat.id)), 10_000, 500, () => false).map(beat => beat.id);
  assert.deepEqual(ids, ["results:1305", "family-1", "actual-1"], "results first among the unheld; the oldest plain chip (wet-1) gives way");
  const held = ["audit:a1", "registry:r1"].map(other);
  const withHeld = [...held, year, ...plain].map((beat, index) => ({ beat, firstSeenMs: 1_000 + index, lastSeenMs: 9_000, dismissed: false }));
  const heldIds = storyChips(withHeld, new Set(withHeld.map(entry => entry.beat.id)), 10_000, 500, () => false, new Set(["audit:a1", "registry:r1"])).map(beat => beat.id);
  assert.deepEqual(heldIds, ["audit:a1", "registry:r1", "results:1305"], "two held chips, then the results chip; no plain chip");
});
