/**
 * QA-032 (docs/qa/round03-14, triage 2026-10-01): a chapter's end page showed again after a save and a load (the
 * hook's refs are empty after a load). The page is due only for an end the engine has not marked seen
 * (`chapterPageDue`); the hook marks it (`mark_chapter_page_seen`) as the page opens.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import test from "node:test";

import type { GameState } from "../src/engine/engine.types";
import { decodeSave, encodeSave } from "../src/save/saveCodec";
import { SAVE_SCHEMA_VERSION } from "../src/save/saveTypes";
import { gameReducer } from "../src/state/gameStore";
import { chapterPageDue } from "../src/ui/hud/useStoryPresentation";

const at = "2026-10-02T00:00:00.000Z";
const decode = (bytes: Uint8Array): GameState => decodeSave(bytes).envelope.state as GameState;
const fixture = (version: number, name: string): GameState => decode(new Uint8Array(readFileSync(`fixtures/saves/v${version}/${name}.save.json`)));
const roundTrip = (state: GameState): GameState => decode(encodeSave({ state, createdAt: at, savedAt: at }).bytes);

test("QA-032 the page opens once: due while unseen, not after the mark, and not after a save and a load either", () => {
  const five = fixture(SAVE_SCHEMA_VERSION, "chapter-five-town");
  const due = chapterPageDue(five);
  assert.equal(due?.chapter, 4, "chapter 4 ended on the save's tick (chapter 5 began) and its page has not been seen");
  // The hook dispatches this as the page opens.
  const seen = gameReducer(five, { type: "mark_chapter_page_seen", chapter: due!.chapter });
  assert.equal(chapterPageDue(seen), null, "marked: no second page in the session");
  assert.equal(chapterPageDue(roundTrip(seen)), null, "saved and loaded: the page does not open again");
  // Without the mark (the bug), a load within the end's season opened it again.
  assert.equal(chapterPageDue(roundTrip(five))?.chapter, 4);
});

test("QA-032 old saves: the v39 migration marks every earlier end seen, so the QA's 1340 save (chapter 2 ended 700 ticks before) opens nothing", () => {
  // The QA's own save (schema v36, t160700): chapter 2 ended at t160000, inside the page's 1,000-tick window.
  const natural = decode(new Uint8Array(gunzipSync(readFileSync("docs/qa/round03-14/repro/saves/natural1340-ch3-reload-repro.json.gz"))));
  assert.equal(natural.tick, 160_700);
  assert.deepEqual(natural.politics!.chapterEnds.map(end => [end.chapter, end.tick, end.seenTick]), [[1, 69_500, 69_500], [2, 160_000, 160_000]]);
  assert.equal(chapterPageDue(natural), null);
  // A v38 town: the ends before its tick are seen; only the end on the save's very tick may show once more.
  const v38 = fixture(38, "chapter-five-town");
  assert.deepEqual(v38.politics!.chapterEnds.map(end => end.seenTick === undefined), [false, false, false, true]);
  assert.equal(chapterPageDue(v38)?.chapter, 4);
  assert.equal(chapterPageDue(roundTrip(gameReducer(v38, { type: "mark_chapter_page_seen", chapter: 4 }))), null);
});

test("QA-032 an end outside its season is never due (seen or not)", () => {
  const five = fixture(SAVE_SCHEMA_VERSION, "chapter-five-town");
  assert.equal(chapterPageDue({ ...five, tick: five.politics!.chapterEnds.at(-1)!.tick + 1_000 }), null);
  assert.equal(chapterPageDue({ ...five, tick: five.politics!.chapterEnds.at(-1)!.tick + 999 })?.chapter, 4);
});
