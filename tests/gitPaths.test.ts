import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { gitIn, KOREAN_PATH, tempDir, writeKoreanFile } from "./helpers/tempRepo";
import { gitPaths, gitPathsOut, gitText } from "../scripts/gitPaths.mjs";
import { scriptFiles, unsafeGitPathCalls } from "../scripts/checks/gitPathCalls.mjs";
import { addedLines, lineChanges } from "../scripts/checks/gitRange.mjs";
import { findExceptions } from "../scripts/checks/lintExceptions.mjs";

// Korean path names regressed three times (the gate's log parse, path quotes, the DGX run folder's file list,
// nightly-GEOMETRY-1011-eeae4c8): every git call in scripts/ that lists paths goes through scripts/gitPaths.mjs, and the
// shell scripts carry -c core.quotePath=false or -z on the call (user order 2026-10-11).

test("no git call in scripts/ lists paths around scripts/gitPaths.mjs (shell: -c core.quotePath=false or -z on the call)", () => {
  const found = unsafeGitPathCalls(scriptFiles());
  assert.deepEqual(found.map(call => `${call.path}:${call.line} ${call.why}: ${call.text}`), []);
});

test("the scan finds each way around the helper and lets the helper's calls, messages and other words pass", () => {
  const files = new Map([
    ["scripts/a.mjs", [
      "const a = execFileSync('git', ['ls-files', '-z'], { cwd });",                          // 1 a listing call of its own
      "const b = git(['diff', '--name-only', base, head], cwd);",                              // 2 a wrapper
      'const c = git("status", "--porcelain");',                                               // 3 status by its option
      "const d = run(['status'], 'git');",                                                     // 4 status on a line naming git
      "const e = execSync(`git log --name-only ${base}..${head}`);",                         // 5 a command line run as a string
      "const h = git(['grep', '-l', 'x', head], cwd);",                                       // 6 git grep names files (review RR27)
      "const i = execFileSync('git', [",                                                      // 7 arguments past the line
      "const f = gitPaths(['ls-files', '--others'], { cwd });",                                // the helper
      "const g = gitText(['diff', '--numstat', base], { cwd });",                              // the helper
      "console.log(`check git diff --stat, then commit`);",                                    // a message to a person
      'const columns = ["status", "file"];',                                                   // a word, no git
      "// git ls-files lists them",                                                            // a comment
      "const j = gitText(['grep', '-n', 'x', head], { cwd });",                                // the helper
    ].join("\n")],
    ["scripts/b.sh", [
      'git ls-tree -r --name-only "$sha" > list.txt',                                          // 1 shell, quoted names
      '[ -z "$(git status --porcelain)" ] || DIRTY=1',                                         // 2 the test's -z is no git -z
      'git -c core.quotePath=false ls-files -co --exclude-standard',                            // safe
      'git status --porcelain -z | tr "\\0" "\\n"',                                             // safe
      '# git ls-files in a comment',
      'git grep -l TODO -- src',                                                               // 3 git grep names files
    ].join("\n")],
  ]);
  const found = unsafeGitPathCalls(files).map(call => `${call.path}:${call.line}`);
  assert.deepEqual(found, ["scripts/a.mjs:1", "scripts/a.mjs:2", "scripts/a.mjs:3", "scripts/a.mjs:4", "scripts/a.mjs:5", "scripts/a.mjs:6", "scripts/a.mjs:7", "scripts/b.sh:1", "scripts/b.sh:2", "scripts/b.sh:6"]);
});

test("the helper names Korean paths with spaces as they are: ls-files, ls-tree, status, diff, log, and a patch", () => {
  const dir = tempDir("fls-gitpaths-");
  try {
    const git = gitIn(dir);
    writeKoreanFile(dir); mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src/a.ts"), "1\n");
    git("init", "-q", "-b", "trunk"); git("add", "-A"); git("commit", "-qm", "c1"); const c1 = git("rev-parse", "HEAD");
    writeFileSync(join(dir, KOREAN_PATH), "바뀜\n"); writeFileSync(join(dir, "src/새 파일.ts"), "2\n");
    assert.deepEqual(gitPaths(["ls-files"], { cwd: dir }), ["src/a.ts", KOREAN_PATH]);
    assert.deepEqual(gitPaths(["ls-tree", "-r", "--name-only", "HEAD"], { cwd: dir }), ["src/a.ts", KOREAN_PATH]);
    assert.deepEqual(gitPaths(["status", "--porcelain", "--untracked-files=all"], { cwd: dir }), [` M ${KOREAN_PATH}`, "?? src/새 파일.ts"]);
    assert.deepEqual(gitPaths(["diff", "--name-only", c1], { cwd: dir }), [KOREAN_PATH]);
    git("add", "-A"); git("commit", "-qm", "c2");
    assert.deepEqual(gitPathsOut(["log", "--name-only", "--format=%x01%s", `${c1}..HEAD`], { cwd: dir }).split("\0").filter(Boolean), ["\x01c2", "\nsrc/새 파일.ts", KOREAN_PATH]);
    assert.match(gitText(["diff", c1, "HEAD"], { cwd: dir }), new RegExp(`^\\+\\+\\+ b/${KOREAN_PATH.replace(/[.]/g, "\\.")}`, "m"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// Review RR27 (MINOR-1, 2): the pin check reads a patch's headers, the lint-exception scan git grep's lines — both name
// files; a name with a space also ends its +++ header in a tab.
test("a patch's headers and git grep's lines name Korean paths with spaces as they are (pin and lint-exception checks)", () => {
  const dir = tempDir("fls-gitpatch-");
  try {
    const git = gitIn(dir);
    writeKoreanFile(dir); mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src/한글 모듈.ts"), "export const a = 1;\n");
    git("init", "-q", "-b", "trunk"); git("add", "-A"); git("commit", "-qm", "c1"); const c1 = git("rev-parse", "HEAD");
    writeFileSync(join(dir, KOREAN_PATH), "바뀜\n");
    // why: a fixture file whose lint exception the scan must find under its Korean name (no exception in this test)
    writeFileSync(join(dir, "src/한글 모듈.ts"), "// eslint-disable-next-line no-console\nexport const a = 2;\n");
    git("add", "-A"); git("commit", "-qm", "c2"); const c2 = git("rev-parse", "HEAD");
    assert.deepEqual(addedLines(c1, c2, [KOREAN_PATH], dir), [{ path: KOREAN_PATH, text: "바뀜" }]);
    assert.deepEqual([...lineChanges(c1, c2, [KOREAN_PATH], dir)], [[KOREAN_PATH, { removed: ["기본"], added: ["바뀜"] }]]);
    assert.deepEqual(findExceptions(c2, dir).map(hit => [hit.path, hit.line]), [["src/한글 모듈.ts", 1]]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
