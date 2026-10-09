import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { gitIn, tempDir } from "./helpers/tempRepo";
import { checkUiGeometry, defaultSummaryPath, formatUiGeometryResult, isSafePath, uiInputsDirty, withoutComments } from "../scripts/checks/uiGeometry.mjs";

// RR26 (user ruling 2026-10-09, after four reviews found inputs the import closure missed): a geometry result counts on
// a newer commit only when every file changed since it was measured is on the small safe list — docs/**, *.md outside
// src/ public/ assets-inbox/, tests/** that nothing of the UI or the audit imports; any other change, known or not, needs
// a new audit. The shared result counts only as a full audit; a changed-rows run counts through its own report and a
// UI-Geometry-Run trailer. Each case is made to break the rule on purpose (RR22). The story: the trunk, a branch that
// changes a panel's component and style, the branch's changed-rows run committed with the trailer, then the trunk moves
// and the branch merges it.
const RUN = "render-TEST-geometry-1";
const ROW = "modal.panel";
const CONDITIONS = ["1280x800/normal/normal", "390x844/normal/normal"];

type Report = { dirty?: boolean; unopened?: number; keys?: readonly string[]; runName?: string; commit?: string | null; unregistered?: number;
  noRows?: boolean; axesNarrowed?: boolean | null; rowsNull?: boolean; commitOf?: "outside"; omit?: "dirty" | "totals" | "unregisteredFramed"; errorCondition?: boolean };
type Story = { trunkMove: (write: (path: string, text: string) => void, remove: (path: string) => void) => void; report?: Report; baseline?: string[]; trailer?: boolean;
  shared?: "stale" | "current-failing" | "partial" | "no-full" | "unsaid" | "current-broken" | "orphan" | "no-commit" | "none"; exceptions?: object[]; rowIds?: string[] };

