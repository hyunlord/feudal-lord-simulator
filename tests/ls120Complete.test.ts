/**
 * LS1-20 (the user's ruling 2026-10-21; render-VIS-checkup33-ae3dee1, seed 33): a town full with every house at its
 * highest step (the engine's town_full) is complete, not stalled — the pill's mark "완성" in its own ink, the chip
 * "가득 참", the band's line without "자라지 않습니다", the year card's line; a town held by anything else is still
 * "정체". The band's growth line wraps inside the band (it ran past both sides). The stone town's proclamation has its
 * moment as the market town's has.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { gunzipSync } from "node:zlib";

import type { GameState } from "../src/engine/engine.types";
import { storyBeats } from "../src/ui/eventStory";
import { StatusPill } from "../src/ui/hud/HudShell";
import { statusPillModel } from "../src/ui/hud/statusPillModel";
import { growthBandLine, growthView } from "../src/ui/lord/growth/growthMark";
import { clearTownCloses } from "../src/ui/lord/seasonBand/townCloses";

const fixture = (path: string): GameState => JSON.parse(gunzipSync(readFileSync(new URL(`./fixtures/${path}.json.gz`, import.meta.url))).toString()) as GameState;
const full = fixture("ls120/seed33-1318-summer");
const stoneSpring = fixture("ls119/seed33-1319-spring");
const pill = (state: GameState) => renderToStaticMarkup(createElement(StatusPill, { state, model: statusPillModel(state), onOpenLedger: () => undefined,
  onOpenPopulation: () => undefined, onInspect: () => undefined }));

test("4: a full town is complete — the pill's 완성 in its own ink, the band's line, the chip, no 정체", () => {
  clearTownCloses();
  const view = growthView(full)!;
  assert.equal(view.block.reason, "town_full");
  assert.deepEqual([view.mark?.text, view.mark?.complete], ["완성", true]);
  assert.equal(growthBandLine(view), "마을이 가득 찼습니다 — 모든 집이 가장 높은 단계입니다");
  const markup = pill(full);
  assert.match(markup, /data-growth-complete="true"[^>]*>완성</);
  assert.doesNotMatch(markup, /정체/);
  const chip = storyBeats(full).find(beat => beat.kind === "growth_block")!;
  assert.equal(chip.chip, "가득 참");
  assert.doesNotMatch(`${chip.title} ${chip.chip}`, /정체|자라지 않습니다/);
});

test("4: a town held by anything else is still 정체 (the stone wall's stopped works)", () => {
  clearTownCloses();
  const view = growthView(stoneSpring)!;
  assert.equal(view.mark?.complete, undefined);
  assert.match(view.mark?.text ?? "", /^정체/);
  assert.match(growthBandLine(view) ?? "", /자라지 않습니다 — 성벽 공사가 멈춰 있습니다/);
});

test("3: the band's growth line is its own row and wraps inside the band's width", () => {
  const css = readFileSync(new URL("../src/styles/lordMode.css", import.meta.url), "utf8");
  assert.match(css, /\.season-band-item\[data-item="growth"\] \{[^}]*flex: 1 1 100%[^}]*white-space: normal/);
});

test("5b: the stone town's proclamation has its moment, a chip for the season after it, as the market town's", () => {
  assert.equal(stoneSpring.era, "stone_town");
  const moment = storyBeats(stoneSpring).find(beat => beat.kind === "stone_town");
  assert.ok(moment !== undefined, "the stone town's chip a season after its proclamation (75,895; the state 76,000)");
  assert.deepEqual([moment.title, moment.illustration, moment.decision], ["석벽 도시", "event_stonewall_charter", null]);
  const later = { ...stoneSpring, tick: stoneSpring.eraProclaimedTick! + 1_000 } as GameState;
  assert.equal(storyBeats(later).some(beat => beat.kind === "stone_town"), false, "a season on: gone");
});
