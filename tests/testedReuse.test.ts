import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { QUIET_ENV, QUIET_GIT, tempDir } from "./helpers/tempRepo";
import { pathToFileURL } from "node:url";
import { testedTree } from "../scripts/checks/changedTests.mjs";
import { checkTestedChanges, formatTestedChanges, reuseEvidence } from "../scripts/checks/testedChanges.mjs";
import { collectTestInputs, packInputs } from "../scripts/checks/testInputs/testInputs.mjs";

// RR25, measured (user ruling 2026-10-09): a picked test keeps an earlier result only when none of the files changed
// since that result's content is among what the test was measured to read while it ran (files, imports, folders listed,
// paths looked for and absent); otherwise only that test runs again; a test that is not measurable (a child process, the
// network) is never reused. Each case is made to overlap on purpose (RR22), and every record is measured for real: the
// story's tests run under scripts/checks/testInputs/traceReads.mjs, as test:changed runs them. The story: the trunk, a
// branch that changes the engine and a line of App.tsx, a measured passing record of the branch, then the trunk moves
// and the branch merges it (the long gate's race).
const REPO = resolve(import.meta.dirname, "..");
const TSX = join(REPO, "node_modules/.bin/tsx");
const TRACER = pathToFileURL(join(REPO, "scripts/checks/testInputs/traceReads.mjs")).href;
const APP = Array.from({ length: 12 }, (_, i) => `export const line${i} = ${i};`).join("\n") + "\n";
const TESTS = ["tests/appText.test.ts", "tests/doorSigns.test.ts", "tests/engine.test.ts", "tests/phase3Architecture.test.ts", "tests/provenance.test.ts",
  "tests/shadow.test.ts", "tests/spawn.test.ts"];
// Every story test also imports src/shared.ts, which the branch changes: all of them are picked by the push.
const T = 'import { test } from "node:test";\nimport "../src/shared.ts";\n';
/** The repository's module resolution (tsconfig.json), so a throwaway repository resolves imports as the real one does, and
 * tsx looks no further up for one (under .tmp/ it would read the outer repository's: a read outside the throwaway one). */
const TSCONFIG = JSON.stringify({ compilerOptions: { module: "ESNext", moduleResolution: "Bundler", resolveJsonModule: true, jsx: "react-jsx" } });
type Write = (path: string, text: string) => void;
type Move = (write: Write, remove: (path: string) => void, git: (...args: string[]) => string) => void;

/** A measured run of `tests` in `dir`: the runner's result and the packed inputs, as test:changed records them. */
function measure(dir: string, tests: readonly string[]) {
  const trace = mkdtempSync(join(tmpdir(), "fls-reuse-trace-")); mkdirSync(join(trace, "reads")); mkdirSync(join(trace, "v8"));
  try {
    const { NODE_TEST_CONTEXT: _runner, ...outer } = process.env;   // this file runs under a test runner: the inner one must not think it is a child
    const env = { ...outer, FLS_TRACE_DIR: join(trace, "reads"), NODE_V8_COVERAGE: join(trace, "v8"), NODE_OPTIONS: `--import=${TRACER}` };
    const ran = spawnSync(TSX, ["--test", ...tests], { cwd: dir, encoding: "utf8", env });
    return { ran, inputs: packInputs(collectTestInputs({ root: dir, traceDir: join(trace, "reads"), coverageDir: join(trace, "v8") })) };
  } finally { rmSync(trace, { recursive: true, force: true }); }
}

function story(trunkMove: Move) {
  const dir = tempDir("fls-reuse-");
  try { return storyIn(dir, trunkMove); } catch (error) { rmSync(dir, { recursive: true, force: true }); throw error; }   // a failed setup leaves no repository behind
}