function story({ trunkMove, report = {}, baseline = [], trailer = true, shared = "stale", exceptions = [], rowIds = [ROW] }: Story) {
  const dir = tempDir("fls-rowrun-");
  const git = gitIn(dir);
  const write = (path: string, text: string) => { mkdirSync(dirname(join(dir, path)), { recursive: true }); writeFileSync(join(dir, path), text); };
  write("scripts/uiGeometryAudit.mjs", 'import { GEOMETRY_ROWS } from "../tests/fixtures/geometryRows.ts";\n// the audit\n');
  write("tests/fixtures/geometryRows.ts", "export const GEOMETRY_ROWS = 1;\n");   // a test file the audit imports: not safe
  write("tests/other.test.ts", "export {};\n");                                 // a test nothing imports: safe
  write("src/main.tsx", 'import { App } from "./App.tsx";\nexport const main = App;\n');
  write("src/App.tsx", 'import { Panel } from "./ui/Panel.tsx";\nexport const App = [Panel];\n');
  write("src/ui/Panel.tsx", "export const Panel = () => null;\n");
  write("src/ui/Other.tsx", "export const Other = () => null;\n");
  write("src/styles/panel.css", ".panel { padding: 8px; }\n.spacer {}\n.spacer2 {}\n.panel-title { margin: 0; }\n");
  write("src/styles/global.css", ":root { --gap: 8px; }\n");
  write("src/content/panelCopy.ko.ts", 'export const PANEL = "판";\n');
  write("src/engine/core.ts", "export const core = 1;\n");
  write("public/assets/frame.png", "png\n");
  write("docs/notes.md", "x\n");
  write("docs/verification/uiaudit1/geometry-baseline.json", JSON.stringify({ entries: baseline }));
  write("docs/verification/uiaudit1/geometry-exceptions.json", JSON.stringify({ exceptions }));
  git("init", "-q", "-b", "trunk"); git("add", "-A"); git("commit", "-qm", "trunk");
  const trunk0 = git("rev-parse", "HEAD");
  // The shared result: a full audit of the trunk as it was (stale once the branch changes the panel).
  const sharedAt = (commit: string, extra: object = {}) => write("docs/verification/uiaudit1/geometry.json", JSON.stringify({ run: "full-old", full: true, commit, dirty: false, failureKeys: [], unopened: 0, unregisteredFramed: 0, ...extra }));
  // "orphan": measured at a commit outside the history (an amend or a rebase); "no-commit": a result without its commit.
  const sharedCommit = shared === "orphan" ? git("commit-tree", `${trunk0}^{tree}`, "-m", "amended away") : shared === "no-commit" ? "" : trunk0;
  if (shared !== "none") { sharedAt(sharedCommit); git("add", "-A"); git("commit", "-qm", "the shared result"); }
  git("checkout", "-qb", "branch");
  write("src/ui/Panel.tsx", "export const Panel = () => 'panel';\n"); write("src/styles/panel.css", ".panel { padding: 12px; }\n.spacer {}\n.spacer2 {}\n.panel-title { margin: 0; }\n");
  git("commit", "-qam", "branch: the panel");
  const measured = git("rev-parse", "HEAD");
  const measuredRows = (ids: readonly string[]) => Object.fromEntries(ids.map(id => [id, { conditions: Object.fromEntries(CONDITIONS.map(condition => [condition, { status: "measured", keys: report.keys ?? [] }])) }]));
  const rows: Record<string, unknown> = report.rowsNull ? { [ROW]: null } : report.noRows ? {} : measuredRows(rowIds);
  // A condition that errored while the report's own count says every condition opened.
  if (report.errorCondition) rows[ROW] = { conditions: { [CONDITIONS[0]!]: { status: "measured", keys: [] }, [CONDITIONS[1]!]: { status: "error", error: "timeout" } } };
  write(`docs/verification/uiaudit1/geometry/${RUN}/geometry.json`, JSON.stringify({ run: report.runName ?? RUN,
    // "outside": a commit with the measured content but outside the history (as after an amend or a rebase).
    commit: report.commitOf === "outside" ? git("commit-tree", `${measured}^{tree}`, "-m", "amended away") : report.commit === undefined ? measured : report.commit ?? undefined,
    axesNarrowed: report.axesNarrowed === null ? undefined : report.axesNarrowed ?? false, dirty: report.dirty ?? false, totals: { unopened: report.unopened ?? 0 },
    unregisteredFramed: Array.from({ length: report.unregistered ?? 0 }, (_, i) => ({ root: `.stray-${i}`, seenIn: [ROW] })), rows,
    ...(report.omit === undefined ? {} : { [report.omit]: undefined }) }));
  if (shared === "current-failing") sharedAt(measured, { run: "full-now", failureKeys: ["other.row|1280x800/normal/normal|overflow|.x"] });
  if (shared === "partial") sharedAt(measured, { run: "rows-only", full: false, rows: 1 });
  if (shared === "no-full") sharedAt(measured, { run: "before-rr26", full: undefined, rows: 17 });   // as the trunk's result before RR26
  if (shared === "current-broken") sharedAt(measured, { run: "full-now", dirty: true, unopened: 1, unregisteredFramed: 2 });
  if (shared === "unsaid") sharedAt(measured, { run: "full-now", dirty: undefined, unopened: undefined, unregisteredFramed: undefined });
  git("add", "-A"); git("commit", "-qm", `branch: the changed rows' geometry${trailer ? `\n\nUI-Geometry-Run: ${RUN}` : ""}`);
  git("checkout", "-q", "trunk"); trunkMove(write, path => rmSync(join(dir, path))); git("add", "-A"); git("commit", "-qm", "trunk moves", "--allow-empty");
  const trunk = git("rev-parse", "HEAD");
  git("checkout", "-q", "branch"); git("merge", "-q", "--no-edit", "trunk");
  const check = () => checkUiGeometry({ base: trunk, head: git("rev-parse", "HEAD"), cwd: dir, mode: "enforce", env: {} });
  const run = (name: string, ids: readonly string[] = rowIds) => {   // a new changed-rows run on the branch's current content, with its trailer
    write(`docs/verification/uiaudit1/geometry/${name}/geometry.json`, JSON.stringify({ run: name, commit: git("rev-parse", "HEAD"), axesNarrowed: false, dirty: false,
      totals: { unopened: 0 }, unregisteredFramed: [], rows: measuredRows(ids) }));
    git("add", "-A"); git("commit", "-qm", `a new changed-rows run\n\nUI-Geometry-Run: ${name}`);
  };
  return { dir, git, write, check, run, done: () => rmSync(dir, { recursive: true, force: true }) };
}

