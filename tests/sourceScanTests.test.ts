import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { pickTests, SOURCE_SCAN_WHY } from "../scripts/checks/changedTests.mjs";
import { NOT_SOURCE_SCAN, SOURCE_SCAN_TESTS } from "../scripts/checks/sourceScanTests.mjs";

// RR24: the tests that walk src/'s folders are picked by any src/ change (the import graph never reaches them).
const ROOT = new URL("..", import.meta.url).pathname;

test("the source-scan list is whole: a test that calls readdir and names a src path is listed or left out with a reason", () => {
  for (const file of [...SOURCE_SCAN_TESTS, ...Object.keys(NOT_SOURCE_SCAN)]) assert.ok(existsSync(join(ROOT, file)), `${file} is gone: take it off the list`);
  assert.deepEqual(SOURCE_SCAN_TESTS.filter(file => file in NOT_SOURCE_SCAN), [], "a test on both lists");
  const walkers = readdirSync(join(ROOT, "tests")).filter(name => /\.test\.(ts|tsx|mts|mjs|js)$/.test(name)).map(name => `tests/${name}`)
    .filter(file => { const text = readFileSync(join(ROOT, file), "utf8"); return /readdir/.test(text) && /["'`](?:\.\.\/)?src(?:\/[^"'`]*)?["'`]/.test(text); });
  const unlisted = walkers.filter(file => !SOURCE_SCAN_TESTS.includes(file) && !(file in NOT_SOURCE_SCAN));
  assert.deepEqual(unlisted, [], "add each to SOURCE_SCAN_TESTS, or to NOT_SOURCE_SCAN with the reason (scripts/checks/sourceScanTests.mjs)");
});

test("a src/ change picks the source scans that exist; a change outside src/ does not", () => {
  const dir = mkdtempSync(join(tmpdir(), "fls-scan-"));
  const git = (...args: string[]) => execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd: dir, encoding: "utf8" }).trim();
  try {
    for (const d of ["src/engine", "tests", "docs"]) mkdirSync(join(dir, d), { recursive: true });
    writeFileSync(join(dir, "src/engine/petitions.ts"), "/** the earlier definition period. */\nexport const p = 1;\n");
    writeFileSync(join(dir, "tests/phase3Architecture.test.ts"), "export {};\n");   // walks src/, imports nothing
    writeFileSync(join(dir, "tests/other.test.ts"), "export {};\n");
    writeFileSync(join(dir, "src/App.tsx"), "export const onNewGame = (scenarioId: string, land: string) => scenarioId + land;\n");
    writeFileSync(join(dir, "tests/appText.test.ts"), 'const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");\n');
    writeFileSync(join(dir, "docs/notes.md"), "x\n");
    git("init", "-q", "-b", "trunk"); git("add", "-A"); git("commit", "-qm", "base");
    const base = git("rev-parse", "HEAD");
    writeFileSync(join(dir, "docs/notes.md"), "y\n");
    assert.deepEqual([...pickTests({ root: dir, base }).picked.keys()], [], "a document alone picks nothing");
    writeFileSync(join(dir, "src/engine/petitions.ts"), "/** the earlier definition window. */\nexport const p = 1;\n");
    const picked = pickTests({ root: dir, base }).picked;
    assert.deepEqual([...picked.keys()], ["tests/phase3Architecture.test.ts"]);
    assert.ok(picked.get("tests/phase3Architecture.test.ts")!.startsWith(SOURCE_SCAN_WHY));
    // A test that reads a source file as text by its path (e77841161 → tests/chapterLoadingStore.test.ts).
    writeFileSync(join(dir, "src/App.tsx"), "export const onNewGame = (scenarioId: string, land: string, house: string) => scenarioId + land + house;\n");
    assert.equal(pickTests({ root: dir, base }).picked.get("tests/appText.test.ts"), "names src/App.tsx");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
