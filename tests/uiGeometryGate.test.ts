import assert from "node:assert/strict";
import test from "node:test";

import { compareBaseline, gateMode, geometryInputs, splitKey, UI_INPUT_ROOTS } from "../scripts/checks/uiGeometry.mjs";
import { failureKey } from "../scripts/uiGeometryMeasure";

// UI-AUDIT-1: the geometry gate's baseline (scripts/checks/uiGeometry.mjs): new failures fail, fixed ones must be
// dropped, an exception covers its row and check wherever the path matches and must match something.
const key = (row: string, condition: string, check: string, path: string) => `${row}|${condition}|${check}|${path}`;
const strip = "section.chronicle-world > ol.chronicle-world-strip";
const exception = { row: "modal.history.factions", check: "overflow", match: "chronicle-world-strip", reason: "a designed sideways strip" };

test("Given a failure's check and path When keyed Then the key has no px and splits back into its parts", () => {
  assert.equal(failureKey({ check: "outside", path: "aside.card > p" }), "outside|aside.card > p");
  assert.deepEqual(splitKey(key("hud.x", "1280x800/normal/normal", "overlap", "a ✕ b|c")), { row: "hud.x", condition: "1280x800/normal/normal", check: "overlap", path: "a ✕ b|c" });
});

test("Given a run against its baseline When one failure is new and one is gone Then the new one is added and the gone one is fixed", () => {
  const baseline = [key("a", "c1", "outside", "p"), key("a", "c1", "border", "button")];
  const result = compareBaseline({ keys: [key("a", "c1", "outside", "p"), key("a", "c2", "outside", "p")], baseline });
  assert.deepEqual(result.added, [key("a", "c2", "outside", "p")]);
  assert.deepEqual(result.fixed, [key("a", "c1", "border", "button")]);
  assert.equal(result.failures, 2);
});

test("Given an exception When its row, check and path fragment match Then it covers every condition, and an unused one is stale", () => {
  const keys = [key(exception.row, "1280x800/normal/normal", "overflow", strip), key(exception.row, "tablet-1180x820/long/extreme", "overflow", strip),
    key(exception.row, "1280x800/normal/normal", "outside", strip)];
  const result = compareBaseline({ keys, baseline: [keys[2]!], exceptions: [exception] });
  assert.equal(result.excepted, 2);
  assert.deepEqual(result.counted, [keys[2]]);
  assert.deepEqual(result.added, []);
  assert.deepEqual(result.staleExceptions, []);
  assert.deepEqual(compareBaseline({ keys: [keys[2]!], baseline: [keys[2]!], exceptions: [exception] }).staleExceptions, [exception]);
});

test("Given the gate When no override is set Then it enforces (the user's decision), and the environment can ask for a report only", () => {
  assert.equal(gateMode({}), "enforce");
  assert.equal(gateMode({ FLS_UI_GEOMETRY_GATE: "warn" }), "warn");
});

test("Given the UI inputs When listed from git Then they hold the UI, styles, copy and audit, and none of the engine", () => {
  const inputs = geometryInputs("HEAD", new URL("../", import.meta.url).pathname);
  const paths = inputs.map(line => line.slice(line.indexOf(" ") + 1));
  assert.ok(paths.includes("src/ui/surfaces.registry.ts") && paths.includes("scripts/uiGeometryAudit.mjs") && paths.includes("vite.config.ts"));
  assert.ok(paths.some(path => path.endsWith(".ko.ts") && path.startsWith("src/content/")));
  assert.deepEqual(paths.filter(path => /^src\/(engine|sim|ledger|state)\//.test(path) || (path.startsWith("src/content/") && !path.endsWith(".ko.ts"))
    || (path.startsWith("src/render/") && !path.endsWith(".tsx"))), []);
  assert.ok(UI_INPUT_ROOTS.every(item => !item.root.startsWith("src/engine")));
});
