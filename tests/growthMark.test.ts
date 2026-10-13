/**
 * LS1-3 (lord-screen-v1.md): the status pill's growth mark keeps its place until the engine's growthBlock is connected
 * (GB2A-7, with GROW-BLOCK-2a): no mark is read and the pill shows none.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { growthMarkOf } from "../src/ui/lord/growth/growthMark";
import { GROWTH_COPY } from "../src/ui/lord/growth/growthCopy.ko";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";

test("until the engine's growthBlock is connected, no mark is read; its words are ready", () => {
  assert.equal(growthMarkOf(DEFAULT_GAME_STATE), null);
  assert.equal(GROWTH_COPY.stalled(3), "정체 3년");
});
