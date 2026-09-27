import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

// RES-REG gate ①: a good added as one line to the catalog (and its name to the .ko list) type-checks and draws with no
// other file changed. The test copies the sources, adds a storehouse good with no picture, runs tsc on the copy, then
// the render and UI tests that walk the goods, plus a probe that the new good takes the generic sacks / crates path.
const ROOT = resolve(import.meta.dirname, "..");
const FAKE_LINE = '  { id: "test_ore", storage: "storehouse", group: "raw", hudPriority: 8, carrier: "quarryman", color: "stone", bulk: 1 },\n';
const FAKE_COPY = '  test_ore: { name: "시험 광석", unit: "덩이", short: "확장성 시험의 가짜 자원" },\n';
// The tests that read every good from the catalog: the catalog's own, walkers, the ledger, the HUD, costs and cards.
const TESTS = [
  "resourceCatalog", "walkerRendering", "walkerPresentation", "phase9Config", "economyUi", "resourceBar", "ledgerModel",
  "placementLedgerChip", "statusPillFood", "buildMenuContracts", "constructionSiteCardModel", "problemCauseModel",
  "alertStack", "inspectorModel", "seasonLedgerScenes", "walkerComposer", "personsOnScreen",
];
const PROBE = `import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RESOURCE_TYPES, STORAGE_KIND_BY_RESOURCE } from "../src/content/resourceConfig";
import { resourceName } from "../src/content/resourceCatalog.ko";
import { cartLoadArt } from "../src/render/drawWalkers";
import { ResourceArtwork } from "../src/ui/ResourceArtwork";

test("the added good is in the lists and falls back to the generic crates and its name", () => {
  assert.ok(RESOURCE_TYPES.includes("test_ore"));
  assert.equal(STORAGE_KIND_BY_RESOURCE.test_ore, "storehouse");
  assert.equal(resourceName("test_ore"), "시험 광석");
  assert.equal(cartLoadArt("test_ore", "NE")?.key, "pile_crates_1");
  const markup = renderToStaticMarkup(createElement(ResourceArtwork, { kind: "test_ore" }));
  assert.match(markup, /wave7\\/pile\\/crates_1-v1\\.png/);
  assert.match(markup, /<span class="resource-name-chip">시험 광석<\\/span>/);
});
`;

function insertBefore(path: string, anchor: string, line: string): void {
  const text = readFileSync(path, "utf8");
  assert.ok(text.includes(anchor), `${path}: anchor ${anchor} missing`);
  writeFileSync(path, text.replace(anchor, line + anchor));
}

test("one catalog line adds a good: the copy type-checks and its render tests pass with no other file changed", { timeout: 600_000 }, (context) => {
  const copy = mkdtempSync(join(tmpdir(), "fls-resreg-"));
  try {
    for (const name of ["src", "scripts"]) cpSync(join(ROOT, name), join(copy, name), { recursive: true });
    cpSync(join(ROOT, "tests"), join(copy, "tests"), { recursive: true, filter: source => !source.startsWith(join(ROOT, "tests", "fixtures")) });
    // Everything else (node_modules, public, fixtures, seeds, tools…) is read-only for the check: linked, not copied.
    for (const name of readdirSync(ROOT)) if (!name.startsWith(".") && !["src", "scripts", "tests"].includes(name)) symlinkSync(realpathSync(join(ROOT, name)), join(copy, name));
    symlinkSync(realpathSync(join(ROOT, "tests", "fixtures")), join(copy, "tests", "fixtures"));
    insertBefore(join(copy, "src/content/resourceCatalog.ts"), '  { id: "coin",', FAKE_LINE);
    insertBefore(join(copy, "src/content/resourceCatalog.ko.ts"), "  coin: {", FAKE_COPY);
    writeFileSync(join(copy, "tests/resourceCatalogAddedGood.test.ts"), PROBE);

    const tsc = spawnSync(join(ROOT, "node_modules/.bin/tsc"), ["--noEmit", "-p", "tsconfig.json"], { cwd: copy, encoding: "utf8" });
    assert.equal(tsc.status, 0, `tsc on the copy with the added good:\n${tsc.stdout}${tsc.stderr}`);

    const files = [...TESTS.map(name => `tests/${name}.test.ts`), "tests/resourceCatalogAddedGood.test.ts"];
    // The copy's runner reports on its own stdout, not to this runner (which it would join through NODE_TEST_CONTEXT).
    const { NODE_TEST_CONTEXT: _parent, ...env } = process.env;
    const run = spawnSync(join(ROOT, "node_modules/.bin/tsx"), ["--test", "--test-reporter=spec", ...files], { cwd: copy, encoding: "utf8", env });
    const summary = /ℹ pass (\d+)[\s\S]*?ℹ fail (\d+)/.exec(run.stdout);
    assert.equal(run.status, 0, `render tests on the copy:\n${run.stdout.split("\n").filter(line => line.startsWith("✖") || line.includes("Error")).slice(0, 40).join("\n")}`);
    assert.ok(summary !== null && Number(summary[1]) > 0 && summary[2] === "0", run.stdout.slice(-2_000));
    context.diagnostic(`copy with test_ore: tsc clean, ${summary[1]} tests in ${files.length} files pass`);
  } finally {
    rmSync(copy, { recursive: true, force: true });
  }
});
