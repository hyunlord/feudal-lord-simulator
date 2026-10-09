import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { gitIn, tempDir } from "./helpers/tempRepo";
import { checkUiGeometry, formatUiGeometryResult } from "../scripts/checks/uiGeometry.mjs";
import { packInputs } from "../scripts/checks/testInputs/testInputs.mjs";

// RR26 measured (a′, user ruling 2026-10-10): a geometry result counts on a newer commit when nothing its audit read
// changed since — the files, listed folders and missing paths the dev server and the audit read (scripts/
// uiGeometryInputs.mjs writes them next to the result, linked by hash), a package.json or tsconfig.json anywhere and the
// lock file. Without a measurement, a broken one or an untraceable audit, the safe list judges. The declared inputs (the
// scene state folders, the browser, Vite's dependency cache) are bound by value: a named run on other states leaves the
// shared result's rows on them stale. Each case is made to break the rule on purpose (RR22). The story: the trunk with a
// full shared audit (and its measured inputs), a branch that changes one thing, and the gate on the branch.
const SHARED = "docs/verification/uiaudit1/geometry.json";
const RUNS = "docs/verification/uiaudit1/geometry";
const CONDITIONS = ["1280x800/normal/normal", "390x844/normal/normal"];
// What the audit read in the story: the entry, a panel, its CSS and the picture the CSS calls with url(), a module the
// app imports dynamically, the audit's own script; a path the resolver looked for and missed (src/ui/Panel.ts).
const READ = ["index.html", "src/main.tsx", "src/ui/Panel.tsx", "src/styles/panel.css", "public/assets/frame.png", "src/lazy/Lazy.tsx", "scripts/uiGeometryAudit.mjs"];
type Inputs = { files?: string[]; dirs?: string[]; lists?: string[]; missing?: string[]; untraceable?: string[] };
type Declared = { states?: Record<string, string>; chromium?: string; playwright?: string; lock?: string; system?: Record<string, string>; viteDeps?: { hash: string; browserHash: string } };
type Measure = { inputs?: Inputs; declared?: Declared; tamper?: "hash" | "uncommitted" | "kind"; none?: boolean };

/** Write a run's report (and its measured inputs) and, for a full audit, the shared summary. */
function writeRun(write: (path: string, text: string) => void, { run, commit, rows, full, measure = {}, retries }: { run: string; commit: string; rows: Record<string, string>; full: boolean; measure?: Measure; retries?: Record<string, number> | undefined }) {
  const file = `${RUNS}/${run}/inputs.json`;
  // Missing: a path tried with an extension (src/ui/Panel.ts beside Panel.tsx) and one an import named without one (src/ui/Widget).
  const inputs = { files: measure.inputs?.files ?? READ, dirs: measure.inputs?.dirs ?? [], lists: measure.inputs?.lists ?? [], missing: measure.inputs?.missing ?? ["src/ui/Panel.ts", "src/ui/Widget"], untraceable: measure.inputs?.untraceable ?? [] };
  const declared = { states: { ui5: "ui5-a", lord2: "lord2-a" }, chromium: "140.0", viteDeps: { hash: "deps-a", browserHash: "b-a" }, ...measure.declared };
  const body = `${JSON.stringify({ schema: 1, kind: measure.tamper === "kind" ? "other" : "ui-geometry-inputs", run, commit, declared, inputs: packInputs(new Map([["audit", inputs]])) })}\n`;
  if (measure.tamper !== "uncommitted" && !measure.none) write(file, body);
  const link = measure.none ? undefined : { file, sha256: measure.tamper === "hash" ? "0".repeat(64) : createHash("sha256").update(body).digest("hex"), files: inputs.files.length, untraceable: inputs.untraceable, declared };
  const reportRows = Object.fromEntries(Object.entries(rows).map(([row, scene]) => [row, { scene, conditions: Object.fromEntries(CONDITIONS.map(c => [c, { status: "measured", keys: [] }])) }]));
  write(`${RUNS}/${run}/geometry.json`, JSON.stringify({ run, commit, full, axesNarrowed: false, dirty: false, totals: { unopened: 0 }, unregisteredFramed: [], rows: reportRows, ...(link ? { measuredInputs: link } : {}) }));
  if (full) write(SHARED, JSON.stringify({ run, full: true, commit, dirty: false, failureKeys: [], unopened: 0, unregisteredFramed: 0, rows: Object.keys(rows).length,
    conditions: Object.keys(rows).length * CONDITIONS.length, report: `${RUNS}/${run}/geometry.json`, ...(link ? { measuredInputs: link } : {}), ...(retries ? { retries: { timeouts: 3, failedThrice: 1, cellsRetried: 2, treesRetried: 1, rows: retries } } : {}) }));
}

