import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

// BLD-REG gate ①: a new building kind is the engine's rules for it (its `BuildingKind`, its definition, its builder
// ticks, the stage that unlocks it and the cases of the engine's switches over construction site kinds — the engine
// session's lines) and one line in the building catalog plus one in its
// words: no UI or render file changes. The test copies the sources, adds a kind with no picture, no glyph and no body,
// type-checks the sources and the render and menu tests on the copy, runs them, and a probe that the new kind is in
// the menu and takes the fallbacks (its category's glyph, no thumbnail, the timber body, the name chip).
// The engine's own tests pin its rules for every kind (recipes, builder ticks): they are the engine session's to extend
// with the kind, so the copy's type check leaves them out.
const ROOT = resolve(import.meta.dirname, "..");
// [file, anchor, text put before it (every occurrence when `all`)].
type Insert = readonly [string, string, string, boolean?];
const ENGINE_LINES: readonly Insert[] = [
  ["src/content/buildingConfig.ts", '  | "keep"', '  | "test_hall"\n'],
  ["src/content/buildingConfig.ts", "  keep: {\n    kind: \"keep\",", `  test_hall: {
    kind: "test_hall",
    name: "시험 회관",
    width: 1,
    height: 1,
    workersRequired: 0,
    buildCost: { timber: 10 },
    requiresAdjacentTerrain: null,
    requiresRoad: true,
    production: null,
    storageCapacity: 0,
    serviceRadius: 0,
  },
`],
  ["src/economy/constructionSites.ts", "    keep: 1200,", "    test_hall: 300,\n"],
  ["src/content/scenario/coreScenarios.ts", '"keep"],', '"test_hall", '],
  // C4: the construction sites read the kind from BUILDING_CONFIG_BY_KIND (no switch over the kinds to extend).
];
const CATALOG_LINES: readonly Insert[] = [
  ["src/content/buildingCatalog.ts", "  keep: { category:", '  test_hall: { category: "public", group: "service" },\n'],
  ["src/content/buildingCatalog.ko.ts", "  keep: { name:", '  test_hall: { name: "시험 회관", card: "확장성 시험", purpose: "확장성 시험의 가짜 건물", inspector: "확장성 시험의 가짜 건물", worldTarget: "여기에 시험 회관을 지으세요", history: "시험 회관" },\n'],
];
// The tests that read every building from the catalog: the catalog's own, the build menu, its categories and
// contracts, the inspector, the onboarding markers, placement cards, facility art, kits, signs and rendering.
const TESTS = [
  "buildingCatalog", "buildMenuContracts", "buildMenuCategoryIntent", "historicalFacilityAssets", "constructionKits", "visibilitySigns",
  "onboardingWorldGuidance", "placementPrediction", "predictionPresentation", "diagnosticCard", "buildingEconomyRendering", "phase35Rendering",
  "phase35HoverInspector", "courtConsoleContracts", "stoneTownBuildings", "palisadeMenuHint", "placementPreviewEmphasis",
];
const PROBE = `import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildingGlyph } from "../src/content/buildingCatalog";
import { buildingHistoryName } from "../src/content/buildingCatalog.ko";
import { buildingHasPicture, drawBuildingNameChip } from "../src/render/buildingNameChip";
import { buildingBodyProfile } from "../src/render/buildingVisualState";
import { BuildGlyph } from "../src/ui/BuildGlyph";
import { BUILD_TOOL_OPTIONS } from "../src/ui/buildMenuModel";
import { buildCategory, buildThumbnail } from "../src/ui/buildMenuPresentation";

test("the added building is in the menu and takes the fallbacks: its category's glyph, no thumbnail, a timber body, its name chip", () => {
  const option = BUILD_TOOL_OPTIONS.find(entry => entry.tool === "test_hall");
  assert.ok(option !== undefined);
  assert.equal(option.label, "시험 회관");
  assert.equal(option.purpose, "확장성 시험의 가짜 건물");
  assert.equal(option.group, "service");
  assert.equal(buildCategory("test_hall"), "public");
  assert.equal(buildingGlyph("test_hall"), "chapel");
  assert.match(renderToStaticMarkup(createElement(BuildGlyph, { tool: "test_hall" })), /<path d="M12 3v5"/);
  assert.equal(buildThumbnail("test_hall"), null);
  assert.equal(buildingHasPicture("test_hall"), false);
  assert.equal(buildingBodyProfile("test_hall", 0).width, 36);
  assert.equal(buildingHistoryName("test_hall"), "시험 회관");
  const written: string[] = [];
  const context = new Proxy({}, { get: (_target, key) => key === "measureText" ? () => ({ width: 40 }) : key === "fillText" ? (text: string) => { written.push(text); }
    : () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;
  drawBuildingNameChip(context, "test_hall", { x: 0, y: 0 }, 38, 1);
  assert.deepEqual(written, ["시험 회관"]);
});
`;

