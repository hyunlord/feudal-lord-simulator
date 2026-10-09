import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { QUIET_GIT, tempDir } from "./helpers/tempRepo";
import { pickTests, SOURCE_SCAN_WHY } from "../scripts/checks/changedTests.mjs";
import { FOLDER_WALKS } from "../scripts/checks/sourceScanTests.mjs";

// RR24, RR25: a test that walks a folder is picked by any change under it (the import graph never reaches what it walks).
const ROOT = new URL("..", import.meta.url).pathname;

test("the folder map is whole: every test that walks or copies folders is in it, and every folder it names exists", () => {
  for (const [file, folders] of Object.entries(FOLDER_WALKS)) {
    assert.ok(existsSync(join(ROOT, file)), `${file} is gone: take it off the map`);
    for (const folder of folders) assert.ok(existsSync(join(ROOT, folder)), `${file}: ${folder} does not exist`);
  }
  const walkers = readdirSync(join(ROOT, "tests")).filter(name => /\.test\.(ts|tsx|mts|mjs|js)$/.test(name)).map(name => `tests/${name}`)
    .filter(file => /\b(readdir|readdirSync|opendir|opendirSync|globSync|cpSync)\b/.test(readFileSync(join(ROOT, file), "utf8")));
  assert.deepEqual(walkers.filter(file => !(file in FOLDER_WALKS)), [], "add each to FOLDER_WALKS with the folders it walks (scripts/checks/sourceScanTests.mjs)");
});

test("a src/ change picks the source scans that exist; a change outside src/ does not", () => {
  const dir = tempDir("fls-scan-");
  const git = (...args: string[]) => execFileSync("git", [...QUIET_GIT, ...args], { cwd: dir, encoding: "utf8" }).trim();
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