const refused = (result: ReturnType<typeof checkUiGeometry>, pattern: RegExp) => assert.ok(!result.ok && result.reasons.some(reason => pattern.test(reason)), result.reasons.join("\n"));
const escape = (text: string) => text.replace(/[./*+?()[\]]/g, "\\$&");

for (const [what, path, text] of [
  ["a document under docs/", "docs/notes.md", "moved\n"],
  ["a .md at the root", "README.md", "# readme\n"],
  ["a .md under scripts/", "scripts/NOTES.md", "notes\n"],
  ["a test nothing imports", "tests/other.test.ts", "export const changed = 1;\n"],
] as const) {
  test(`safe: the trunk changed ${what} (${path}) — the changed rows' run counts, the output says the changes were safe`, () => {
    const s = story({ trunkMove: write => write(path, text) });
    try {
      const result = s.check();
      assert.equal(result.ok, true, result.reasons.join("\n"));
      assert.match(formatUiGeometryResult(result), /changed rows accepted \(decision RR26\)\n {2}run render-TEST-geometry-1 \(commit [0-9a-f]{8}\): 1 row\(s\), 2 cell\(s\), no new failure; \d+ file\(s\) changed since it was measured, all on the safe list/);
    } finally { s.done(); }
  });
}

for (const [what, path, text] of [
  ["a CSS rule file the row uses (another rule of it)", "src/styles/panel.css", ".panel { padding: 8px; }\n.spacer {}\n.spacer2 {}\n.panel-title { margin: 4px; }\n"],
  ["a global style", "src/styles/global.css", ":root { --gap: 10px; }\n"],
  ["a component nothing imports", "src/ui/Other.tsx", "export const Other = () => 'other';\n"],
  ["the copy (*.ko.ts)", "src/content/panelCopy.ko.ts", 'export const PANEL = "판자";\n'],
  ["a picture", "public/assets/frame.png", "png2\n"],
  ["an engine file the UI does not import", "src/engine/core.ts", "export const core = 2;\n"],
  ["a .md inside src/", "src/ui/notes.md", "notes\n"],
  ["a .md inside public/", "public/readme.md", "notes\n"],
  ["a .md inside assets-inbox/", "assets-inbox/wave1/notes.md", "notes\n"],
  ["a save fixture", "fixtures/saves/v1/a.save.json", "{}\n"],
  ["a seed", "seeds/s.json", "{}\n"],
  ["a perf record", "perf/p.json", "{}\n"],
  ["a script", "scripts/fontsPlugin.ts", "export const fonts = 1;\n"],
  ["the lock file", "package-lock.json", '{"packages":{}}\n'],
  ["a test the audit imports", "tests/fixtures/geometryRows.ts", "export const GEOMETRY_ROWS = 2;\n"],
  ["a file of a folder no rule names", "tools/x.cfg", "x\n"],
] as const) {
  test(`off the safe list: the trunk changed ${what} — the run does not count, the output names ${path}`, () => {
    const s = story({ trunkMove: write => write(path, text) });
    try { refused(s.check(), new RegExp(`run render-TEST-geometry-1: 1 file\\(s\\) off the safe list changed since it was measured at [0-9a-f]{8} \\(\\d+ of them reach the UI or the audit by import\\): ${escape(path)} — audit again`)); }
    finally { s.done(); }
  });
}

test("the report counts the unsafe changes that reach the UI or the audit by import (report only)", () => {
  const s = story({ trunkMove: write => write("src/App.tsx", 'import { Panel } from "./ui/Panel.tsx";\nexport const App = [Panel, 1];\n') });
  try { refused(s.check(), /\(1 of them reach the UI or the audit by import\): src\/App\.tsx/); } finally { s.done(); }
  const t = story({ trunkMove: write => write("src/engine/core.ts", "export const core = 9;\n") });
  try { refused(t.check(), /\(0 of them reach the UI or the audit by import\): src\/engine\/core\.ts/); } finally { t.done(); }
});

test("a UI file moved into docs/ is a change off the safe list where it was (renames are a delete and an add)", () => {
  const s = story({ trunkMove: (write, remove) => { write("docs/Other.tsx", "export const Other = () => null;\n"); remove("src/ui/Other.tsx"); } });
  try { refused(s.check(), /run render-TEST-geometry-1: 1 file\(s\) off the safe list changed .*: src\/ui\/Other\.tsx — audit again/); } finally { s.done(); }
});

test("when the import closure cannot be read, no test is safe (it fails closed)", () => {
  const s = story({ trunkMove: write => write("tests/other.test.ts", "export const changed = 1;\n") });
  try {
    // A blob the closure reads is gone: the closure cannot say which tests the audit imports.
    const blob = s.git("rev-parse", "HEAD:src/main.tsx");
    rmSync(join(s.dir, ".git/objects", blob.slice(0, 2), blob.slice(2)));
    refused(s.check(), /1 file\(s\) off the safe list changed since it was measured at [0-9a-f]{8} \(the import closure could not be read\): tests\/other\.test\.ts — audit again/);
  } finally { s.done(); }
});

test("the branch's own UI edit after the run: the run does not count", () => {
  const s = story({ trunkMove: write => write("docs/notes.md", "moved\n") });
  try {
    s.write("src/ui/Panel.tsx", "export const Panel = () => 'panel!';\n"); s.git("commit", "-qam", "branch: one more panel edit");
    refused(s.check(), /off the safe list changed since it was measured at [0-9a-f]{8} \(\d+ of them [^)]*\): src\/ui\/Panel\.tsx/);
  } finally { s.done(); }
});

test("a range of safe files alone needs no audit at all", () => {
  const dir = tempDir("fls-safe-range-");
  const git = gitIn(dir);
  const write = (path: string, text: string) => { mkdirSync(dirname(join(dir, path)), { recursive: true }); writeFileSync(join(dir, path), text); };
  try {
    write("scripts/uiGeometryAudit.mjs", "// the audit\n"); write("src/ui/Panel.tsx", "export const Panel = 1;\n"); write("docs/a.md", "a\n");
    write("docs/verification/uiaudit1/geometry-baseline.json", '{"entries":[]}'); write("docs/verification/uiaudit1/geometry-exceptions.json", '{"exceptions":[]}');
    git("init", "-q"); git("add", "-A"); git("commit", "-qm", "c"); const base = git("rev-parse", "HEAD");
    write("docs/a.md", "b\n"); write("tests/x.test.ts", "export {};\n"); git("add", "-A"); git("commit", "-qm", "docs and a test");
    const result = checkUiGeometry({ base, head: git("rev-parse", "HEAD"), cwd: dir, mode: "enforce", env: {} });
    assert.equal(result.ok, true, result.reasons.join("\n"));
    assert.match(formatUiGeometryResult(result), /only files on the safe list changed \(2\): no audit needed \(RR26\)/);
    write("src/ui/Panel.tsx", "export const Panel = 2;\n"); git("add", "-A"); git("commit", "-qm", "one UI file");
    const one = checkUiGeometry({ base, head: git("rev-parse", "HEAD"), cwd: dir, mode: "enforce", env: {} });
    assert.equal(one.ok, false, "a single file off the safe list needs an audit");
    assert.equal(one.unchanged, false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("the safe list: docs/**, .md outside src/ public/ assets-inbox/, tests nothing imports — and nothing else", () => {
  const imported = new Set(["tests/fixtures/geometryRows.ts"]);
  for (const path of ["docs/x.json", "docs/a/b.png", "README.md", "scripts/a.md", "tests/x.test.ts"]) assert.ok(isSafePath(path, imported), path);
  for (const path of ["src/a.md", "public/a.md", "assets-inbox/a.md", "tests/fixtures/geometryRows.ts", "fixtures/a.json", "seeds/a", "perf/a", "scripts/a.ts", "package.json", "index.html", "tsconfig.json", "x"]) assert.ok(!isSafePath(path, imported), path);
  // Lookalikes: a docs/ or tests/ folder inside src/, a name with .md inside it.
  for (const path of ["src/docs/x.ts", "src/tests/x.ts", "scripts/a.md.ts", "public/docs/a.png", "src/ui/README.md.tsx", "docs.ts", "docsite/a.ts", "tests.config.ts", "testsuite/a.ts"]) assert.ok(!isSafePath(path, imported), path);
  assert.ok(!isSafePath("tests/x.test.ts", null), "no closure: no test is safe");
});

test("a broken result does not count: measured dirty, a condition not opened, a new failure, a baseline entry fixed", () => {
  for (const [report, baseline, expected] of [
    [{ dirty: true }, [], /measured from a tree with uncommitted changes/],
    [{ unopened: 1 }, [], /1 surface condition\(s\) could not be opened/],
    [{ keys: ["overflow|.panel-body"] }, [], /2 new failure\(s\), in no baseline entry or exception/],   // one per condition
    [{}, [`${ROW}|${CONDITIONS[0]}|overflow|.panel-body`], /1 baseline entr\(ies\) of its rows fixed, drop them/],
  ] as const) {
    const s = story({ trunkMove: write => write("docs/notes.md", "moved\n"), report, baseline: [...baseline] });
    try { refused(s.check(), expected); } finally { s.done(); }
  }
});

test("a failure already in the baseline is no new failure, and another row's baseline entries are not this run's to fix", () => {
  const s = story({ trunkMove: write => write("docs/notes.md", "moved\n"), report: { keys: ["overflow|.panel-body"] }, baseline: CONDITIONS.map(c => `${ROW}|${c}|overflow|.panel-body`) });
  try { assert.equal(s.check().ok, true); } finally { s.done(); }
  const t = story({ trunkMove: write => write("docs/notes.md", "moved\n"), baseline: ["other.row|1280x800/normal/normal|overflow|.x"] });
  try { assert.equal(t.check().ok, true); } finally { t.done(); }
});

test("an exception covers a row run's failure as it covers the shared result's", () => {
  const s = story({ trunkMove: write => write("docs/notes.md", "moved\n"), report: { keys: ["overflow|.panel-body"] }, exceptions: [{ row: ROW, check: "overflow", match: ".panel-body", reason: "a known long title" }] });
  try { assert.equal(s.check().ok, true, s.check().reasons.join("\n")); } finally { s.done(); }
});

test("without the trailer the stale shared result fails, naming what changed off the safe list since it", () => {
  const s = story({ trunkMove: write => write("docs/notes.md", "moved\n"), trailer: false });
  try { refused(s.check(), /^the shared result \(run full-old\): 2 file\(s\) off the safe list changed since it was measured at [0-9a-f]{8} .*src\/styles\/panel\.css, src\/ui\/Panel\.tsx — audit again: refresh it/); } finally { s.done(); }
});

test("a current shared result with its own new failure is not set aside by a trailer", () => {
  const s = story({ trunkMove: write => write("docs/notes.md", "moved\n"), shared: "current-failing" });
  try { refused(s.check(), /1 new failure\(s\), in no baseline entry or exception/); } finally { s.done(); }
});

test("a shared result written by a changed-rows run is no full audit: it does not count, the named run does", () => {
  const s = story({ trunkMove: write => write("docs/notes.md", "moved\n"), shared: "partial", trailer: false });
  try { refused(s.check(), /the shared result \(run rows-only, 1 row\(s\)\) is not a full audit/); } finally { s.done(); }
  const t = story({ trunkMove: write => write("docs/notes.md", "moved\n"), shared: "partial" });
  try { assert.equal(t.check().ok, true, "with the trailer the run's own report decides"); } finally { t.done(); }
});

test("a shared result that does not say it is a full audit (as before RR26), or leaves out what it must say, does not count", () => {
  const s = story({ trunkMove: write => write("docs/notes.md", "moved\n"), shared: "no-full", trailer: false });
  try { refused(s.check(), /the shared result \(run before-rr26, 17 row\(s\)\) is not a full audit/); } finally { s.done(); }
  const t = story({ trunkMove: write => write("docs/notes.md", "moved\n"), shared: "unsaid" });
  try {
    const result = t.check();
    for (const pattern of [/does not say whether the tree was clean/, /does not count the surface conditions not opened/, /does not count the framed roots no registry row measures/]) refused(result, pattern);
  } finally { t.done(); }
});

test("a current full shared result measured dirty, with a condition not opened or a framed root off the registry, does not count", () => {
  const s = story({ trunkMove: write => write("docs/notes.md", "moved\n"), shared: "current-broken" });
  try {
    const result = s.check();
    for (const pattern of [/^the result was measured from a tree with uncommitted changes$/, /^1 surface condition\(s\) could not be opened$/, /^2 framed root\(s\) \(data-frame\) on screen that no registry row measures$/]) refused(result, pattern);
  } finally { s.done(); }
});

test("only a full audit writes the shared result by default", () => {
  assert.equal(defaultSummaryPath({ explicit: undefined, full: true }), "docs/verification/uiaudit1/geometry.json");
  assert.equal(defaultSummaryPath({ explicit: undefined, full: false }), "none");
  assert.equal(defaultSummaryPath({ explicit: "out/x.json", full: false }), "out/x.json");
});

test("a run that is not what the trailer names, has no measured commit, or names one not here or not in the pushed history, does not count", () => {
  for (const [report, expected] of [
    [{ runName: "render-SOMETHING-ELSE" }, /its report names another run \(render-SOMETHING-ELSE\)/],
    [{ commit: null }, /its report has no measured commit/],
    [{ commit: "0123456789abcdef0123456789abcdef01234567" }, /its measured commit 01234567 is not here/],
    [{ commitOf: "outside" }, /is not in the pushed history \(amended or rebased away\)/],
  ] as const) {
    const s = story({ trunkMove: write => write("docs/notes.md", "moved\n"), report });
    try { refused(s.check(), expected); } finally { s.done(); }
  }
});

test("a run with a framed root outside the registry, with no row measured, with a broken row, narrowed, or leaving out what it must say, does not count", () => {
  for (const [report, expected] of [
    [{ unregistered: 1 }, /1 framed root\(s\) on screen that no registry row measures/],
    [{ noRows: true }, /no row was measured/],
    [{ rowsNull: true }, /no row was measured/],
    [{ axesNarrowed: true }, /narrowed by --viewports, --copy or --numbers/],
    [{ axesNarrowed: null }, /does not say it measured every condition/],
    [{ omit: "dirty" }, /its report does not say whether the tree was clean/],
    [{ omit: "totals" }, /its report does not count the surface conditions not opened/],
    [{ omit: "unregisteredFramed" }, /its report does not list the framed roots no registry row measures/],
    [{ errorCondition: true }, /1 surface condition\(s\) could not be opened/],
  ] as const) {
    const s = story({ trunkMove: write => write("docs/notes.md", "moved\n"), report });
    try { refused(s.check(), expected); } finally { s.done(); }
  }
});

test("a trailer naming a run with no committed report does not count, and gives way to a newer named run", () => {
  const s = story({ trunkMove: write => write("docs/notes.md", "moved\n") });
  try {
    s.git("commit", "-q", "--allow-empty", "-m", "a run never committed\n\nUI-Geometry-Run: render-TEST-never");
    refused(s.check(), /render-TEST-never.*commit the run's report/);
    s.run("render-TEST-geometry-2");
    const result = s.check();
    assert.equal(result.ok, true, result.reasons.join("\n"));
    assert.match(formatUiGeometryResult(result), /run render-TEST-never: superseded — it has no report or no measured row, and a newer named run holds/);
  } finally { s.done(); }
});

test("the remedy works: a stale run is superseded by a newer named run of the same rows — but not by one that measured only some of them", () => {
  const s = story({ trunkMove: write => write("src/styles/global.css", ":root { --gap: 10px; }\n") });
  try {
    refused(s.check(), /src\/styles\/global\.css/);
    s.run("render-TEST-geometry-2");
    const result = s.check();
    assert.equal(result.ok, true, result.reasons.join("\n"));
    assert.match(formatUiGeometryResult(result), /run render-TEST-geometry-1: superseded — a newer named run measured its rows \(modal\.panel\) again/);
  } finally { s.done(); }
  const t = story({ trunkMove: write => write("src/styles/global.css", ":root { --gap: 10px; }\n"), rowIds: ["row.A", "row.B"] });
  try { t.run("render-TEST-geometry-2", ["row.A"]); refused(t.check(), /render-TEST-geometry-1: 1 file\(s\) off the safe list .*src\/styles\/global\.css/); } finally { t.done(); }
});

test("comments go, strings and regular expressions stay (the closure kept for the report)", () => {
  assert.equal(withoutComments('import {\n a, // the panel\'s helper\n} from "./a.ts";'), 'import {\n a, \n} from "./a.ts";');
  assert.equal(withoutComments('const s = "// kept"; const r = /\\/\\//g; /* gone */ x'), 'const s = "// kept"; const r = /\\/\\//g;   x');
});