function storyIn(dir: string, trunkMove: Move) {
  const git = (...args: string[]) => execFileSync("git", [...QUIET_GIT, ...args], { cwd: dir, encoding: "utf8", env: QUIET_ENV }).trim();
  const write: Write = (path, text) => { mkdirSync(dirname(join(dir, path)), { recursive: true }); writeFileSync(join(dir, path), text); };
  const remove = (path: string) => unlinkSync(join(dir, path));
  write(".gitignore", "/.remote-runs/\n"); write("tsconfig.json", TSCONFIG);   // as in the repository: the records are never content
  write("package.json", '{"type":"module","scripts":{}}\n'); write("package-lock.json", "{}\n"); write("docs/notes.md", "x\n");
  write("src/engine/core.ts", "export const core = 1;\n");
  write("src/engine/data.ts", "export const data = 1;\n");
  write("src/engine/extra.ts", "export const extra = 1;\n");
  write("src/engine/table.json", '{"n":1}\n');
  write("src/engine/rules.ts", 'import { core } from "./core.ts";\nimport { data } from "./data.ts";\nimport table from "./table.json";\nexport const rules = core + data + table.n;\n');
  write("src/App.tsx", APP);
  write("src/shared.ts", "export const shared = 1;\n");
  write("src/m/index.ts", 'export const which = "index";\n');
  write("fixtures/saves/v47/a.save.json", '{"a":1}\n'); write("fixtures/saves/v47/b.save.json", '{"b":1}\n');
  write("public/assets/x.png", "png\n");
  write("scripts/walk.ts", 'import { readdirSync } from "node:fs";\nexport const pictures = () => readdirSync("public/assets");\n');
  // The tests: an import chain (with an extensionless import), a path read as text, a folder walked, a fixture read by a
  // built path, a folder walked through a helper, an import an added file could shadow, a child process.
  write("tests/engine.test.ts", `${T}import { rules } from "../src/engine/rules.ts";\nimport { extra } from "../src/engine/extra";\ntest("engine", () => { if (rules + extra < 0) throw new Error(); });\n`);
  write("tests/appText.test.ts", `${T}import { readFileSync } from "node:fs";\ntest("app", () => { readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8"); });\n`);
  write("tests/phase3Architecture.test.ts", `${T}import { readdirSync } from "node:fs";\ntest("walks src", () => { readdirSync("src", { recursive: true }); });\n`);
  write("tests/doorSigns.test.ts", `${T}import { readFileSync } from "node:fs";\ntest("fixture", () => { for (const name of ["a"]) JSON.parse(readFileSync(\`fixtures/saves/v47/\${name}.save.json\`, "utf8")); });\n`);
  write("tests/provenance.test.ts", `${T}import { pictures } from "../scripts/walk.ts";\ntest("pictures", () => { pictures(); });\n`);
  write("tests/shadow.test.ts", `${T}import { which } from "../src/m";\ntest("shadow", () => { if (which !== "index") throw new Error(which); });\n`);
  write("tests/spawn.test.ts", `${T}import { execFileSync } from "node:child_process";\ntest("spawn", () => { execFileSync("git", ["--version"]); });\n`);
  git("init", "-q", "-b", "trunk"); git("add", "-A"); git("commit", "-qm", "trunk");
  git("checkout", "-qb", "branch");
  write("src/engine/core.ts", "export const core = 2;\n");                         // the branch's engine change
  write("src/shared.ts", "export const shared = 2;\n");                          // what every test imports
  write("src/App.tsx", APP.replace("line0 = 0", "line0 = 100"));                   // and a line of App.tsx
  git("commit", "-qam", "branch: engine and App");
  let clock = Date.parse("2026-10-09T01:00:00Z");
  /** A measured run of `tests` on the working tree, recorded as test:changed records it (passed as it ran, unless given). */
  const record = (name: string, tests: readonly string[] = TESTS, { passed, tree }: { passed?: boolean; tree?: string } = {}) => {
    const { ran, inputs } = measure(dir, tests);
    clock += 60_000;
    write(`.remote-runs/${name}/test-changed.json`, JSON.stringify({ tree: tree ?? testedTree(dir), head: git("rev-parse", "HEAD"), passed: passed ?? ran.status === 0,
      picked: [...tests], tests: tests.length, pass: tests.length, where: name, at: new Date(clock).toISOString(), inputs }));
    return ran;
  };
  // The long gate: the branch's tests, measured, pass on the branch's content.
  const gate = record("gate");
  assert.equal(gate.status, 0, gate.stdout + gate.stderr);
  git("checkout", "-q", "trunk"); trunkMove(write, remove, git); git("add", "-A"); git("commit", "-qm", "trunk moves", "--allow-empty");
  const trunk1 = git("rev-parse", "HEAD");
  git("checkout", "-q", "branch"); git("merge", "-q", "--no-edit", "trunk");
  const check = () => checkTestedChanges({ top: dir, work: dir, base: trunk1, head: git("rev-parse", "HEAD") });
  return { dir, git, write, record, check, done: () => rmSync(dir, { recursive: true, force: true }) };
}

const uncovered = (result: ReturnType<typeof checkTestedChanges>) => [...(result.uncovered ?? [])].sort();
const docsOnly: Move = write => write("docs/notes.md", "moved\n");
const escape = (text: string) => text.replace(/[./]/g, "\\$&");

