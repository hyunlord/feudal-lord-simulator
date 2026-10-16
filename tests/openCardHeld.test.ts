/**
 * The open card's chip is held on the rail while its card is open (render-GROWCARD-probe-5a293a2, the market town's
 * growth card, hud.event-card.growth.market): a held off-map petition came while the card was open, the rail — the
 * famine and the petition held, the year's results chip above the plain ones (LS1-8) — had no room left for the plain
 * growth chip, and the card the player was reading closed with it.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { StoryBeat } from "../src/ui/eventStory";
import { storyChips } from "../src/ui/hud/storyChips";

const beat = (id: string, kind: string) => ({ id, kind, illustration: null, tile: null, decision: null, title: id, line: "", facts: [], advice: "" }) as unknown as StoryBeat;
const beats = [beat("results:1317", "decision_trace"), beat("growth:seen", "growth_block"), beat("famine:great_famine@61", "famine"), beat("estate-petition:58", "lord_decision")];
const entries = beats.map((entry, index) => ({ beat: entry, firstSeenMs: 1_000 + index, lastSeenMs: 9_000, dismissed: false }));
const current = new Set(beats.map(entry => entry.id));
const due = new Set(["famine:great_famine@61", "estate-petition:58"]);
const rail = (open: string | null) => storyChips(entries, current, 10_000, 0, () => false, due, open).map(entry => entry.id);

test("the open card's chip stays on the rail when held chips and the results chip leave no room for a plain one", () => {
  assert.ok(!rail(null).includes("growth:seen"), "closed, the plain chip gives way (LS1-8)");
  assert.ok(rail("growth:seen").includes("growth:seen"), "open, its chip is held");
  assert.ok(rail("growth:seen").includes("famine:great_famine@61") && rail("growth:seen").includes("estate-petition:58"), "the held chips stay");
});
