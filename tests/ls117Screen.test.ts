/**
 * LS1-17 (the user's ruling 2026-10-19; engine B's suit reads, trunk e9a227e7): a suit against the lord counts to its
 * verdict on the rail ("판결까지 N철", suitVerdictTick read as it is) and looks near, and stops the clock, only at a stage
 * that waits for his answer (suitAwaitsLord) — the check-up run's suit sat at "이번 철" three seasons running. With it: the
 * relation-crossing chip's short form ("언더우드 · 무덤덤") and the result cards' buttons outside the scrolling body.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { gunzipSync } from "node:zlib";

import type { GameState } from "../src/engine/engine.types";
import { estatesOf } from "../src/engine/estates";
import { suitAwaitsLord, suitVerdictTick } from "../src/engine/estateSuits";
import { autoPauseMemory, autoPauseStep } from "../src/ui/hud/autoPauseModel";
import { chipDues } from "../src/ui/lord/decisions/deadlines";
import { RELATION_STAGE_COPY } from "../src/ui/lord/relationStageCopy.ko";
import { YearReviewCard } from "../src/ui/results/ResultCards";
import type { YearReviewView } from "../src/ui/results/yearReview";

// render-VIS-ls116-5ac6762, seed 1: a neighbour's suit against the lord (suit-3), at its evidence stage (1309 summer: he
// can answer) and at its hearing (1309 winter: nothing to answer).
const fixture = (name: string): GameState => JSON.parse(gunzipSync(readFileSync(new URL(`./fixtures/ls117/${name}.json.gz`, import.meta.url))).toString()) as GameState;
const summer = fixture("seed1-1309-summer");
const winter = fixture("seed1-1309-winter");
const suit = (state: GameState) => estatesOf(state).suits.find(entry => entry.id === "suit-3")!;

test("the chip counts the seasons to the engine's verdict tick, near only while the stage waits for the lord", () => {
  assert.deepEqual([suitVerdictTick(summer, suit(summer)), suitAwaitsLord(summer, suit(summer))], [40_000, true]);
  assert.deepEqual(chipDues(summer).get("suit-defence:suit-3"), { left: "판결까지 3철", short: "판결까지 3철", near: true, dueTick: 40_000 });
  assert.deepEqual([suitVerdictTick(winter, suit(winter)), suitAwaitsLord(winter, suit(winter))], [40_000, false]);
  assert.deepEqual(chipDues(winter).get("suit-defence:suit-3"), { left: "판결까지 1철", short: "판결까지 1철", near: false, dueTick: 40_000 },
    "the hearing needs no answer: not near, no 이번 철");
});

test("the verdict tick moving moves the chip's number (the engine's planned value)", () => {
  const later = { ...summer, estates: { ...summer.estates!, suits: estatesOf(summer).suits.map(entry => entry.id === "suit-3" ? { ...entry, stageSince: entry.stageSince + 2_000 } : entry) } } as GameState;
  const verdict = suitVerdictTick(later, suit(later))!;
  assert.ok(verdict > 40_000);
  assert.equal(chipDues(later).get("suit-defence:suit-3")?.short, `판결까지 ${Math.floor(verdict / 1_000) - Math.floor(later.tick / 1_000)}철`);
});

test("a suit's new stage stops the clock only when it waits for the lord", () => {
  // The memory before the stage came (no matters known), then the same state a tick on: the stage is new to the screen.
  const step = (state: GameState) => {
    const memory = { ...autoPauseMemory(state), matters: new Set<string>() };
    return autoPauseStep(memory, { ...state, tick: state.tick + 1 }, memory.baseline).fresh.filter(item => item.kind === "matter" && item.matter.id === "suit-3");
  };
  assert.equal(step(summer).length, 1, "evidence: the lord can answer — one stop");
  assert.equal(step(winter).length, 0, "the hearing: nothing to answer — no stop");
});

test("the relation crossing's chip: the faction's short word and the stage it came to", () => {
  const to = RELATION_STAGE_COPY.names["0"];
  assert.equal(RELATION_STAGE_COPY.chip("merchant_house_1", "언더우드 상인 가문", to), "언더우드 · 무덤덤");
  assert.equal(RELATION_STAGE_COPY.chip("neighbour_1", "드 이브르쿠르 가문(이웃 영주)", to), "드 이브르쿠르 · 무덤덤");
  assert.equal(RELATION_STAGE_COPY.chip("town", "도시 공동체", to), "도시 · 무덤덤");
  assert.equal(RELATION_STAGE_COPY.chip("bishop", "켈버러 주교", to), "교회 · 무덤덤");
  assert.equal(RELATION_STAGE_COPY.chip("overlord", "솔트월드 백작", to), "솔트월드 · 무덤덤");
});

test("the year card's buttons are the card's own last row, outside the scrolling body", () => {
  const view: YearReviewView = { year: 1316, title: "1316년", lord: true, house: [], decisions: [], steward: [], answers: [], relations: [], receipts: [],
    threads: [], community: [], town: ["인구 528명 → 528명"], empty: null };
  const markup = renderToStaticMarkup(createElement(YearReviewCard, { view, onContinue: () => undefined, onChronicle: () => undefined }));
  const body = markup.indexOf('class="petition-body results-card-body"');
  const actions = markup.indexOf('class="results-card-actions"');
  assert.ok(body >= 0 && actions > body);
  assert.ok(markup.includes('</div><div class="results-card-actions">'), "the body closes before the buttons");
  assert.match(markup.slice(actions), /results-card-chronicle[\s\S]*results-card-continue/);
});
