import assert from "node:assert/strict";
import test from "node:test";

import { cssCandidates, registeredClasses, subjectClassSets, treeReader, tsxCandidates, unregisteredSurfaces } from "../scripts/checks/surfaceRegistry.mjs";
import { SURFACES, VIEWPORTS } from "../src/ui/surfaces.registry";

// UI-AUDIT-1: every framed surface is in src/ui/surfaces.registry.ts (the geometry audit opens each row), and the
// registry itself is well formed. The same scan runs in check:merge on the pushed commit (scripts/checks/surfaceRegistry.mjs).
const ROOT = new URL("../", import.meta.url).pathname;

test("Given the UI sources When framed candidates are scanned Then every one is a registry row or a NOT_SURFACES entry", () => {
  const result = unregisteredSurfaces(treeReader(ROOT));
  assert.ok(result.candidates > 100, `only ${result.candidates} candidates: the scan lost its sources`);
  assert.deepEqual(result.missing.map(row => `${row.path}:${row.line} ${row.kind} ${row.names.join(".")}`), []);
});

test("Given an unregistered dialog, framed class and border-image rule When scanned Then each is reported at its line", () => {
  const registered = registeredClasses(`export const SURFACES = [{ root: ".known-card" }];\nexport const NOT_SURFACES = { "known-chip": "a button" };`);
  assert.ok(registered.has("known-card") && registered.has("known-chip"));
  const tsx = tsxCandidates("src/ui/x/New.tsx", [
    "// <div role=\"dialog\" className=\"in-a-comment-card\"> is ignored",
    "export function New() {",
    "  return <section className={`new-panel ${open ? \"new-panel--open\" : \"\"}`} role=\"dialog\" aria-modal=\"true\">",
    "    <span className=\"known-chip\">x</span><p className=\"plain-line\">y</p></section>;",
    "}",
  ].join("\n"));
  assert.deepEqual(tsx.map(row => `${row.line} ${row.kind} ${row.names.join(".")}`), ["3 class new-panel", "4 class known-chip", "3 dialog new-panel--open.new-panel"]);
  const css = cssCandidates("src/styles/x.css", "/* .old-card { border-image: url(a.png) 8 } */\n.app .new-drawer > p,\n.app :is(.a-seal, .b-seal) { border-image: url(\"/x.png\") 8 fill / 4px; }\n.quiet { border-image: none; }");
  assert.deepEqual(css.map(row => `${row.line} ${row.names.join(".")}`), ["2 new-drawer", "2 a-seal", "2 b-seal"]);
  assert.deepEqual(subjectClassSets(".a .b.c:not(.d) > span"), [["b", "c"]]);
});

test("Given the registry When its rows are read Then ids are unique, extends point back, frames carry what their kind needs", () => {
  const ids = new Set<string>();
  const byId = new Map(SURFACES.map(row => [row.id, row]));
  for (const row of SURFACES) {
    assert.ok(!ids.has(row.id), `duplicate ${row.id}`); ids.add(row.id);
    assert.ok(row.data.length > 0 && row.root.length > 0, row.id);
    if (row.extends !== undefined) {
      const parent = byId.get(row.extends);
      assert.ok(parent !== undefined, `${row.id} extends unknown ${row.extends}`);
      let root = parent; while (root.extends !== undefined) root = byId.get(root.extends)!;
      assert.deepEqual(row.scene, root.scene, `${row.id} opens in its chain's scene`);
    }
    if (row.frame === "layer") assert.ok(row.frameLayer !== undefined, `${row.id}: a layer frame names its layer`);
    if (row.frame === "painting") assert.ok(row.painting !== undefined, `${row.id}: a painting carries its safe rect`);
    if (row.portraitRing !== undefined) assert.equal(row.frame, "painting", `${row.id}: the ring is in art pixels of a painting`);
    for (const viewport of row.viewports ?? []) assert.ok(viewport in VIEWPORTS, `${row.id}: ${viewport}`);
    if (row.scene.kind !== "state") assert.equal(row.numbers, false, `${row.id}: no injected state, so no extreme numbers`);
  }
  assert.ok(SURFACES.length >= 55, `${SURFACES.length} rows (the survey counts about 55 with variants)`);
});
