/**
 * LS1-10 (the user's ruling 2026-10-17; render-VIS-ls111-682d366: William's death at 36001 never reached the rail): the
 * lord's family's news stands in the results layer with the year's results chip and the lapse chip, above the plain
 * chips. In the layer, what came first shows first: a newer chip never takes a place from one shown or waiting longer,
 * and room that comes goes to the longest waiting — at 37001 a new lord moment took the slot the family chip had waited
 * for. A family or lapse chip never shown waits for its place past its beat's own time.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { StoryBeat } from "../src/ui/eventStory";
import { storyChips } from "../src/ui/hud/storyChips";

const beat = (id: string, kind: string, extra: Partial<StoryBeat> = {}) =>
  ({ id, kind, illustration: null, tile: null, decision: null, title: id, line: "", facts: [], advice: "", ...extra }) as unknown as StoryBeat;
type Entry = { beat: StoryBeat; firstSeenMs: number; lastSeenMs: number; dismissed: boolean; shownMs?: number };
const entry = (b: StoryBeat, firstSeenMs: number, extra: Partial<Entry> = {}): Entry => ({ beat: b, firstSeenMs, lastSeenMs: 100_000, dismissed: false, ...extra });

const registry = beat("registry:offer", "registry_event");
const results = beat("results:1309", "decision_trace");
const family = beat("family:h-002746", "family_news");
const lapsed = beat("lapsed:36", "decision_lapsed");
const moment = beat("lord-moment:h-002753", "lord_moment");
const rail = (entries: readonly Entry[], current: readonly string[], held: readonly string[]) =>
  storyChips(entries, new Set(current), 100_000, 0, () => false, new Set(held)).map(chip => chip.id);

test("the family chip takes its place before a newer lapse chip, and never yields it to a newer lord moment", () => {
  // 36139: the registry offer held, the year's results chip, the family news (36001), the political petition's lapse (36139).
  const at36139 = [entry(results, 1_000), entry(registry, 2_000), entry(family, 3_000), entry(lapsed, 4_000)];
  assert.deepEqual(rail(at36139, ["registry:offer", "results:1309", "family:h-002746", "lapsed:36"], ["registry:offer"]), ["registry:offer", "results:1309", "family:h-002746"]);
  // 37001: a newer lord moment comes (plain); the results layer keeps its order and the moment waits below it.
  const at37001 = [...at36139, entry(moment, 5_000)];
  assert.deepEqual(rail(at37001, ["registry:offer", "results:1309", "family:h-002746", "lapsed:36", "lord-moment:h-002753"], ["registry:offer"]),
    ["registry:offer", "results:1309", "family:h-002746"]);
});

test("a family chip never shown waits past its beat's own time; once shown, it goes as any chip does", () => {
  const waiting = [entry(results, 1_000), entry(registry, 2_000), entry({ ...family, family: true }, 3_000, { lastSeenMs: 1_000 })];
  // Its beat over long since (no longer current, its minute gone) but never shown: still in line.
  assert.ok(rail(waiting, ["registry:offer", "results:1309"], ["registry:offer"]).includes("family:h-002746"));
  const seen = waiting.map(item => item.beat.id === "family:h-002746" ? { ...item, shownMs: 3_500 } : item);
  assert.ok(!rail(seen, ["registry:offer", "results:1309"], ["registry:offer"]).includes("family:h-002746"), "shown once, its time over: gone");
});
