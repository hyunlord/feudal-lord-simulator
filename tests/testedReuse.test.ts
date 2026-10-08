import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { testedTree } from "../scripts/checks/changedTests.mjs";
import { checkTestedChanges, formatTestedChanges } from "../scripts/checks/testedChanges.mjs";

// RR25 (user ruling 2026-10-09): a picked test keeps an earlier passing result when no file changed since that result's
// content is one it reads (imports, directly or through other files, or names by its path; the source-scan list; the
// lock files); otherwise only that test runs again. Each case below is made to overlap on purpose (RR22: a gate rule is
// tried with cases built to break it). The story of each: the trunk, a branch that changes the engine, a passing
// test:changed record of the branch, then the trunk moves and the branch merges it (the long gate's race).
const APP = Array.from({ length: 12 }, (_, i) => `export const line${i} = ${i};`).join("\n") + "\n";

function story(trunkMove: (write: (path: string, text: string) => void, remove: (path: string) => void) => void) {
  const dir = mkdtempSync(join(tmpdir(), "fls-reuse-"));
  const git = (...args: string[]) => execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd: dir, encoding: "utf8" }).trim();
  const write = (path: string, text: string) => { mkdirSync(dirname(join(dir, path)), { recursive: true }); writeFileSync(join(dir, path), text); };
  const remove = (path: string) => unlinkSync(join(dir, path));
  write(".gitignore", "/.remote-runs/\n");   // as in the repository: the records are never content
  write("package.json", '{"scripts":{}}\n'); write("package-lock.json", "{}\n"); write("docs/notes.md", "x\n");
  write("src/engine/core.ts", "export const core = 1;\n");
  write("src/engine/data.ts", "export const data = 1;\n");
  write("src/engine/extra.ts", "export const extra = 1;\n");
  write("src/engine/rules.ts", 'import { core } from "./core.ts";\nimport { data } from "./data.ts";\nexport const rules = core + data;\n');
  write("src/ui/panel.tsx", "export const panel = 1;\n");
  write("src/App.tsx", APP);
  write("tests/engine.test.ts", 'import { rules } from "../src/engine/rules.ts";\nimport { extra } from "../src/engine/extra";\n');
  write("tests/panel.test.ts", 'import { panel } from "../src/ui/panel.tsx";\n');
  write("tests/appText.test.ts", 'const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");\n');
  write("tests/phase3Architecture.test.ts", "export {};\n");   // on the source-scan list: walks src/, imports nothing
  git("init", "-q", "-b", "trunk"); git("add", "-A"); git("commit", "-qm", "trunk");
  const trunk0 = git("rev-parse", "HEAD");
  git("checkout", "-qb", "branch");
  write("src/engine/core.ts", "export const core = 2;\n");                         // the branch's engine change
  write("src/App.tsx", APP.replace("line0 = 0", "line0 = 100"));                   // and a line of App.tsx
  git("commit", "-qam", "branch: engine and App");
  const record = (name: string, picked: string[]) => {
    const tree = testedTree(dir);
    write(`.remote-runs/${name}/test-changed.json`, JSON.stringify({ tree, passed: true, picked, tests: picked.length, pass: picked.length, where: name, at: new Date().toISOString() }));
  };
  // The long gate: every test the branch picks passed on the branch's content.
  record("gate", ["tests/appText.test.ts", "tests/engine.test.ts", "tests/phase3Architecture.test.ts"]);
  git("checkout", "-q", "trunk"); trunkMove(write, remove); git("add", "-A"); git("commit", "-qm", "trunk moves");
  const trunk1 = git("rev-parse", "HEAD");
  git("checkout", "-q", "branch"); git("merge", "-q", "--no-edit", "trunk");
  const check = () => checkTestedChanges({ top: dir, work: dir, base: trunk1, head: git("rev-parse", "HEAD") });
  return { dir, git, write, record, check, trunk0, done: () => rmSync(dir, { recursive: true, force: true }) };
}

const uncovered = (result: ReturnType<typeof checkTestedChanges>) => [...(result.uncovered ?? [])].sort();