const SHARED_ROWS = { "hud.panel": "ui5", "lord.card": "lord2", "modal.other": "ui6" };

function story({ measure = {}, retries }: { measure?: Measure; retries?: Record<string, number> | undefined } = {}) {
  const dir = tempDir("fls-measured-");
  const git = gitIn(dir);
  const write = (path: string, text: string) => { mkdirSync(dirname(join(dir, path)), { recursive: true }); writeFileSync(join(dir, path), text); };
  for (const path of READ) write(path, `${path}\n`);
  write("src/unused.ts", "export const u = 1;\n"); write("scripts/checks/other.mjs", "export const o = 1;\n"); write("package-lock.json", "{}\n");
  write("public/assets/other.png", "other\n");
  write("docs/verification/uiaudit1/geometry-baseline.json", '{"entries":[]}'); write("docs/verification/uiaudit1/geometry-exceptions.json", '{"exceptions":[]}');
  git("init", "-q", "-b", "trunk"); git("add", "-A"); git("commit", "-qm", "trunk");
  const measured = git("rev-parse", "HEAD");
  writeRun(write, { run: "full-1", commit: measured, rows: SHARED_ROWS, full: true, measure, retries });
  git("add", "-A"); git("commit", "-qm", "the full audit and its measured inputs");
  const base = git("rev-parse", "HEAD");
  git("checkout", "-qb", "branch");
  const check = () => checkUiGeometry({ base, head: git("rev-parse", "HEAD"), cwd: dir, mode: "enforce", env: {} });
  const commit = (message: string) => { git("add", "-A"); git("commit", "-qm", message); };
  return { dir, git, write, check, commit, measured, done: () => rmSync(dir, { recursive: true, force: true }) };
}

