/**
 * LS1-5 (lord-screen-v1.md): lord mode's year card has "마을의 한 해" — people, houses, fields and the treasury at the
 * year's start and end (the season closes the screen saw); a year with no decisions still has it, so the card is never
 * empty (P-T1); a year the screen did not see from its start falls back to the engine's seasons' sums, under the same heading.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { newGameState } from "../src/state/newGame";
import { clearTownCloses, recordTownClose } from "../src/ui/lord/seasonBand/townCloses";
import type { TownSnapshot } from "../src/ui/lord/seasonBand/seasonBandModel";
import { YearReviewCard } from "../src/ui/results/ResultCards";
import { lordYearReview } from "../src/ui/results/lordYearReview";
import { RESULTS_COPY } from "../src/ui/results/resultsCopy.ko";

const lord = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 1 })!;
const snap = (houses: number, fields: number, population: number, coin: number): TownSnapshot =>
  ({ levels: Object.fromEntries(Array.from({ length: houses }, (_, index) => [`h${index}`, 1])), buildings: 5, fields, dead: 0, population, coin });

test("a year with no decisions still has 마을의 한 해 — the card is not empty, its heading the town's year", () => {
  clearTownCloses();
  recordTownClose(1299, 3, snap(4, 0, 12, 60));
  recordTownClose(1300, 3, snap(5, 1, 56, 34));
  const view = lordYearReview(lord, 1300);
  assert.equal(view.decisions.length, 0, "no decision in the year");
  assert.equal(view.empty, null, "not the empty card");
  assert.deepEqual(view.town.slice(0, 3), ["인구 12명 → 56명", "집 4채 → 5채", "밭 0곳 → 1곳"]);
  const markup = renderToStaticMarkup(createElement(YearReviewCard, { view, onContinue: () => undefined, onChronicle: () => undefined }));
  assert.ok(markup.includes(RESULTS_COPY.year.townYear), "lord mode's heading");
  assert.ok(!markup.includes(`>${RESULTS_COPY.year.town}<`), "not the sandbox's 올해 마을");
  clearTownCloses();
});

test("a year the screen did not see from its start: no start → end lines (the engine's seasons' sums, when it has them)", () => {
  clearTownCloses();
  const view = lordYearReview(lord, 1300);
  assert.ok(view.town.every(line => !line.includes("→")), view.town.join(" | "));
});