test("no overlap: the trunk changed only a document — every result is kept, the output says no overlap", () => {
  const s = story(write => write("docs/notes.md", "moved\n"));
  try {
    const result = s.check();
    assert.equal(result.ok, true);
    assert.match(formatTestedChanges(result), /3 reused, no overlap: 1 file\(s\) changed since the run's content [0-9a-f]{8} \(gate, .*\), none read by them/);
  } finally { s.done(); }
});

test("overlap by a direct import: the trunk changed rules.ts, which engine.test imports — only engine.test runs again", () => {
  const s = story(write => write("src/engine/rules.ts", 'import { core } from "./core.ts";\nimport { data } from "./data.ts";\nexport const rules = core * data;\n'));
  try {
    const result = s.check();
    assert.equal(result.ok, false);
    // phase3Architecture walks src/ (RR24), so any src/ change is an overlap for it too.
    assert.deepEqual(uncovered(result), ["tests/engine.test.ts", "tests/phase3Architecture.test.ts"]);
    const text = formatTestedChanges(result);
    assert.match(text, /tests\/engine\.test\.ts — reads src\/engine\/rules\.ts \(changed since /);
    assert.match(text, /1 reused, no overlap/);   // appText.test reads App.tsx, which the trunk did not change
  } finally { s.done(); }
});

test("overlap through other files: the trunk changed data.ts, which rules.ts imports — engine.test runs again", () => {
  const s = story(write => write("src/engine/data.ts", "export const data = 7;\n"));
  try {
    const result = s.check();
    assert.ok(uncovered(result).includes("tests/engine.test.ts"));
    assert.deepEqual(result.overlaps?.get("tests/engine.test.ts")?.files, ["src/engine/data.ts"]);
  } finally { s.done(); }
});

test("overlap by a path read as text: the trunk changed another line of App.tsx — appText.test runs again", () => {
  const s = story(write => write("src/App.tsx", APP.replace("line11 = 11", "line11 = 111")));
  try {
    const result = s.check();
    assert.ok(uncovered(result).includes("tests/appText.test.ts"));
    assert.match(formatTestedChanges(result), /tests\/appText\.test\.ts — reads src\/App\.tsx/);
    assert.ok(!uncovered(result).includes("tests/engine.test.ts"), "engine.test reads nothing the trunk changed");
  } finally { s.done(); }
});

test("overlap by a deleted file: the trunk deleted extra.ts, which engine.test still imports — engine.test runs again", () => {
  const s = story((_write, remove) => remove("src/engine/extra.ts"));
  try {
    const result = s.check();
    assert.ok(uncovered(result).includes("tests/engine.test.ts"), "an import that no longer resolves is an overlap");
    assert.deepEqual(result.overlaps?.get("tests/engine.test.ts")?.files, ["src/engine/extra.ts"]);
  } finally { s.done(); }
});

test("overlap by the lock file: the trunk changed package-lock.json — every test runs again", () => {
  const s = story(write => write("package-lock.json", '{"lockfileVersion":3}\n'));
  try {
    assert.deepEqual(uncovered(s.check()), ["tests/appText.test.ts", "tests/engine.test.ts", "tests/phase3Architecture.test.ts"]);
  } finally { s.done(); }
});

test("overlap by the branch's own later edit: core.ts changed after the gate's run — engine.test runs again", () => {
  const s = story(write => write("docs/notes.md", "moved\n"));
  try {
    s.write("src/engine/core.ts", "export const core = 3;\n"); s.git("commit", "-qam", "branch: one more engine edit");
    assert.ok(uncovered(s.check()).includes("tests/engine.test.ts"));
  } finally { s.done(); }
});

test("only the overlapping tests run again, and the reused and the new record together cover the push", () => {
  const s = story(write => write("src/engine/data.ts", "export const data = 7;\n"));
  try {
    const before = s.check();
    assert.deepEqual(uncovered(before), ["tests/engine.test.ts", "tests/phase3Architecture.test.ts"]);
    s.record("rerun", uncovered(before));   // test:changed after the merge runs just these two
    const after = s.check();
    assert.equal(after.ok, true);
    const text = formatTestedChanges(after);
    assert.match(text, /2 on this content — 2\/2 at rerun/);
    assert.match(text, /1 reused, no overlap: 1 file\(s\) changed since the run's content/);
  } finally { s.done(); }
});