const refused = (result: ReturnType<typeof checkUiGeometry>, pattern: RegExp) => assert.ok(!result.ok && result.reasons.some(reason => pattern.test(reason)), result.reasons.join("\n"));
const escape = (text: string) => text.replace(/[./*+?()[\]]/g, "\\$&");

for (const [what, path] of [
  ["a src file no page loads", "src/unused.ts"],
  ["a check script neither the server nor the audit reads", "scripts/checks/other.mjs"],
  ["a picture no page loads", "public/assets/other.png"],
] as const) {
  test(`not read by the audit: ${what} (${path}) changed — no audit needed, the output says it was measured`, () => {
    const s = story();
    try {
      s.write(path, "changed\n"); s.commit("branch: one file");
      const result = s.check();
      assert.equal(result.ok, true, result.reasons.join("\n"));
      assert.match(formatUiGeometryResult(result), /nothing the audit read changed \(1 file\(s\), measured inputs of the shared result\): no audit needed \(RR26 measured\)/);
    } finally { s.done(); }
  });
}

for (const [what, change, named] of [
  ["the picture a CSS rule calls with url()", (s: ReturnType<typeof story>) => s.write("public/assets/frame.png", "new frame\n"), "public/assets/frame.png"],
  ["the module the app imports dynamically", (s: ReturnType<typeof story>) => s.write("src/lazy/Lazy.tsx", "export const Lazy = 2;\n"), "src/lazy/Lazy.tsx"],
  ["a panel changed to import a new file", (s: ReturnType<typeof story>) => { s.write("src/ui/New.tsx", "export const New = 1;\n"); s.write("src/ui/Panel.tsx", 'import { New } from "./New";\n'); }, "src/ui/Panel.tsx"],
  ["a new file where the resolver looked and found nothing (it now shadows Panel.tsx)", (s: ReturnType<typeof story>) => s.write("src/ui/Panel.ts", "export const Panel = 0;\n"), "src/ui/Panel.ts"],
  ["a module added where an import written without an extension looked (src/ui/Widget, now src/ui/Widget.tsx)", (s: ReturnType<typeof story>) => s.write("src/ui/Widget.tsx", "export const Widget = 1;\n"), "src/ui/Widget.tsx"],
  ["the lock file", (s: ReturnType<typeof story>) => s.write("package-lock.json", '{"lockfileVersion":3}\n'), "package-lock.json"],
  ["a package.json in a folder", (s: ReturnType<typeof story>) => s.write("src/ui/package.json", '{"type":"module"}\n'), "src/ui/package.json"],
  ["the audit's own script", (s: ReturnType<typeof story>) => s.write("scripts/uiGeometryAudit.mjs", "// changed\n"), "scripts/uiGeometryAudit.mjs"],
] as const) {
  test(`read by the audit: ${what} changed — the shared result is stale, the output names ${named} as measured`, () => {
    const s = story();
    try {
      change(s); s.commit("branch: a change the audit reads");
      refused(s.check(), new RegExp(`^the shared result \\(run full-1\\): \\d+ file\\(s\\) the audit read changed since it was measured at [0-9a-f]{8} \\(measured inputs\\): [^\\n]*${escape(named)}[^\\n]* — audit again: refresh it`));
    } finally { s.done(); }
  });
}

test("a folder listed one level (the dependency scanner lists the root; Vite lists public/ folder by folder): an entry added or removed counts, a file changed does not", () => {
  const cases: [string, (s: ReturnType<typeof story>) => void, string | null][] = [
    ["a document added under docs/ (the root's entries stay)", s => s.write("docs/new.md", "new\n"), null],
    ["a new file at the root", s => s.write("NEW.md", "new\n"), "NEW.md"],
    ["a picture no page loads changed in a listed folder", s => s.write("public/assets/other.png", "changed\n"), null],
    ["a picture added to a listed folder", s => s.write("public/assets/added.png", "added\n"), "public/assets/added.png"],
    ["a picture removed from a listed folder", s => s.git("rm", "-q", "public/assets/other.png"), "public/assets/other.png"],
  ];
  for (const [what, change, named] of cases) {
    const s = story({ measure: { inputs: { lists: ["", "public", "public/assets"] } } });
    try {
      change(s); s.commit(`branch: ${what}`);
      const result = s.check();
      if (named === null) assert.equal(result.ok, true, `${what}: ${result.reasons.join("\n")}`);
      else refused(result, new RegExp(`the audit read changed since it was measured at [0-9a-f]{8} \\(measured inputs\\): [^\\n]*${escape(named)}`));
    } finally { s.done(); }
  }
});

test("a folder the server listed (public/, Vite's public files): a new picture in it is a change the audit read", () => {
  const s = story({ measure: { inputs: { dirs: ["public"] } } });
  try {
    s.write("public/assets/added.png", "added\n"); s.commit("branch: a new picture");
    refused(s.check(), /the audit read changed since it was measured at [0-9a-f]{8} \(measured inputs\): public\/assets\/added\.png/);
  } finally { s.done(); }
});

for (const [what, measure, why] of [
  ["no measured inputs", { none: true }, /judged by the safe list: no measured inputs/],
  ["measured inputs not committed", { tamper: "uncommitted" }, /judged by the safe list: its measured inputs \(.*inputs\.json\) are not committed/],
  ["measured inputs that do not match their hash", { tamper: "hash" }, /judged by the safe list: its measured inputs \(.*\) do not match their hash/],
  ["measured inputs of another kind", { tamper: "kind" }, /judged by the safe list: its measured inputs \(.*\) are of another kind or schema/],
  ["an audit that did what the recorder cannot follow", { inputs: { untraceable: ["dev server: child process: esbuild"] } }, /judged by the safe list: not measurable: dev server: child process: esbuild/],
] as const) {
  test(`${what}: the safe list judges — a src file no page loads now needs an audit, and the output says why`, () => {
    const s = story({ measure: measure as Measure });
    try {
      s.write("src/unused.ts", "changed\n"); s.commit("branch: one file");
      const result = s.check();
      refused(result, /^the shared result \(run full-1\): 1 file\(s\) off the safe list changed since it was measured/);
      assert.ok(result.reasons.some(reason => why.test(reason)), result.reasons.join("\n"));
      s.git("reset", "-q", "--hard", "HEAD~1"); s.write("docs/notes.md", "x\n"); s.commit("branch: a document");
      assert.equal(s.check().ok, true, "a document alone still needs no audit");
    } finally { s.done(); }
  });
}

/** The branch changes the panel (a file the audit read) and commits a changed-rows run of `rows` with the trailer. */
function withRun(s: ReturnType<typeof story>, rows: Record<string, string>, declared: Declared) {
  s.write("src/ui/Panel.tsx", "export const Panel = 2;\n"); s.commit("branch: the panel");
  writeRun(s.write, { run: "rows-1", commit: s.git("rev-parse", "HEAD"), rows, full: false, measure: { declared } });
  s.git("add", "-A"); s.git("commit", "-qm", "branch: the changed rows' geometry\n\nUI-Geometry-Run: rows-1");
  return s.check();
}

test("a state folder changed: the named run's states differ from the shared result's — its rows on that set must be measured again", () => {
  const s = story();
  try { refused(withRun(s, { "hud.panel": "ui5" }, { states: { ui5: "ui5-a", lord2: "lord2-b" } }), /run rows-1: the state folder\(s\) lord2 changed since the shared result \(run full-1\) — 1 row\(s\) it measured on them are not measured again: lord\.card/); }
  finally { s.done(); }
  const t = story();
  try { const result = withRun(t, { "hud.panel": "ui5", "lord.card": "lord2" }, { states: { ui5: "ui5-a", lord2: "lord2-b" } }); assert.equal(result.ok, true, result.reasons.join("\n")); }
  finally { t.done(); }
  const u = story();
  try { const result = withRun(u, { "hud.panel": "ui5" }, { states: { ui5: "ui5-a", lord2: "lord2-a" } }); assert.equal(result.ok, true, "the same states: the run counts for its rows"); }
  finally { u.done(); }
});

test("the browser or Vite's dependency cache changed: every row is stale — a full audit", () => {
  for (const [declared, named] of [[{ chromium: "141.0" }, /chromium changed since the shared result \(run full-1\): every row is stale — a full audit/],
    [{ viteDeps: { hash: "deps-b", browserHash: "b-b" } }, /Vite's dependency cache changed since the shared result/]] as const) {
    const s = story();
    try { refused(withRun(s, { "hud.panel": "ui5" }, declared), named); } finally { s.done(); }
  }
});

test("the retries: the rate and the rows retried again since the shared result before", () => {
  const s = story({ retries: { "hud.panel": 2 } });
  try {
    // A new full audit on the branch that retried hud.panel again and lord.card for the first time.
    writeRun(s.write, { run: "full-2", commit: s.git("rev-parse", "HEAD"), rows: SHARED_ROWS, full: true, retries: { "hud.panel": 1, "lord.card": 1 } });
    s.commit("branch: a new full audit");
    const text = formatUiGeometryResult(s.check());
    assert.match(text, /retries in run full-2: 2 condition\(s\) needed another attempt of 6 \(33\.3 %\), 3 first-attempt timeout\(s\), 1 failed three times, 1 tree\(s\) re-run — hud\.panel, lord\.card/);
    assert.match(text, /retried again \(also in full-1\): hud\.panel — a wait condition to fix/);
  } finally { s.done(); }
});

test("a changed-rows run is judged by its own measured inputs: a file it did not read changed after it keeps it; one it read does not", () => {
  const s = story();
  try {
    assert.equal(withRun(s, { "hud.panel": "ui5", "lord.card": "lord2", "modal.other": "ui6" }, {}).ok, true);
    s.write("src/unused.ts", "changed after the run\n"); s.commit("branch: a file no page loads");
    const kept = s.check();
    assert.equal(kept.ok, true, kept.reasons.join("\n"));
    assert.match(formatUiGeometryResult(kept), /run rows-1 \(commit [0-9a-f]{8}\): 3 row\(s\), 6 cell\(s\), no new failure; 3 file\(s\) changed since it was measured, none the audit read \(measured inputs\)/);
    s.write("src/styles/panel.css", ".panel { padding: 1px; }\n"); s.commit("branch: the panel's CSS");
    refused(s.check(), /run rows-1: 1 file\(s\) the audit read changed since it was measured at [0-9a-f]{8} \(measured inputs\): src\/styles\/panel\.css — audit again/);
  } finally { s.done(); }
});

test("a file added where Vite would now resolve an import first counts though no missing path was recorded (it resolves natively)", () => {
  for (const [path, counts] of [["src/ui/Panel.ts", true], ["src/main.js", true], ["src/lazy/Lazy.ts", true], ["src/lazy.ts", false], ["src/ui/Panel/index.ts", false], ["src/ui/Other.tsx", false]] as const) {
    const s = story({ measure: { inputs: { missing: [] } } });
    try {
      s.write(path, "export const x = 1;\n"); s.commit(`branch: ${path}`);
      const result = s.check();
      if (counts) refused(result, new RegExp(`the audit read changed since it was measured at [0-9a-f]{8} \\(measured inputs\\): ${escape(path)}`));
      else assert.equal(result.ok, true, `${path}: ${result.reasons.join("\n")}`);
    } finally { s.done(); }
  }
});

test("declared inputs are compared even when nothing the audit read changed (a state builder alone, with a named run on new states)", () => {
  const s = story();
  try {
    s.write("scripts/states.ts", "// a state builder\n"); s.commit("branch: a state builder");
    writeRun(s.write, { run: "rows-1", commit: s.git("rev-parse", "HEAD"), rows: { "hud.panel": "ui5" }, full: false, measure: { declared: { states: { ui5: "ui5-a", lord2: "lord2-b" } } } });
    s.git("add", "-A"); s.git("commit", "-qm", "branch: the changed rows' geometry\n\nUI-Geometry-Run: rows-1");
    refused(s.check(), /run rows-1: the state folder\(s\) lord2 changed since the shared result \(run full-1\)/);
  } finally { s.done(); }
});

test("every declared input is compared, and one recorded on one side only counts as changed: the lock, the system files, Playwright", () => {
  for (const [declared, named] of [[{ lock: "lock-b" }, /the lock file changed since the shared result/], [{ system: { "/proc/version": "k2" } }, /the system identity files changed since the shared result/],
    [{ playwright: "1.62.1" }, /playwright changed since the shared result/], [{ viteDeps: { hash: "deps-a", browserHash: "b-b" } }, /Vite's dependency cache changed/]] as const) {
    const s = story();
    try { refused(withRun(s, { "hud.panel": "ui5" }, declared as Declared), named); } finally { s.done(); }
  }
});

test("a named run that measured every row may carry another browser; a refused run adds no declared reason of its own", () => {
  const s = story();
  try { const result = withRun(s, SHARED_ROWS, { chromium: "141.0" }); assert.equal(result.ok, true, result.reasons.join("\n")); } finally { s.done(); }
  const t = story();
  try {
    t.write("src/ui/Panel.tsx", "export const Panel = 2;\n"); t.commit("branch: the panel");
    writeRun(t.write, { run: "rows-1", commit: t.git("rev-parse", "HEAD"), rows: { "hud.panel": "ui5" }, full: false, measure: { declared: { states: { ui5: "ui5-a", lord2: "lord2-b" } } } });
    t.write(`${RUNS}/rows-1/geometry.json`, JSON.stringify({ ...JSON.parse(readFileSync(join(t.dir, RUNS, "rows-1/geometry.json"), "utf8")), dirty: true }));
    t.git("add", "-A"); t.git("commit", "-qm", "branch: a dirty run\n\nUI-Geometry-Run: rows-1");
    const result = t.check();
    refused(result, /run rows-1: measured from a tree with uncommitted changes/);
    assert.ok(!result.reasons.some(reason => /state folder/.test(reason)), result.reasons.join("\n"));
  } finally { t.done(); }
});

test("no retry line when the range brings no new shared result", () => {
  const s = story({ retries: { "hud.panel": 2 } });
  try { s.write("docs/notes.md", "x\n"); s.commit("branch: a document"); assert.doesNotMatch(formatUiGeometryResult(s.check()), /retries in run/); } finally { s.done(); }
});
