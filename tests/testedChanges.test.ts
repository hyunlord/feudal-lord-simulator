import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { QUIET_ENV, QUIET_GIT, tempDir } from "./helpers/tempRepo";
import { pickTests, testedTree } from "../scripts/checks/changedTests.mjs";
import { checkTestedChanges, formatTestedChanges } from "../scripts/checks/testedChanges.mjs";

// RR16: test:changed picks the tests a change touches; check:merge accepts a push only with a passing record of the
// pushed content that covers them. A throwaway repository: src/b.ts <- src/a.ts <- tests/a.test.ts, a data file named by
// another test, and a document no test names.
function repo() {
  const dir = tempDir("fls-tested-");
  const git = (...args: string[]) => execFileSync("git", [...QUIET_GIT, ...args], { cwd: dir, encoding: "utf8", env: QUIET_ENV }).trim();
  for (const d of ["src", "tests", "docs", "fixtures"]) mkdirSync(join(dir, d));
  writeFileSync(join(dir, "src/b.ts"), "export const b = 1;\n");
  writeFileSync(join(dir, "src/a.ts"), 'import { b } from "./b.ts";\nexport const a = b + 1;\n');
  writeFileSync(join(dir, "tests/a.test.ts"), 'import { a } from "../src/a.ts";\n');
  writeFileSync(join(dir, "tests/data.test.ts"), 'const file = "fixtures/onlyHere.json";\n');
  writeFileSync(join(dir, "tests/other.test.ts"), "export {};\n");
  writeFileSync(join(dir, "fixtures/onlyHere.json"), "{}\n");
  writeFileSync(join(dir, "docs/notes.md"), "x\n");
  writeFileSync(join(dir, "package.json"), '{"scripts":{}}\n');
  git("init", "-q", "-b", "trunk"); git("add", "-A"); git("commit", "-qm", "base");
  return { dir, git, base: git("rev-parse", "HEAD") };
}

test("test:changed picks the tests importing a changed file through a chain, and those naming a changed data file", () => {
  const { dir, git, base } = repo();
  try {
    writeFileSync(join(dir, "src/b.ts"), "export const b = 2;\n");
    writeFileSync(join(dir, "fixtures/onlyHere.json"), '{"x":1}\n');
    writeFileSync(join(dir, "docs/notes.md"), "y\n");
    assert.deepEqual([...pickTests({ root: dir, base }).picked.keys()].sort(), ["tests/a.test.ts", "tests/data.test.ts"]);
    writeFileSync(join(dir, "package.json"), '{"scripts":{"x":"y"}}\n');
    assert.equal(pickTests({ root: dir, base }).picked.size, 2, "a new npm script picks nothing more");
    writeFileSync(join(dir, "package.json"), '{"scripts":{},"devDependencies":{"tsx":"4"}}\n');
    assert.equal(pickTests({ root: dir, base }).picked.size, 3, "a dependency change picks every test");
    git("checkout", "-q", "--", "package.json");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("check:merge's tested step: a passing record of exactly the pushed content is needed; documents alone need none", () => {
  const { dir, git, base } = repo();
  try {
    writeFileSync(join(dir, "docs/notes.md"), "only a document\n"); git("commit", "-qam", "doc");
    const docOnly = checkTestedChanges({ top: dir, work: dir, base, head: git("rev-parse", "HEAD") });
    assert.equal(docOnly.ok, true); assert.match(formatTestedChanges(docOnly), /no test picked/);

    writeFileSync(join(dir, "src/b.ts"), "export const b = 3;\n");
    const tree = testedTree(dir);                      // tested before the commit: the same content
    git("commit", "-qam", "code");
    const head = git("rev-parse", "HEAD");
    assert.equal(tree, git("rev-parse", "HEAD^{tree}"));
    const none = checkTestedChanges({ top: dir, work: dir, base, head });
    assert.equal(none.ok, false); assert.match(formatTestedChanges(none), /tests\/a\.test\.ts — no passing record ran it/);

    const write = (name: string, record: object) => { mkdirSync(join(dir, ".remote-runs", name), { recursive: true }); writeFileSync(join(dir, ".remote-runs", name, "test-changed.json"), JSON.stringify(record)); };
    write("failed-run", { tree, passed: false, picked: ["tests/a.test.ts"], tests: 1, pass: 0, at: "1" });
    assert.match(formatTestedChanges(checkTestedChanges({ top: dir, work: dir, base, head })), /FAILED/);
    write("dgx-run", { tree, passed: true, picked: ["tests/a.test.ts"], tests: 1, pass: 1, where: "DGX x", at: "2" });
    const ok = checkTestedChanges({ top: dir, work: dir, base, head });
    assert.equal(ok.ok, true); assert.match(formatTestedChanges(ok), /1 picked test file\(s\) passed on this content\n  1 on this content — 1\/1 at DGX x/);

    writeFileSync(join(dir, "src/b.ts"), "export const b = 4;\n"); git("commit", "-qam", "changed after the run");
    const later = checkTestedChanges({ top: dir, work: dir, base, head: git("rev-parse", "HEAD") });
    assert.equal(later.ok, false, "the test reads the file that changed after the run");
    // RR25, measured: a record of other content counts only by the inputs measured while its tests ran; these have none,
    // and the failed one, which cannot be compared either, blocks.
    assert.match(formatTestedChanges(later), /tests\/a\.test\.ts — FAILED on content it cannot be compared with/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
