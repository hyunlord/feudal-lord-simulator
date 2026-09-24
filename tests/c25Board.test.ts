import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { C25_BOARD_FILE, c25BoardHashes } from "../scripts/c25Board";

// C25 regression board: the seed 2 view with buildings, square fields, roads, water and the wall, at zoom
// 0.6 / 1.0 / 1.35 x DPR 1 / 2. A change that is meant to move the board regenerates the fixture in the same commit.

test("Given the C25 board When it is drawn twice at every zoom and DPR Then both draws match each other and the recorded board", () => {
  // Given
  const recorded = (JSON.parse(readFileSync(C25_BOARD_FILE, "utf8")) as { hashes: Record<string, string> }).hashes;

  // When
  const first = c25BoardHashes();
  const second = c25BoardHashes();

  // Then
  assert.deepEqual(second, first, "same state, same draw");
  assert.equal(Object.keys(first).length, 6);
  assert.deepEqual(first, recorded, "the C25 board moved: if intended, run `npx tsx scripts/c25Board.ts --write` and report it");
});
