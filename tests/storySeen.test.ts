/**
 * LM-R2-E ① (render request docs/requests/engine-lmr2-seen-and-reads.md §1): the stories the screen has shown are kept
 * in the save — marked seen, opened or dismissed; the same mark again is the same state; old marks go; not a decision;
 * no rule reads them.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { GameState } from "../src/engine/engine.types";
import { DECISION_KIND_BY_COMMAND } from "../src/engine/history";
import { markStorySeen, STORY_SEEN_KEEP_TICKS, STORY_SEEN_MAX, storySeen } from "../src/engine/storySeen";
import { advanceTick } from "../src/engine/tick";
import { decodeSave, encodeSave } from "../src/save/saveCodec";
import { gameReducer } from "../src/state/gameStore";

const load = (): GameState => decodeSave(new Uint8Array(readFileSync("fixtures/saves/v51/chapter-two-town.save.json"))).envelope.state as GameState;

test("a story is marked seen at this tick, then opened or dismissed; the same mark again is the same state", () => {
  const town = load();
  assert.equal(storySeen(town, "registry:occ-1"), null);
  const seen = gameReducer(town, { type: "mark_story_seen", id: "registry:occ-1", how: "seen" });
  assert.deepEqual(storySeen(seen, "registry:occ-1"), { id: "registry:occ-1", tick: town.tick });
  assert.equal(gameReducer(seen, { type: "mark_story_seen", id: "registry:occ-1", how: "seen" }), seen, "seen again: the same state");
  const opened = gameReducer({ ...seen, tick: seen.tick + 10 }, { type: "mark_story_seen", id: "registry:occ-1", how: "opened" });
  assert.deepEqual(storySeen(opened, "registry:occ-1"), { id: "registry:occ-1", tick: town.tick, opened: true }, "the first tick kept");
  assert.equal(markStorySeen(opened, "registry:occ-1", "opened"), opened);
  const dismissed = markStorySeen(opened, "registry:occ-1", "dismissed");
  assert.deepEqual(storySeen(dismissed, "registry:occ-1"), { id: "registry:occ-1", tick: town.tick, opened: true, dismissed: true });
  // A first mark may be "opened" or "dismissed" straight away.
  assert.deepEqual(storySeen(markStorySeen(town, "fire:h-1", "dismissed"), "fire:h-1"), { id: "fire:h-1", tick: town.tick, dismissed: true });
  // Unknown how, empty or too long id: nothing.
  assert.equal(markStorySeen(town, "x", "read"), town);
  assert.equal(markStorySeen(town, "", "seen"), town);
  assert.equal(markStorySeen(town, "y".repeat(129), "seen"), town);
});

test("each write drops marks older than two years and keeps the newest 256", () => {
  const town = load();
  const old = markStorySeen(town, "old", "seen");
  const later = markStorySeen({ ...old, tick: town.tick + STORY_SEEN_KEEP_TICKS + 1 }, "new", "seen");
  assert.equal(storySeen(later, "old"), null);
  assert.notEqual(storySeen(later, "new"), null);
  let many = town;
  for (let index = 0; index < STORY_SEEN_MAX + 10; index += 1) many = markStorySeen({ ...many, tick: town.tick + index }, `s${index}`, "seen");
  assert.equal(many.seen!.marks.length, STORY_SEEN_MAX);
  assert.equal(storySeen(many, "s0"), null, "the oldest went first");
  assert.notEqual(storySeen(many, `s${STORY_SEEN_MAX + 9}`), null);
});

test("the marks survive a save; they are not a decision and no rule reads them", () => {
  const town = markStorySeen(markStorySeen(load(), "lord-moment:h-9", "seen"), "home-petition:p-3", "opened");
  const bytes = encodeSave({ state: town, createdAt: "1970-01-01T00:00:00.000Z", savedAt: "1970-01-01T00:00:00.000Z" }).bytes;
  assert.deepEqual(decodeSave(bytes).envelope.state.seen, town.seen);
  assert.equal(DECISION_KIND_BY_COMMAND["mark_story_seen"], undefined);
  // The simulation runs the same with or without the marks.
  let marked: GameState = town;
  let bare: GameState = { ...town };
  delete (bare as { seen?: unknown }).seen;
  for (let tick = 0; tick < 300; tick += 1) { marked = advanceTick(marked); bare = advanceTick(bare); }
  const { seen, ...rest } = marked;
  assert.deepEqual(seen, town.seen);
  assert.deepEqual(rest, bare);
});
