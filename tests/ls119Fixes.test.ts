/**
 * LS1-19 (the user's ruling 2026-10-21; render-VIS-checkup33-ae3dee1, seed 33): the stone town's wall named in the
 * stopped wording ("성벽 공사가 멈춰 있습니다", "정체 · 성벽 공사"); the proclamation request naming the era it asks for
 * and none after the stone town's (nor its chip lingering once the engine drops it); the year card's "석벽 도시 선포"
 * (the era's name); a result card hidden until its frame's picture is decoded (the 1313 card's text over the map).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { gunzipSync } from "node:zlib";

import type { GameState } from "../src/engine/engine.types";
import type { StoryBeat } from "../src/ui/eventStory";
import { storyBeats } from "../src/ui/eventStory";
import { clearFrameReady } from "../src/ui/frameReady";
import { storyChips } from "../src/ui/hud/storyChips";
import { growthView } from "../src/ui/lord/growth/growthMark";
import { clearTownCloses } from "../src/ui/lord/seasonBand/townCloses";
import { lordRequestView } from "../src/ui/lordCardsModel";
import { YearReviewCard } from "../src/ui/results/ResultCards";
import { lordYearReview } from "../src/ui/results/lordYearReview";

const fixture = (name: string): GameState => JSON.parse(gunzipSync(readFileSync(new URL(`./fixtures/ls119/${name}.json.gz`, import.meta.url))).toString()) as GameState;
const stoneSpring = fixture("seed33-1319-spring");
const marketWinter = fixture("seed33-1318-winter");
const withProclaim = (state: GameState): GameState => ({ ...state, agency: { ...state.agency!, requests: [{ kind: "proclaim_era" }] } } as unknown as GameState);

test("1: the stone town's stopped wall works say 성벽 — the band's cause, the chip's short form", () => {
  clearTownCloses();
  const view = growthView(stoneSpring)!;
  assert.equal(view.block.reason, "wall_building");
  assert.equal(view.reason, "성벽 공사가 멈춰 있습니다");
  assert.equal(view.wallKind, "stone");
  assert.equal(storyBeats(stoneSpring).find(beat => beat.kind === "growth_block")?.chip, "정체 · 성벽 공사");
});

test("2: the proclamation request asks for the era after the town's; none after the stone town's", () => {
  assert.equal(lordRequestView(withProclaim(stoneSpring)), null, "the stone town: no era to proclaim");
  const market = lordRequestView(withProclaim(marketWinter))!;
  assert.equal(market.title, "석벽 도시 선포를 기다립니다");
  assert.match(market.stake ?? "", /석벽 도시/);
});

test("2: a town request's chip goes the moment the engine drops it (no lingering minute)", () => {
  const beat = { id: "lord-request:proclaim_era", kind: "lord_request", illustration: null, tile: null, title: "x", line: "", facts: [], advice: "", decision: "lord_request" } as StoryBeat;
  const entries = [{ beat, firstSeenMs: 0, lastSeenMs: 10_000, dismissed: false, shownMs: 1_000 }];
  assert.equal(storyChips(entries, new Set([beat.id]), 11_000, 0, () => false).length, 1, "while current");
  assert.equal(storyChips(entries, new Set(), 11_000, 0, () => false).length, 0, "dropped: gone at once");
});

test("5a: the year card names the stone town's proclamation by its era — 석벽 도시 선포", () => {
  const lines = lordYearReview(stoneSpring, 1318).decisions.map(entry => entry.line);
  assert.ok(lines.some(line => line.includes("석벽 도시 선포")), lines.join(" / "));
  assert.ok(!lines.some(line => /석벽 선포/.test(line)));
});

test("7: a result card is hidden until its frame's picture is decoded", () => {
  const view = lordYearReview(fixture("seed33-1314-spring"), 1313);
  const card = () => renderToStaticMarkup(createElement(YearReviewCard, { view, onContinue: () => undefined, onChronicle: () => undefined }));
  assert.doesNotMatch(card(), /data-frame-ready/, "no image to wait on (the server): shown");
  const saved = (globalThis as { Image?: unknown }).Image;
  (globalThis as { Image?: unknown }).Image = class { src = ""; decode() { return new Promise(() => undefined); } };
  try {
    clearFrameReady();
    assert.match(card(), /data-frame-ready="false"/, "the picture not yet decoded: hidden");
  } finally { (globalThis as { Image?: unknown }).Image = saved; }
});
