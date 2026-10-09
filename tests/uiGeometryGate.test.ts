import assert from "node:assert/strict";
import test from "node:test";

import { checkUiGeometry, compareBaseline, gateMode, geometryInputs, overridesInRange, splitKey } from "../scripts/checks/uiGeometry.mjs";
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

test("Given the UI inputs When listed from git Then they hold the UI, styles, copy, audit and everything src/main.tsx imports (RR26 (가)), and no test or document", () => {
  const inputs = geometryInputs("HEAD", new URL("../", import.meta.url).pathname);
  const paths = inputs.map(line => line.slice(line.indexOf(" ") + 1));
  assert.ok(paths.includes("src/ui/surfaces.registry.ts") && paths.includes("scripts/uiGeometryAudit.mjs") && paths.includes("vite.config.ts"));
  assert.ok(paths.some(path => path.endsWith(".ko.ts") && path.startsWith("src/content/")));
  // The copy and data the UI renders, wherever they live, and the engine it imports (user ruling 2026-10-09).
  for (const path of ["src/ledger/ledgerCopy.ko.ts", "src/content/buildingConfig.ts", "src/zones/zoneCopy.ko.ts", "src/engine/tick.ts"]) assert.ok(paths.includes(path), path);
  assert.deepEqual(paths.filter(path => /^(tests|docs|fixtures)\//.test(path)), []);
});

test("Given a failing result When the warn override has no reason, or a reason the head commit does not record Then it is refused", () => {
  // 9409e410 carries a result from before the failure keys: never green.
  const cwd = new URL("../", import.meta.url).pathname;
  const bare = checkUiGeometry({ head: "9409e410", cwd, mode: "warn", env: { FLS_UI_GEOMETRY_GATE: "warn" } });
  assert.equal(bare.pass, false);
  assert.ok(bare.reasons.some(reason => reason.includes("FLS_UI_GEOMETRY_REASON")));
  const unrecorded = checkUiGeometry({ head: "9409e410", cwd, mode: "warn", env: { FLS_UI_GEOMETRY_GATE: "warn", FLS_UI_GEOMETRY_REASON: "the DGX is down tonight" } });
  assert.equal(unrecorded.pass, false);
  assert.ok(unrecorded.reasons.some(reason => reason.includes('--trailer "UI-Geometry-Override: the DGX is down tonight"')));
  assert.deepEqual(overridesInRange("9409e410~1", "9409e410", cwd), []);
});