test("no overlap: the trunk changed only a document — every measurable result is kept, the output says no overlap", () => {
  const s = story(docsOnly);
  try {
    const result = s.check();
    assert.deepEqual(uncovered(result), ["tests/spawn.test.ts"], formatTestedChanges(result));
    assert.match(formatTestedChanges(result), /reused, no overlap: 1 file\(s\) changed since the run's content [0-9a-f]{8} \(commit [0-9a-f]{8}, gate, .*\), none among what they were measured to read/);
  } finally { s.done(); }
});

test("a test that is not measurable (it starts a child process) is never reused, the output says why", () => {
  const s = story(docsOnly);
  try {
    const result = s.check();
    assert.ok(uncovered(result).includes("tests/spawn.test.ts"));
    assert.match(formatTestedChanges(result), /tests\/spawn\.test\.ts — never reused: not measurable: child process/);
  } finally { s.done(); }
});

for (const [what, move, expected, file] of [
  ["a direct import (rules.ts)", (w: Write) => w("src/engine/rules.ts", 'import { core } from "./core.ts";\nimport { data } from "./data.ts";\nimport table from "./table.json";\nexport const rules = core * data + table.n;\n'), "tests/engine.test.ts", "src/engine/rules.ts"],
  ["a file through other files (data.ts)", (w: Write) => w("src/engine/data.ts", "export const data = 7;\n"), "tests/engine.test.ts", "src/engine/data.ts"],
  ["an imported JSON (table.json)", (w: Write) => w("src/engine/table.json", '{"n":2}\n'), "tests/engine.test.ts", "src/engine/table.json"],
  ["a path read as text (another line of App.tsx)", (w: Write) => w("src/App.tsx", APP.replace("line11 = 11", "line11 = 111")), "tests/appText.test.ts", "src/App.tsx"],
  ["a fixture read by a built path", (w: Write) => w("fixtures/saves/v47/a.save.json", '{"a":2}\n'), "tests/doorSigns.test.ts", "fixtures/saves/v47/a.save.json"],
  ["a folder a helper walks (a new picture)", (w: Write) => w("public/assets/y.png", "png\n"), "tests/provenance.test.ts", "public/assets/y.png"],
  ["a folder the test walks (a new file under src/)", (w: Write) => w("src/ui/new.ts", "export const n = 1;\n"), "tests/phase3Architecture.test.ts", "src/ui/new.ts"],
  ["an added module that shadows an import (src/m.ts beside src/m/index.ts)", (w: Write) => w("src/m.ts", 'export const which = "file";\n'), "tests/shadow.test.ts", "src/m.ts"],
] as const) {
  test(`overlap by ${what}: only the tests that read it run again, the output names the file`, () => {
    const s = story((write) => move(write));
    try {
      const result = s.check();
      assert.ok(uncovered(result).includes(expected), formatTestedChanges(result));
      assert.ok(result.overlaps?.get(expected)?.files.includes(file), JSON.stringify(result.overlaps?.get(expected)));
      assert.match(formatTestedChanges(result), new RegExp(`${escape(expected)} — reads [^\\n]*${escape(file)}`));
      for (const other of ["tests/appText.test.ts", "tests/doorSigns.test.ts", "tests/shadow.test.ts"]) if (other !== expected) assert.ok(!uncovered(result).includes(other), `${other} reads nothing of it`);
    } finally { s.done(); }
  });
}

test("a fixture the test does not read changes nothing for it, though it sits beside the one it reads", () => {
  const s = story(write => write("fixtures/saves/v47/b.save.json", '{"b":2}\n'));
  try { assert.ok(!uncovered(s.check()).includes("tests/doorSigns.test.ts")); } finally { s.done(); }
});

test("overlap by a deleted file and by a rename: engine.test still imports extra.ts — it runs again", () => {
  const moves: Move[] = [(_w, remove) => remove("src/engine/extra.ts"), (_w, _r, git) => git("mv", "src/engine/extra.ts", "src/engine/extra2.ts")];
  for (const move of moves) {
    const s = story(move);
    try {
      const result = s.check();
      assert.ok(uncovered(result).includes("tests/engine.test.ts"));
      assert.ok(result.overlaps?.get("tests/engine.test.ts")?.files.includes("src/engine/extra.ts"));
    } finally { s.done(); }
  }
});

test("overlap by the lock file: every test runs again", () => {
  const s = story(write => write("package-lock.json", '{"lockfileVersion":3}\n'));
  try { assert.deepEqual(uncovered(s.check()), [...TESTS].sort()); } finally { s.done(); }
});

test("overlap by the branch's own later edit, and by an edit of the test itself", () => {
  const s = story(docsOnly);
  try {
    s.write("src/engine/core.ts", "export const core = 3;\n"); s.git("commit", "-qam", "branch: one more engine edit");
    assert.ok(uncovered(s.check()).includes("tests/engine.test.ts"));
    s.write("tests/appText.test.ts", `${T}import { readFileSync } from "node:fs";\ntest("app", () => { readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8"); });\n// edited\n`);
    s.git("commit", "-qam", "branch: the test changes");
    assert.ok(uncovered(s.check()).includes("tests/appText.test.ts"));
  } finally { s.done(); }
});

test("only the overlapping tests run again, and the reused and the new record together cover the push; the evidence says which", () => {
  const s = story(write => write("src/engine/data.ts", "export const data = 7;\n"));
  try {
    const again = uncovered(s.check());
    assert.ok(again.includes("tests/engine.test.ts") && again.includes("tests/phase3Architecture.test.ts") && !again.includes("tests/appText.test.ts"));
    s.record("rerun", again.filter(t => t !== "tests/spawn.test.ts").concat("tests/spawn.test.ts"));
    const after = s.check();
    assert.equal(after.ok, true, formatTestedChanges(after));
    const evidences = reuseEvidence(after.covered!);
    assert.deepEqual(evidences.map(e => e.how).sort(), ["reused", "same"]);
    const reused = evidences.find(e => e.how === "reused")!;
    assert.ok(reused.tests.includes("tests/appText.test.ts") && reused.from.run === "gate" && /^[0-9a-f]{40}$/.test(reused.from.commit!) && /^no overlap/.test(reused.why));
  } finally { s.done(); }
});

test("a newer failure on the same inputs outweighs an older pass; a failure on content this checkout lacks blocks too", () => {
  const s = story(docsOnly);
  try {
    s.record("zz-after-merge", ["tests/engine.test.ts"], { passed: false });   // listed after "gate": the time decides, not the name
    const result = s.check();
    assert.ok(uncovered(result).includes("tests/engine.test.ts"));
    assert.match(formatTestedChanges(result), /tests\/engine\.test\.ts — FAILED on this content \(zz-after-merge, /);
    assert.ok(!uncovered(result).includes("tests/appText.test.ts"), "the failed run did not run appText.test: its pass stands");
    s.record("elsewhere", ["tests/appText.test.ts"], { passed: false, tree: "0123456789abcdef0123456789abcdef01234567" });
    assert.match(formatTestedChanges(s.check()), /tests\/appText\.test\.ts — FAILED on content it cannot be compared with \(01234567\)/);
  } finally { s.done(); }
});

test("a newer failure of other content with no overlap blocks too: its inputs were the same as the older pass's", () => {
  const s = story(docsOnly);
  try {
    // A failing run of the branch's content before the merge (the gate's content), newer than the gate's pass.
    s.record("later-fail", ["tests/engine.test.ts"], { passed: false, tree: s.git("rev-parse", "HEAD^1^{tree}") });
    const result = s.check();
    assert.ok(uncovered(result).includes("tests/engine.test.ts"), formatTestedChanges(result));
    assert.match(formatTestedChanges(result), /tests\/engine\.test\.ts — FAILED on the same inputs \(content [0-9a-f]{8}/);
  } finally { s.done(); }
});

test("a record of content this checkout lacks, or with no measured inputs, never covers a test", () => {
  const s = story(docsOnly);
  try {
    rmSync(join(s.dir, ".remote-runs/gate"), { recursive: true });
    s.record("elsewhere", TESTS, { tree: "0123456789abcdef0123456789abcdef01234567" });
    s.write(".remote-runs/plain/test-changed.json", JSON.stringify({ tree: s.git("rev-parse", "HEAD~1^{tree}"), passed: true, picked: TESTS, where: "plain", at: "2026-10-09T09:00:00Z" }));
    const text = formatTestedChanges(s.check());
    assert.match(text, /tests\/engine\.test\.ts — never reused: its record has no measured inputs for it/);
  } finally { s.done(); }
});

test("a range picks a test by what it was measured to read, though no import or listed folder names the file", () => {
  // The branch changes only the fixture doorSigns reads by a built path: the static pick misses it, the measured pick does not.
  const dir = tempDir("fls-mpick-");
  const git = (...args: string[]) => execFileSync("git", [...QUIET_GIT, ...args], { cwd: dir, encoding: "utf8", env: QUIET_ENV }).trim();
  const write: Write = (path, text) => { mkdirSync(dirname(join(dir, path)), { recursive: true }); writeFileSync(join(dir, path), text); };
  try {
    write(".gitignore", "/.remote-runs/\n"); write("tsconfig.json", TSCONFIG); write("package.json", '{"type":"module"}\n');
    write("fixtures/saves/v47/a.save.json", '{"a":1}\n');
    write("tests/doorSigns.test.ts", `import { test } from "node:test";\nimport { readFileSync } from "node:fs";\ntest("fixture", () => { for (const name of ["a"]) JSON.parse(readFileSync(\`fixtures/saves/v47/\${name}.save.json\`, "utf8")); });\n`);
    git("init", "-q", "-b", "trunk"); git("add", "-A"); git("commit", "-qm", "trunk");
    const { inputs } = measure(dir, ["tests/doorSigns.test.ts"]);
    write(".remote-runs/full/test-changed.json", JSON.stringify({ tree: testedTree(dir), head: git("rev-parse", "HEAD"), passed: true, picked: ["tests/doorSigns.test.ts"], where: "full", at: "2026-10-09T01:00:00Z", inputs }));
    const base = git("rev-parse", "HEAD");
    write("fixtures/saves/v47/a.save.json", '{"a":2}\n'); git("commit", "-qam", "branch: the fixture");
    const result = checkTestedChanges({ top: dir, work: dir, base, head: git("rev-parse", "HEAD") });
    assert.deepEqual(result.required, ["tests/doorSigns.test.ts"]);
    assert.equal(result.ok, false, "its old pass was of the old fixture");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// Shadowed imports (RR25 measured, user ruling 2026-10-09): a module added where an import used to resolve elsewhere is a
// path the resolver looked for and missed, so the test runs again. One case per form: an extensionless relative import, an
// index file and a package's own exports; a .js specifier resolved to .ts follows below (tsx keeps the .ts).
for (const [form, files, specifier, added, touched] of [
  ["an extensionless relative import (.tsx, then a .ts beside it)", { "src/e.tsx": 'export const which = "tsx";\n' }, "../src/e", ["src/e.ts", 'export const which = "ts";\n'], "src/e.ts"],
  ["an index file (src/m/index.ts, then src/m.ts)", { "src/m/index.ts": 'export const which = "index";\n' }, "../src/m", ["src/m.ts", 'export const which = "file";\n'], "src/m.ts"],
  ["the package's own exports (package.json)", { "src/feature-a.ts": 'export const which = "a";\n', "src/feature-b.ts": 'export const which = "b";\n' }, "story/feature",
    ["package.json", '{"name":"story","type":"module","exports":{"./feature":"./src/feature-b.ts"}}\n'], "package.json"],
] as const) {
  test(`a shadowed import, ${form}: the test runs again, the output names ${touched}`, () => {
    const dir = tempDir("fls-shadow-");
    const git = (...args: string[]) => execFileSync("git", [...QUIET_GIT, ...args], { cwd: dir, encoding: "utf8", env: QUIET_ENV }).trim();
    const write: Write = (path, text) => { mkdirSync(dirname(join(dir, path)), { recursive: true }); writeFileSync(join(dir, path), text); };
    const testFile = `import { test } from "node:test";\nimport { which } from "${specifier}";\ntest("shadow", () => { if (!which) throw new Error(); });\n`;
    try {
      write(".gitignore", "/.remote-runs/\n"); write("tsconfig.json", TSCONFIG); write("package.json", '{"name":"story","type":"module","exports":{"./feature":"./src/feature-a.ts"}}\n');
      for (const [path, text] of Object.entries(files)) write(path, text);
      write("tests/shadow.test.ts", testFile);
      git("init", "-q", "-b", "trunk"); git("add", "-A"); git("commit", "-qm", "trunk");
      git("checkout", "-qb", "branch"); write("tests/shadow.test.ts", `${testFile}// the branch\n`); git("commit", "-qam", "branch: the test");
      const { ran, inputs } = measure(dir, ["tests/shadow.test.ts"]);
      assert.equal(ran.status, 0, ran.stdout + ran.stderr);
      write(".remote-runs/gate/test-changed.json", JSON.stringify({ tree: testedTree(dir), head: git("rev-parse", "HEAD"), passed: true, picked: ["tests/shadow.test.ts"], where: "gate", at: "2026-10-09T01:00:00Z", inputs }));
      git("checkout", "-q", "trunk"); write(added[0], added[1]); git("add", "-A"); git("commit", "-qm", "trunk adds a shadow");
      const base = git("rev-parse", "HEAD"); git("checkout", "-q", "branch"); git("merge", "-q", "--no-edit", "trunk");
      const result = checkTestedChanges({ top: dir, work: dir, base, head: git("rev-parse", "HEAD") });
      assert.ok(result.uncovered?.includes("tests/shadow.test.ts"), formatTestedChanges(result));
      assert.ok(result.overlaps?.get("tests/shadow.test.ts")?.files.includes(touched), JSON.stringify(result.overlaps?.get("tests/shadow.test.ts")));
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
}

test("a record whose measured inputs are broken or of another schema never covers a test: it runs again", () => {
  const s = story(docsOnly);
  try {
    rmSync(join(s.dir, ".remote-runs/gate"), { recursive: true });
    const tree = s.git("rev-parse", "HEAD~1^{tree}");   // the branch before the merge: the gate's content
    s.write(".remote-runs/broken/test-changed.json", JSON.stringify({ tree, passed: true, picked: TESTS, where: "broken", at: "2026-10-09T09:00:00Z",
      inputs: { schema: 1, paths: "not a list", tests: { "tests/engine.test.ts": { f: [0] } } } }));
    s.write(".remote-runs/other-schema/test-changed.json", JSON.stringify({ tree, passed: true, picked: TESTS, where: "other-schema", at: "2026-10-09T09:01:00Z",
      inputs: { schema: 2, paths: [], tests: { "tests/appText.test.ts": { f: [], d: [], m: [], u: [] } } } }));
    const text = formatTestedChanges(s.check());
    assert.match(text, /tests\/engine\.test\.ts — never reused: its record has no measured inputs for it/);
    assert.match(text, /tests\/appText\.test\.ts — never reused: its record has no measured inputs for it/);
  } finally { s.done(); }
});

test("a .js specifier resolved to .ts: a real .js added beside it loads nothing new (tsx keeps the .ts), so the result stands; deleting the .ts reruns", () => {
  const dir = tempDir("fls-shadow-js-");
  const git = (...args: string[]) => execFileSync("git", [...QUIET_GIT, ...args], { cwd: dir, encoding: "utf8", env: QUIET_ENV }).trim();
  const write: Write = (path, text) => { mkdirSync(dirname(join(dir, path)), { recursive: true }); writeFileSync(join(dir, path), text); };
  const testFile = 'import { test } from "node:test";\nimport { which } from "../src/j.js";\ntest("which", () => { console.log(`WHICH=${which}`); });\n';
  try {
    write(".gitignore", "/.remote-runs/\n"); write("tsconfig.json", TSCONFIG); write("package.json", '{"name":"story","type":"module"}\n'); write("src/j.ts", 'export const which = "ts";\n');
    write("tests/j.test.ts", testFile);
    git("init", "-q", "-b", "trunk"); git("add", "-A"); git("commit", "-qm", "trunk");
    git("checkout", "-qb", "branch"); write("tests/j.test.ts", `${testFile}// the branch\n`); git("commit", "-qam", "branch: the test");
    const { ran, inputs } = measure(dir, ["tests/j.test.ts"]);
    assert.match(ran.stdout, /WHICH=ts/);
    write(".remote-runs/gate/test-changed.json", JSON.stringify({ tree: testedTree(dir), head: git("rev-parse", "HEAD"), passed: true, picked: ["tests/j.test.ts"], where: "gate", at: "2026-10-09T01:00:00Z", inputs }));
    git("checkout", "-q", "trunk"); write("src/j.js", 'export const which = "js";\n'); git("add", "-A"); git("commit", "-qm", "trunk adds j.js");
    const base = git("rev-parse", "HEAD"); git("checkout", "-q", "branch"); git("merge", "-q", "--no-edit", "trunk");
    const kept = checkTestedChanges({ top: dir, work: dir, base, head: git("rev-parse", "HEAD") });
    assert.equal(kept.ok, true, formatTestedChanges(kept));
    assert.match(measure(dir, ["tests/j.test.ts"]).ran.stdout, /WHICH=ts/, "the merged content still loads the .ts: reusing was right");
    git("rm", "-q", "src/j.ts"); git("commit", "-qm", "the .ts goes");
    const gone = checkTestedChanges({ top: dir, work: dir, base, head: git("rev-parse", "HEAD") });
    assert.ok(gone.overlaps?.get("tests/j.test.ts")?.files.includes("src/j.ts"), formatTestedChanges(gone));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

/** A small throwaway repository with one measured test and its passing record; `move` changes the trunk, the branch merges it. */
type SingleMove = (git: (...args: string[]) => string, write: Write, dir: string) => void;
function single(testText: string, setup: Record<string, string>, move: SingleMove) {
  const dir = tempDir("fls-single-");
  try { return singleIn(dir, testText, setup, move); } catch (error) { rmSync(dir, { recursive: true, force: true }); throw error; }
}

function singleIn(dir: string, testText: string, setup: Record<string, string>, move: SingleMove) {
  const git = (...args: string[]) => execFileSync("git", [...QUIET_GIT, ...args], { cwd: dir, encoding: "utf8", env: QUIET_ENV }).trim();
  const write: Write = (path, text) => { mkdirSync(dirname(join(dir, path)), { recursive: true }); writeFileSync(join(dir, path), text); };
  write(".gitignore", "/.remote-runs/\n"); write("tsconfig.json", TSCONFIG); write("package.json", '{"name":"story","type":"module"}\n');
  // "symlink:<target>" makes a tracked symbolic link.
  for (const [path, text] of Object.entries(setup)) if (text.startsWith("symlink:")) { mkdirSync(dirname(join(dir, path)), { recursive: true }); symlinkSync(text.slice(8), join(dir, path)); } else write(path, text);
  write("tests/one.test.ts", testText);
  git("init", "-q", "-b", "trunk"); git("add", "-A"); git("commit", "-qm", "trunk");
  git("checkout", "-qb", "branch"); write("tests/one.test.ts", `${testText}// the branch\n`); git("commit", "-qam", "branch: the test");
  const { ran, inputs } = measure(dir, ["tests/one.test.ts"]);
  assert.equal(ran.status, 0, ran.stdout + ran.stderr);
  write(".remote-runs/gate/test-changed.json", JSON.stringify({ tree: testedTree(dir), head: git("rev-parse", "HEAD"), passed: true, picked: ["tests/one.test.ts"], where: "gate", at: "2026-10-09T01:00:00Z", inputs }));
  git("checkout", "-q", "trunk"); move(git, write, dir); git("add", "-A"); git("commit", "-qm", "trunk moves");
  const base = git("rev-parse", "HEAD"); git("checkout", "-q", "branch"); git("merge", "-q", "--no-edit", "trunk");
  return { result: checkTestedChanges({ top: dir, work: dir, base, head: git("rev-parse", "HEAD") }), done: () => rmSync(dir, { recursive: true, force: true }) };
}

test("a rename onto a path the test looked for and missed: the test runs again (renames are a delete and an add)", () => {
  const s = single('import { test } from "node:test";\nimport { existsSync } from "node:fs";\ntest("optional", () => { existsSync("fixtures/optional.json"); });\n',
    { "fixtures/other.json": '{"other":1}\n' }, git => git("mv", "fixtures/other.json", "fixtures/optional.json"));
  try {
    assert.ok(s.result.uncovered?.includes("tests/one.test.ts"), formatTestedChanges(s.result));
    assert.ok(s.result.overlaps?.get("tests/one.test.ts")?.files.includes("fixtures/optional.json"), JSON.stringify(s.result.overlaps?.get("tests/one.test.ts")));
  } finally { s.done(); }
});

test("a test that reads outside the repository is not measurable: it is never reused, the output says what it read", () => {
  const s = single('import { test } from "node:test";\nimport { readFileSync } from "node:fs";\ntest("outside", () => { readFileSync("/etc/hosts", "utf8"); });\n',
    {}, (_git, write) => write("docs/notes.md", "moved\n"));
  try {
    assert.ok(s.result.uncovered?.includes("tests/one.test.ts"), formatTestedChanges(s.result));
    assert.match(formatTestedChanges(s.result), /tests\/one\.test\.ts — never reused: not measurable: reads outside the repository: \/etc\/hosts/);
  } finally { s.done(); }
});

// Reads the recorder must see (RR25 review: each was a false reuse or a broken test before). In each, the trunk changes
// or adds the one thing the test depends on; the test must run again (or, when it cannot be followed, never be reused).
const H = 'import { test } from "node:test";\n';
for (const [what, testText, setup, move, touched] of [
  ["a folder looked for and missing, a file added under it", `${H}import { existsSync } from "node:fs";\ntest("t", () => { existsSync("fixtures/extra"); });\n`, {},
    ((_g, w) => w("fixtures/extra/x.json", "{}\n")) as SingleMove, "fixtures/extra/x.json"],
  ["a file read and missing (ENOENT caught), then added", `${H}import { readFileSync } from "node:fs";\ntest("t", () => { try { readFileSync("fixtures/opt.json"); } catch { /* optional */ } });\n`, {},
    ((_g, w) => w("fixtures/opt.json", "{}\n")) as SingleMove, "fixtures/opt.json"],
  ["a dynamic import that failed (caught), then the module added", `${H}test("t", async () => { try { await import("../src/plugin.ts"); } catch { /* none yet */ } });\n`, {},
    ((_g, w) => w("src/plugin.ts", "export const p = 1;\n")) as SingleMove, "src/plugin.ts"],
  ["an extensionless dynamic import that failed, then the module added", `${H}test("t", async () => { try { await import("../src/plugin"); } catch { /* none yet */ } });\n`, {},
    ((_g, w) => w("src/plugin.ts", "export const p = 1;\n")) as SingleMove, "src/plugin.ts"],
  ["a require that failed (caught), then the module added", `${H}import { createRequire } from "node:module";\ntest("t", () => { try { createRequire(import.meta.url)("../src/legacy.cjs"); } catch { /* none yet */ } });\n`, {},
    ((_g, w) => w("src/legacy.cjs", "module.exports = 1;\n")) as SingleMove, "src/legacy.cjs"],
  ["a fixture copied to a temporary file and read there", `${H}import { copyFileSync, readFileSync, mkdtempSync } from "node:fs";\nimport { tmpdir } from "node:os";\nimport { join } from "node:path";\ntest("t", () => { const to = join(mkdtempSync(join(tmpdir(), "c-")), "a.json"); copyFileSync("fixtures/a.json", to); JSON.parse(readFileSync(to, "utf8")); });\n`,
    { "fixtures/a.json": '{"a":1}\n' }, ((_g, w) => w("fixtures/a.json", '{"a":2}\n')) as SingleMove, "fixtures/a.json"],
  ["a file read by a relative path after chdir", `${H}import { readFileSync } from "node:fs";\ntest("t", () => { const back = process.cwd(); process.chdir("fixtures"); try { readFileSync("a.json"); } finally { process.chdir(back); } });\n`,
    { "fixtures/a.json": '{"a":1}\n' }, ((_g, w) => w("fixtures/a.json", '{"a":2}\n')) as SingleMove, "fixtures/a.json"],
  ["a file read through a symbolic link, its target changed", `${H}import { readFileSync } from "node:fs";\ntest("t", () => { readFileSync("fixtures/link.json"); });\n`,
    { "fixtures/a.json": '{"a":1}\n', "fixtures/link.json": "symlink:a.json" }, ((_g, w) => w("fixtures/a.json", '{"a":2}\n')) as SingleMove, "fixtures/a.json"],
  ["a package.json added in a folder of a module it imports", `${H}import { s } from "../src/sub/s.ts";\ntest("t", () => { if (!s) throw new Error(); });\n`,
    { "src/sub/s.ts": "export const s = 1;\n" }, ((_g, w) => w("src/sub/package.json", '{"type":"module"}\n')) as SingleMove, "src/sub/package.json"],
] as const) {
  test(`the recorder sees ${what}: the test runs again, the output names ${touched}`, () => {
    const s = single(testText, setup, move);
    try {
      assert.ok(s.result.uncovered?.includes("tests/one.test.ts"), formatTestedChanges(s.result));
      assert.ok(s.result.overlaps?.get("tests/one.test.ts")?.files.includes(touched), JSON.stringify(s.result.overlaps?.get("tests/one.test.ts")));
    } finally { s.done(); }
  });
}

for (const [what, testText, why] of [
  ["the network (http)", `${H}import http from "node:http";\ntest("t", async () => { await new Promise(done => http.get("http://127.0.0.1:9/", () => done(null)).on("error", () => done(null))); });\n`, "network"],
  ["the network (a socket to a port)", `${H}import net from "node:net";\ntest("t", async () => { await new Promise(done => net.connect({ host: "127.0.0.1", port: 9 }).on("error", () => done(null)).on("connect", () => done(null))); });\n`, "network"],
  ["a worker thread", `${H}import { Worker } from "node:worker_threads";\ntest("t", async () => { const w = new Worker("1", { eval: true }); await new Promise(done => w.on("exit", done)); });\n`, "worker thread"],
] as const) {
  test(`a test that uses ${what} is not measurable: it is never reused, the output says why`, () => {
    const s = single(testText, {}, (_g, w) => w("docs/notes.md", "moved\n"));
    try {
      assert.ok(s.result.uncovered?.includes("tests/one.test.ts"), formatTestedChanges(s.result));
      assert.match(formatTestedChanges(s.result), new RegExp(`tests/one\\.test\\.ts — never reused: not measurable: [^\\n]*${why}`));
    } finally { s.done(); }
  });
}

test("the recorder keeps what it wraps whole: fs.realpathSync.native and fs.realpath.native still work under it", () => {
  const s = single(`${H}import fs from "node:fs";\ntest("t", async () => { if (typeof fs.realpathSync.native(".") !== "string") throw new Error("sync"); await new Promise((done, fail) => fs.realpath.native(".", e => e ? fail(e) : done(null))); });\n`,
    {}, (_g, w) => w("docs/notes.md", "moved\n"));
  try { assert.equal(s.result.ok, true, formatTestedChanges(s.result)); } finally { s.done(); }   // single() asserts the measured run passed
});

test("a range picks a test that is not measurable by what it was seen to read (more picks only)", () => {
  const dir = tempDir("fls-mpick-u-");
  const git = (...args: string[]) => execFileSync("git", [...QUIET_GIT, ...args], { cwd: dir, encoding: "utf8", env: QUIET_ENV }).trim();
  const write: Write = (path, text) => { mkdirSync(dirname(join(dir, path)), { recursive: true }); writeFileSync(join(dir, path), text); };
  try {
    write(".gitignore", "/.remote-runs/\n"); write("tsconfig.json", TSCONFIG); write("package.json", '{"type":"module"}\n');
    write("fixtures/saves/v47/a.save.json", '{"a":1}\n');
    write("tests/spawnFixture.test.ts", `${H}import { execFileSync } from "node:child_process";\nimport { readFileSync } from "node:fs";\ntest("t", () => { execFileSync("git", ["--version"]); for (const n of ["a"]) JSON.parse(readFileSync(\`fixtures/saves/v47/\${n}.save.json\`, "utf8")); });\n`);
    git("init", "-q", "-b", "trunk"); git("add", "-A"); git("commit", "-qm", "trunk");
    const { inputs } = measure(dir, ["tests/spawnFixture.test.ts"]);
    write(".remote-runs/full/test-changed.json", JSON.stringify({ tree: testedTree(dir), head: git("rev-parse", "HEAD"), passed: true, picked: ["tests/spawnFixture.test.ts"], where: "full", at: "2026-10-09T01:00:00Z", inputs }));
    const base = git("rev-parse", "HEAD");
    write("fixtures/saves/v47/a.save.json", '{"a":2}\n'); git("commit", "-qam", "branch: the fixture");
    const result = checkTestedChanges({ top: dir, work: dir, base, head: git("rev-parse", "HEAD") });
    assert.deepEqual(result.required, ["tests/spawnFixture.test.ts"]);
    assert.equal(result.ok, false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a folder listed one level: a file changed in it that the test did not read keeps the result; an entry added reruns it", () => {
  const testText = `${H}import { readdirSync, readFileSync } from "node:fs";\ntest("t", () => { for (const name of readdirSync("fixtures/saves")) if (name === "a.json") readFileSync(\`fixtures/saves/\${name}\`); });\n`;
  const setup = { "fixtures/saves/a.json": '{"a":1}\n', "fixtures/saves/b.json": '{"b":1}\n' };
  const kept = single(testText, setup, (_g, w) => w("fixtures/saves/b.json", '{"b":2}\n'));
  try { assert.equal(kept.result.ok, true, formatTestedChanges(kept.result)); } finally { kept.done(); }
  const added = single(testText, setup, (_g, w) => w("fixtures/saves/c.json", '{"c":1}\n'));
  try { assert.ok(added.result.overlaps?.get("tests/one.test.ts")?.files.includes("fixtures/saves/c.json"), formatTestedChanges(added.result)); } finally { added.done(); }
});
