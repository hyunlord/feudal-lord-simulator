import assert from "node:assert/strict";
import test from "node:test";

import { SAVE_SCHEMA_VERSION } from "../src/save/saveTypes";
import { declaredGameStateKeys, schemaShape } from "../src/save/schemaFingerprint";
import {
  currentFingerprint,
  diffPaths,
  FINGERPRINT_CHANGED_MESSAGE,
  readStoredFingerprint,
} from "../scripts/saveSchemaFingerprint";

test("saved game-state shape matches the fingerprint for this schema version", () => {
  const stored = readStoredFingerprint();
  assert.ok(stored !== null, "src/save/schemaFingerprint.v1.json is missing (npm run save:fingerprint)");
  const current = currentFingerprint();
  const diff = diffPaths(stored.paths, current.paths);
  assert.equal(current.sha256, stored.sha256,
    `${FINGERPRINT_CHANGED_MESSAGE}\nadded: ${diff.added.slice(0, 15).join(", ")}\nremoved: ${diff.removed.slice(0, 15).join(", ")}`);
  assert.equal(stored.schemaVersion, SAVE_SCHEMA_VERSION,
    "SAVE_SCHEMA_VERSION changed; regenerate the fingerprint (npm run save:fingerprint)");
});

test("the shape ignores values and content-keyed maps but sees new fields", () => {
  const base = schemaShape([{ tick: 1, inventory: { bread: 2 } }], ["tick"]);
  assert.deepEqual(schemaShape([{ tick: 99, inventory: { wheat: 5, timber: 1 } }], ["tick"]).paths, base.paths);
  assert.notDeepEqual(schemaShape([{ tick: 1, inventory: { bread: 2 }, extra: 0 }], ["tick"]).paths, base.paths);
  assert.notDeepEqual(schemaShape([{ tick: "1", inventory: { bread: 2 } }], ["tick"]).paths, base.paths);
  assert.notDeepEqual(schemaShape([{ tick: 1, inventory: { bread: 2 } }], ["tick", "optionalOnly"]).paths, base.paths);
  assert.ok(declaredGameStateKeys("export interface GameState {\n  tick: number;\n  readonly palisade?: X;\n}").includes("palisade"));
});
