/**
 * PLAGUE-b (chapter 3 follow-up):
 *   - A house the plague emptied keeps the empty-house boards every house already has (a Wave 26 variant its own
 *     `boarded` layer, a base painting Wave 7's boarded_lN); Wave 9's plague_shut only on the base canvases it fits
 *     (L1–L3). No door marks.
 *   - The chronicle's chapter 3 start borrows the harbour fever rumour illustration until Astra's start painting comes.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { HistoryRecord } from "../src/engine/history.types";
import { vacantHouseBoards } from "../src/render/buildingOverlays";
import { recordArt } from "../src/ui/chronicle/chronicleScreenModel";
import { CHAPTER_START_ART, chronicleIllustration } from "../src/ui/chronicleModel";
import { WAVE21_IMAGES } from "../src/ui/wave21ArtManifest.generated";

test("PLAGUE-b: plague-emptied houses take the boards that fit their painting", () => {
  for (const level of [0, 1, 2, 3, 4]) assert.equal(vacantHouseBoards(level, true, true), "variant_boarded", `variant L${level}`);
  for (const level of [1, 2, 3]) assert.equal(vacantHouseBoards(level, false, true), "plague_shut", `base L${level}`);
  assert.equal(vacantHouseBoards(0, false, true), "boarded");
  assert.equal(vacantHouseBoards(4, false, true), "boarded", "the bot town's L4 base houses show boarded_l4");
  for (const level of [0, 1, 2, 3, 4]) assert.equal(vacantHouseBoards(level, false, false), "boarded", "a house abandoned for want of food keeps boarded");
});

const start = (chapter: number) => ({ id: `h${chapter}`, tick: 1, kind: "milestone", template: "milestone.chapter_start", params: { chapter },
  subject: { kind: "town", id: "town" }, severity: 2 }) as unknown as HistoryRecord;

test("PLAGUE-b: chapter 3's start shows the harbour fever rumour; chapter 2 keeps its intro", () => {
  assert.ok(CHAPTER_START_ART[3]! in WAVE21_IMAGES);
  assert.equal(chronicleIllustration(start(3)), "ch3_event_harbour_fever");
  assert.equal(chronicleIllustration(start(5)), "chronicle_settlement");
  const state = { persons: [], scenarioId: "campaign", seed: 1 } as never;
  assert.deepEqual(recordArt(state, start(3)), { kind: "wave21", id: "ch3_event_harbour_fever" });
  assert.deepEqual(recordArt(state, start(2)), { kind: "wave16", id: "chapter2_intro" });
});
