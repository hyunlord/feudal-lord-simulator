import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { compareTrunkHashes, TRUNK_HASHES } from "../scripts/guardrailTrunkHashes.mjs";

// RR30: the guardrail compares every seed with one list of the trunk's expected end states.
const list = JSON.parse(readFileSync(TRUNK_HASHES, "utf8"));

test("the trunk list names seeds 1-5 with a full hash, the end tick and where each value comes from; every update names its decision", () => {
  assert.deepEqual(Object.keys(list.seeds), ["1", "2", "3", "4", "5"]);
  for (const entry of Object.values(list.seeds) as { finalStateSha256: string; tick: number; since: string }[]) {
    assert.match(entry.finalStateSha256, /^[0-9a-f]{64}$/);
    assert.ok(Number.isInteger(entry.tick) && entry.since.length > 0);
  }
  assert.ok(list.updates.length > 0);
  for (const update of list.updates) assert.match(update.decision, /^[A-Z][A-Z0-9-]*-?\d+$/);
});

test("each seed reads same, different (with both hashes and ticks) or not listed", () => {
  const two = list.seeds["2"];
  const results = compareTrunkHashes([
    { seed: 2, finalStateSha256: two.finalStateSha256, tick: two.tick },
    { seed: 3, finalStateSha256: "0".repeat(64), tick: 1200000 },
    { seed: 4, finalStateSha256: null, tick: null },
    { seed: 9, finalStateSha256: "1".repeat(64), tick: 5 },
  ], list);
  assert.deepEqual(results.map(result => result.trunkHash), ["same", "different", "different", "not listed"]);
  assert.equal(results[0].line, `seed 2: trunk hash same (${two.finalStateSha256.slice(0, 8)}… tick 281,575)`);
  assert.match(results[1].line, /^seed 3: trunk hash DIFFERENT — expected 33b3d88a… tick 299,309 \(since .+\), this run 00000000… tick 1,200,000$/);
  assert.match(results[2].line, /this run none tick \?$/);
});
