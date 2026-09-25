import assert from "node:assert/strict";
import { migrateStateV10ToV11 } from "../src/save/migrations/v10ToV11";
import { migrateStateV9ToV10 } from "../src/save/migrations/v9ToV10";
import { readFileSync } from "node:fs";
import test from "node:test";
import { advanceTick } from "../src/engine/tick";
import { placementSpendableResource } from "../src/world/placement";
import { decodeSave } from "../src/save/saveCodec";
import { SAVE_SCHEMA_VERSION } from "../src/save/saveTypes";
import { canonicalStateHash } from "../scripts/verifySaveDeterminism";

test("schema v1 reaches the latest schema without inventing timber observation history", () => {
  const bytes = new Uint8Array(readFileSync("fixtures/saves/v1/population-176.save.json"));
  const original = JSON.parse(new TextDecoder().decode(bytes));
  const { envelope, migratedFrom } = decodeSave(bytes);
  assert.ok(SAVE_SCHEMA_VERSION >= 3);
  assert.equal(migratedFrom, 1);
  assert.equal(envelope.schemaVersion, SAVE_SCHEMA_VERSION);
  // v4 -> v5 adds only the default scenario (spec SC-14); v5 -> v6 adds only empty zones (spec Z-1);
  // v6 -> v7 swaps the income window for a ledger holding the opening balance (spec L-9).
  const { coinLedger: _coinLedger, ...originalRest } = original.state;
  // v9 -> v10 turns its wheat farms into arable fields and farmsteads (spec AF-12); v10 -> v11 adds households (LB-10).
  assert.deepEqual(envelope.state, migrateStateV10ToV11(migrateStateV9ToV10({ ...originalRest, scenarioId: "core:campaign_market_town", zones: [], nextZoneOrdinal: 1,
    ledger: { entries: [{ id: "ledger-000001", tick: original.state.tick, account: "cash", category: "opening_balance", amount: original.state.treasuryCoin,
    sourceRefs: [{ type: "scenario", id: "core:campaign_market_town", detail: "save_v6" }] }], rollups: [], nextEntryOrdinal: 2 } })));
  const next = advanceTick({ ...envelope.state, wallConstructionPriority: "balanced",
    wallConstructionReserve: { resource: "timber", sources: [], proclaimedTick: envelope.state.tick } });
  assert.equal(next.timberProductionWindow?.availableTimber, placementSpendableResource(next, "timber"));
  assert.equal(next.timberProductionWindow?.lastAvailableIncreaseTick, next.tick);
});

test("schema v1 corruption is rejected before migration", () => {
  const text = readFileSync("fixtures/saves/v1/population-176.save.json", "utf8");
  const corrupted = text.replace(/"treasuryTimber":\d+/, '"treasuryTimber":999999');
  assert.notEqual(corrupted, text);
  assert.throws(() => decodeSave(new TextEncoder().encode(corrupted)), /checksum mismatch/);
  for (const checksum of [123, null, {}]) {
    const malformed = { ...JSON.parse(corrupted), checksum };
    assert.throws(() => decodeSave(new TextEncoder().encode(JSON.stringify(malformed))), /checksum must be a string/);
  }
});

test("gameplay determinism excludes only the root path cache", () => {
  const state = { tick: 12, treasuryTimber: 34, pathCache: { route: [{ tx: 1, ty: 2 }] } };
  assert.equal(canonicalStateHash(state), canonicalStateHash({ ...state, pathCache: {} }));
  assert.notEqual(canonicalStateHash(state), canonicalStateHash({ ...state, treasuryTimber: 35 }));
  assert.notEqual(canonicalStateHash({ nested: { pathCache: 1 } }), canonicalStateHash({ nested: { pathCache: 2 } }));
});
