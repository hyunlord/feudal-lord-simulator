/** Renderer A's request: a relation's stage by DTR-4's act thresholds (±30 small, ±60 large) — the same `>=`/`<=` edges. */
import assert from "node:assert/strict";
import test from "node:test";

import { FACTION_ACT_BALANCE } from "../src/content/factionActConfig";
import { relationStage } from "../src/engine/relationStage";

test("relationStage: five stages on the factions' own act thresholds, edges included", () => {
  const { smallAt, largeAt } = FACTION_ACT_BALANCE;
  const at = (value: number) => relationStage(value).rank;
  assert.deepEqual([-100, -largeAt, -largeAt + 1, -smallAt, -smallAt + 1, 0, smallAt - 1, smallAt, largeAt - 1, largeAt, 100].map(at),
    [-2, -2, -1, -1, 0, 0, 0, 1, 1, 2, 2]);
  assert.deepEqual([-80, -40, 0, 40, 80].map(value => relationStage(value).id), ["hostile", "cold", "neutral", "warm", "devoted"]);
});