function insertBefore(path: string, anchor: string, line: string, all = false): void {
  const text = readFileSync(path, "utf8");
  assert.ok(text.includes(anchor), `${path}: anchor ${anchor} missing`);
  writeFileSync(path, all ? text.replaceAll(anchor, line + anchor) : text.replace(anchor, line + anchor));
}

test("one catalog line adds a building: the copy type-checks and its render and menu tests pass with no UI or render file changed", { timeout: 600_000 }, (context) => {
  const copy = mkdtempSync(join(tmpdir(), "fls-bldreg-"));
  try {
    for (const name of ["src", "scripts"]) cpSync(join(ROOT, name), join(copy, name), { recursive: true });
    cpSync(join(ROOT, "tests"), join(copy, "tests"), { recursive: true, filter: source => !source.startsWith(join(ROOT, "tests", "fixtures")) });
    // Everything else (node_modules, public, fixtures, seeds, tools…) is read-only for the check: linked, not copied.
    for (const name of readdirSync(ROOT)) if (!name.startsWith(".") && !["src", "scripts", "tests"].includes(name)) symlinkSync(realpathSync(join(ROOT, name)), join(copy, name));
    symlinkSync(realpathSync(join(ROOT, "tests", "fixtures")), join(copy, "tests", "fixtures"));
    for (const [file, anchor, line, all] of [...ENGINE_LINES, ...CATALOG_LINES]) insertBefore(join(copy, file), anchor, line, all);
    writeFileSync(join(copy, "tests/buildingCatalogAddedBuilding.test.ts"), PROBE);

    const files = [...TESTS.map(name => `tests/${name}.test.ts`), "tests/buildingCatalogAddedBuilding.test.ts"];
    // The copy's sources and these tests (the engine's rule pins over every kind are left out, see above).
    writeFileSync(join(copy, "tsconfig.bldreg.json"), JSON.stringify({ extends: "./tsconfig.json", include: ["src", "vite.config.ts", ...files] }));
    const tsc = spawnSync(join(ROOT, "node_modules/.bin/tsc"), ["--noEmit", "-p", "tsconfig.bldreg.json"], { cwd: copy, encoding: "utf8" });
    assert.equal(tsc.status, 0, `tsc on the copy with the added building:\n${tsc.stdout}${tsc.stderr}`);

    // The copy's runner reports on its own stdout, not to this runner (which it would join through NODE_TEST_CONTEXT).
    const { NODE_TEST_CONTEXT: _parent, ...env } = process.env;
    const run = spawnSync(join(ROOT, "node_modules/.bin/tsx"), ["--test", "--test-reporter=spec", ...files], { cwd: copy, encoding: "utf8", env });
    const summary = /ℹ pass (\d+)[\s\S]*?ℹ fail (\d+)/.exec(run.stdout);
    assert.equal(run.status, 0, `render and menu tests on the copy:\n${run.stdout.split("\n").filter(line => line.startsWith("✖") || line.includes("Error")).slice(0, 40).join("\n")}`);
    assert.ok(summary !== null && Number(summary[1]) > 0 && summary[2] === "0", run.stdout.slice(-2_000));
    context.diagnostic(`copy with test_hall: tsc clean, ${summary[1]} tests in ${files.length} files pass`);
  } finally {
    rmSync(copy, { recursive: true, force: true });
  }
});
