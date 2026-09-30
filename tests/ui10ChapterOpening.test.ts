import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { BALANCE } from "../src/content/balanceConfig";
import type { GameState } from "../src/engine/engine.types";
import { scenarioOf } from "../src/engine/scenarioState";
import { CHRONICLE_COPY } from "../src/ui/chronicleCopy.ko";
import { chapterStartYear } from "../src/ui/chronicleModel";
import { ChapterTwoPreview } from "../src/ui/hud/StoryModals";

// UI-10: the chapter opening's years from the engine's chapter ends (QA round 2: chapter 3 opened in 1342 under
// "1348–1364").

const startYear = scenarioOf({ scenarioId: undefined } as unknown as GameState).startYear;
const tickOf = (year: number) => (year - startYear) * BALANCE.TICKS_PER_YEAR + BALANCE.TICKS_PER_YEAR / 2;
const ended = (ends: Readonly<Record<number, number>>): GameState => ({
  tick: tickOf(1450), politics: { chapterEnds: Object.entries(ends).map(([chapter, year]) => ({ chapter: Number(chapter), tick: tickOf(year) })) },
}) as unknown as GameState;

test("UI-10 chapter opening: the year the chapter began is the previous chapter's end (the engine's record), null before it", () => {
  const state = ended({ 1: 1317, 2: 1342, 3: 1362, 4: 1383 });
  assert.equal(chapterStartYear(state, 3), 1342);
  assert.equal(chapterStartYear(state, 4), 1362);
  assert.equal(chapterStartYear(state, 5), 1383);
  assert.equal(chapterStartYear(ended({ 1: 1317 }), 3), null);
});

test("UI-10 chapter opening: chapters 3–5 print their real start to the planned end; only the start at or past the end", () => {
  assert.equal(CHRONICLE_COPY.chapterOpening[3]?.title(1342), "제3장 · 흑사병의 그늘 · 1342–1364");
  assert.equal(CHRONICLE_COPY.chapterOpening[4]?.title(1362), "제4장 · 재편 · 1362–1400");
  assert.equal(CHRONICLE_COPY.chapterOpening[5]?.title(1383), "제5장 · 자치와 유산 · 1383–1450");
  assert.equal(CHRONICLE_COPY.chapterOpening[4]?.title(1400), "제4장 · 재편 · 1400");
  assert.equal(CHRONICLE_COPY.chapterOpening[3]?.title(null), "제3장 · 흑사병의 그늘");
  const markup = renderToStaticMarkup(createElement(ChapterTwoPreview, { onContinue: () => undefined, chapter: 3,
    startYear: chapterStartYear(ended({ 1: 1317, 2: 1342 }), 3) }));
  assert.match(markup, /aria-label="제3장 · 흑사병의 그늘 · 1342–1364"/);
  assert.match(markup, /<p class="chapter-loading-title">제3장 · 흑사병의 그늘 · 1342–1364<\/p>/);
  assert.doesNotMatch(markup, /1348/);
});