test("dirty: every uncommitted change off the safe list (edited, untracked, staged, renamed, deleted), not one on it; an LFS picture by content", () => {
  const dir = tempDir("fls-dirty-");
  const git = gitIn(dir);
  const write = (path: string, text: string | Buffer) => { mkdirSync(dirname(join(dir, path)), { recursive: true }); writeFileSync(join(dir, path), text); };
  try {
    const picture = Buffer.from("real picture bytes"); const oid = createHash("sha256").update(picture).digest("hex");
    const pointer = `version https://git-lfs.github.com/spec/v1\noid sha256:${oid}\nsize ${picture.length}\n`;
    write("scripts/uiGeometryAudit.mjs", 'import { R } from "../tests/fixtures/rows.ts";\n'); write("tests/fixtures/rows.ts", "export const R = 1;\n");
    write("src/ui/Panel.tsx", "export const Panel = 1;\n"); write("src/engine/core.ts", "export const core = 1;\n"); write("public/assets/a.png", "a\n");
    write("public/assets/lfs.png", pointer); write("assets-inbox/w/lfs.png", pointer); write("docs/a.md", "a\n"); write("tests/x.test.ts", "export {};\n");
    write("src/ui/한글 패널.tsx", "export const k = 1;\n");
    git("init", "-q"); git("add", "-A"); git("commit", "-qm", "c");
    write("public/assets/lfs.png", picture); write("assets-inbox/w/lfs.png", picture);   // a run folder holds the pictures, not the pointers
    assert.deepEqual(uiInputsDirty(dir), [], "LFS pictures whose content matches their pointers are clean, wherever they are");
    write("docs/a.md", "b\n"); write("tests/x.test.ts", "export const y = 1;\n"); write("docs/new.md", "n\n");
    assert.deepEqual(uiInputsDirty(dir), [], "changes on the safe list are not dirty");
    write("src/engine/core.ts", "export const core = 2;\n"); write("src/ui/New.tsx", "export const New = 1;\n"); write("tests/fixtures/rows.ts", "export const R = 2;\n");
    write("src/ui/한글 패널.tsx", "export const k = 2;\n"); write("tools/x.cfg", "x\n");
    assert.deepEqual(uiInputsDirty(dir), ["src/engine/core.ts", "src/ui/New.tsx", "src/ui/한글 패널.tsx", "tests/fixtures/rows.ts", "tools/x.cfg"]);
    git("checkout", "-q", "--", "src", "tests"); rmSync(join(dir, "src/ui/New.tsx")); rmSync(join(dir, "tools"), { recursive: true });
    write("src/ui/Staged.tsx", "export const S = 1;\n"); git("add", "src/ui/Staged.tsx");
    assert.deepEqual(uiInputsDirty(dir), ["src/ui/Staged.tsx"], "a staged new file");
    git("rm", "-q", "--cached", "src/ui/Staged.tsx"); rmSync(join(dir, "src/ui/Staged.tsx"));
    git("mv", "src/ui/Panel.tsx", "src/ui/Panel2.tsx");
    assert.deepEqual(uiInputsDirty(dir), ["src/ui/Panel.tsx", "src/ui/Panel2.tsx"], "a staged rename: both paths");
    git("mv", "src/ui/Panel2.tsx", "src/ui/Panel.tsx");
    rmSync(join(dir, "public/assets/a.png"));
    assert.deepEqual(uiInputsDirty(dir), ["public/assets/a.png"], "a deleted picture");
    write("public/assets/a.png", "a\n"); write("public/assets/lfs.png", pointer);
    assert.deepEqual(uiInputsDirty(dir), ["public/assets/lfs.png"], "the pointer text in place of the picture");
    write("public/assets/lfs.png", picture); write("assets-inbox/w/lfs.png", pointer);
    assert.deepEqual(uiInputsDirty(dir), ["assets-inbox/w/lfs.png"], "the pointer text in place of a picture under assets-inbox/");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a full shared result measured at a commit outside the history, or with none, does not count", () => {
  for (const [shared, expected] of [
    ["orphan", /^the shared result \(run full-old\): its measured commit [0-9a-f]{8} is not in the pushed history: refresh it/],
    ["no-commit", /^the shared result \(run full-old\): its measured commit \(none\) is not here: refresh it/],
  ] as const) {
    const s = story({ trunkMove: write => write("docs/notes.md", "moved\n"), shared, trailer: false });
    try { refused(s.check(), expected); } finally { s.done(); }
  }
});
