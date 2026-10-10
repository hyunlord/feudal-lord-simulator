import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { gitIn, tempDir } from "./helpers/tempRepo";
import { checkUiGeometry, formatUiGeometryResult } from "../scripts/checks/uiGeometry.mjs";

// RR26 covered (user ruling 2026-10-10): a result stays good at <head> when the files changed since it were changed by
// trunk pushes that carried their own evidence — a UI-Geometry-Run trailer whose run measured a tree holding the change,
// a new full shared result measured on one, or (recorded) a UI-Geometry-Override — and the commits this push brings do
// not change them; those new commits are judged as before. Each case is made to break the rule on purpose (RR22). The
// story (as on 2026-10-10): a push audits its own change in full on its branch (5 hours) while the trunk takes other
// pushes; it then merges the trunk and the gate runs on trunk..head.
const SHARED = "docs/verification/uiaudit1/geometry.json";
const RUNS = "docs/verification/uiaudit1/geometry";
const CONDITIONS = ["1280x800/normal/normal", "390x844/normal/normal"];

function story({ own = "full" }: { own?: "full" | "rows" } = {}) {
  const dir = tempDir("fls-covered-");
  const git = gitIn(dir);
  const write = (path: string, text: string) => { mkdirSync(dirname(join(dir, path)), { recursive: true }); writeFileSync(join(dir, path), text); };
  const head = () => git("rev-parse", "HEAD");
  const commit = (message: string) => { git("add", "-A"); git("commit", "-qm", message, "--allow-empty"); return head(); };
  write("scripts/uiGeometryAudit.mjs", "// the audit\n"); write("scripts/tool.mjs", "// a script\n");
  for (const path of ["src/main.tsx", "src/ui/Panel.tsx", "src/ui/Card.tsx", "src/ui/Other.tsx"]) write(path, `// ${path}\n`);
  write("docs/verification/uiaudit1/geometry-baseline.json", '{"entries":[]}'); write("docs/verification/uiaudit1/geometry-exceptions.json", '{"exceptions":[]}');
  git("init", "-q", "-b", "trunk"); const c0 = commit("trunk");
  const full = (run: string, at: string) => write(SHARED, JSON.stringify({ run, full: true, commit: at, dirty: false, failureKeys: [], unopened: 0, unregisteredFramed: 0, rows: 1 }));
  full("full-0", c0); commit("the trunk's shared result");
  /** A changed-rows run's report measured at `at`, committed with its trailer. */
  const rowRun = (run: string, at: string) => {
    write(`${RUNS}/${run}/geometry.json`, JSON.stringify({ run, commit: at, axesNarrowed: false, dirty: false, totals: { unopened: 0 }, unregisteredFramed: [],
      rows: { "modal.panel": { conditions: Object.fromEntries(CONDITIONS.map(condition => [condition, { status: "measured", keys: [] }])) } } }));
    return commit(`its rows' geometry\n\nUI-Geometry-Run: ${run}`);
  };
  // The pushing branch: its own change (a script) and its own audit of it, measured before the trunk moves.
  git("checkout", "-qb", "pushing"); write("scripts/tool.mjs", "// the push's script\n"); const at = commit("pushing: the script");
  if (own === "full") { full("full-branch", at); commit("pushing: its full audit"); } else rowRun("pushing-rows", at);
  /** A trunk push: a side branch changes `path`, with `evidence`, merged into the trunk (a merge or fast-forward). */
  // An override is where the gate reads it: on the push's head — the merge commit of a merged push, or (fast-forward)
  // the commit that changed the file, pushed as the head.
  const OVERRIDE = (name: string) => `\n\nUI-Geometry-Override: ${name} pushed through the override, a reason`;
  const push = (name: string, path: string, evidence: "run" | "override" | "none" | "full", how: "merge" | "ff" = "merge") => {
    git("checkout", "-q", "trunk"); git("checkout", "-qb", name);
    write(path, `// ${path} changed by ${name}\n`); const changed = commit(`${name}: ${path}${evidence === "override" && how === "ff" ? OVERRIDE(name) : ""}`);
    if (evidence === "run") rowRun(`${name}-rows`, changed);
    if (evidence === "full") { full(`${name}-full`, changed); commit(`${name}: a new full audit`); }
    git("checkout", "-q", "trunk");
    if (how === "ff") git("merge", "-q", "--ff-only", name); else git("merge", "-q", "--no-ff", "-m", `Merge ${name}${evidence === "override" ? OVERRIDE(name) : ""}`, name);
    return head();
  };
  /** The pushing branch merges the trunk (its result stays ours); the gate on trunk..head. */
  const check = () => {
    git("checkout", "-q", "pushing"); const base = git("rev-parse", "trunk");
    try { git("merge", "-q", "--no-edit", "-X", "ours", "trunk"); } catch { /* a conflict-free story */ }
    return checkUiGeometry({ base, head: head(), cwd: dir, mode: "enforce", env: {} });
  };
  return { dir, git, write, commit, rowRun, full, push, check, OVERRIDE, done: () => rmSync(dir, { recursive: true, force: true }) };
}

const refused = (result: ReturnType<typeof checkUiGeometry>, pattern: RegExp) => assert.ok(!result.ok && result.reasons.some(reason => pattern.test(reason)), result.reasons.join("\n"));
const commitRe = (commit: string) => commit.slice(0, 8);

test("a UI commit pushed to the trunk with its trailer after the result is covered: the push passes, and the output names the cover", () => {
  for (const how of ["merge", "ff"] as const) {
    const s = story();
    try {
      const pushed = s.push("render", "src/ui/Panel.tsx", "run", how);
      const result = s.check();
      assert.equal(result.ok, true, `${how}: ${result.reasons.join("\n")}`);
      assert.match(formatUiGeometryResult(result), new RegExp(`the shared result \\(run full-branch\\): changes since covered by trunk pushes — ${commitRe(pushed)} \\(UI-Geometry-Run render-rows; 1 file\\(s\\)\\)`));
    } finally { s.done(); }
  }
});

test("a branch commit not on the trunk, merged without a trailer after the audit, is refused — only the trunk's own pushes are covered", () => {
  const s = story();
  try {
    s.push("render", "src/ui/Panel.tsx", "run");
    s.git("checkout", "-q", "trunk"); s.git("checkout", "-qb", "side"); s.write("src/ui/Card.tsx", "// changed off the trunk\n"); s.commit("side: the card");
    s.git("checkout", "-q", "pushing"); s.git("merge", "-q", "--no-ff", "--no-edit", "side");
    const result = s.check();
    refused(result, /the shared result \(run full-branch\): 1 file\(s\) off the safe list changed since it was measured at [0-9a-f]{8} .*: src\/ui\/Card\.tsx — audit again/);
  } finally { s.done(); }
});

test("a trunk commit pushed through the override is covered, and the output records its reason", () => {
  for (const how of ["merge", "ff"] as const) {
    const s = story();
    try {
      const pushed = s.push("hurried", "src/ui/Card.tsx", "override", how);
      const result = s.check();
      assert.equal(result.ok, true, result.reasons.join("\n"));
      assert.match(formatUiGeometryResult(result), new RegExp(`${commitRe(pushed)} \\(override, recorded: hurried pushed through the override, a reason; 1 file\\(s\\)\\)`));
    } finally { s.done(); }
  }
});

test("a trunk commit with no evidence of its own is not covered (the change stays a reason)", () => {
  const s = story();
  try {
    s.push("bare", "src/ui/Other.tsx", "none", "ff");
    refused(s.check(), /1 file\(s\) off the safe list changed since it was measured at [0-9a-f]{8} .*: src\/ui\/Other\.tsx/);
  } finally { s.done(); }
});

test("a file this push changed before its audit and a covered trunk push changed too: the merged file was never audited — refused", () => {
  const s = story();
  try {
    // Five lines: this push edits the first, the trunk push the last — git merges both, a content no audit measured.
    const lines = (first: string, last: string) => `${first}\n// 2\n// 3\n// 4\n${last}\n`;
    s.git("checkout", "-q", "trunk"); s.write("src/ui/Panel.tsx", lines("// 1", "// 5")); s.commit("trunk: the panel in five lines"); s.git("checkout", "-q", "pushing"); s.git("merge", "-q", "--no-edit", "trunk");
    s.write("src/ui/Panel.tsx", lines("// the push's first line", "// 5")); const at = s.commit("pushing: the panel");
    s.write(SHARED, JSON.stringify({ run: "full-branch2", full: true, commit: at, dirty: false, failureKeys: [], unopened: 0, unregisteredFramed: 0, rows: 1 })); s.commit("pushing: its full audit again");
    s.git("checkout", "-q", "trunk"); s.git("checkout", "-qb", "render"); s.write("src/ui/Panel.tsx", lines("// 1", "// the trunk's last line")); const changed = s.commit("render: the panel");
    s.rowRun("render-rows", changed); s.git("checkout", "-q", "trunk"); s.git("merge", "-q", "--no-ff", "--no-edit", "render");
    refused(s.check(), /src\/ui\/Panel\.tsx — audit again/);
  } finally { s.done(); }
});

test("a run measured before a trunk commit does not cover it, though its trailer comes later in the same push", () => {
  const s = story();
  try {
    s.git("checkout", "-q", "trunk"); s.git("checkout", "-qb", "late");
    s.write("src/ui/Panel.tsx", "// measured\n"); const measured = s.commit("late: the panel");
    s.write("src/ui/Card.tsx", "// after the run measured\n"); s.commit("late: the card, after the run");
    s.rowRun("late-rows", measured);
    s.git("checkout", "-q", "trunk"); s.git("merge", "-q", "--ff-only", "late");
    const result = s.check();
    refused(result, /1 file\(s\) off the safe list changed since it was measured at [0-9a-f]{8} .*: src\/ui\/Card\.tsx/);
  } finally { s.done(); }
});

test("an override covers only up to the nearest pushed measurement: a commit before a push measured without it stays a reason", () => {
  const s = story();
  try {
    s.git("checkout", "-q", "trunk"); s.git("checkout", "-qb", "a"); s.write("src/ui/Other.tsx", "// no evidence\n"); s.commit("a: other");
    s.git("checkout", "-q", "trunk"); s.git("merge", "-q", "--ff-only", "a");
    // A push whose run measured a tree without a's change (it branched before a), merged after it.
    s.git("checkout", "-qb", "b", "trunk~1"); s.write("src/ui/Card.tsx", "// b\n"); const bAt = s.commit("b: the card"); s.rowRun("b-rows", bAt);
    s.git("checkout", "-q", "trunk"); s.git("merge", "-q", "--no-ff", "--no-edit", "b");
    s.push("c", "src/main.tsx", "override", "ff");
    refused(s.check(), /src\/ui\/Other\.tsx/);
  } finally { s.done(); }
});

test("a new full shared result pushed on the trunk covers the commits it measured (for this push's changed-rows run)", () => {
  const s = story({ own: "rows" });
  try {
    s.push("nightly", "src/ui/Card.tsx", "full", "ff");
    const result = s.check();
    assert.equal(result.ok, true, result.reasons.join("\n"));
    assert.match(formatUiGeometryResult(result), /run pushing-rows: changes since covered by trunk pushes — [0-9a-f]{8} \(full audit nightly-full; 1 file\(s\)\)/);
  } finally { s.done(); }
});

test("a changed-rows run of this push stays good when the trunk moves with covered pushes", () => {
  const s = story({ own: "rows" });
  try {
    s.push("render", "src/ui/Panel.tsx", "run");
    const result = s.check();
    assert.equal(result.ok, true, result.reasons.join("\n"));
    assert.match(formatUiGeometryResult(result), /changed rows accepted[\s\S]*run pushing-rows: changes since covered by trunk pushes — [0-9a-f]{8} \(UI-Geometry-Run render-rows; 1 file\(s\)\)/);
  } finally { s.done(); }
});

test("without a base nothing is covered", () => {
  const s = story();
  try {
    s.push("render", "src/ui/Panel.tsx", "run");
    s.check();
    const result = checkUiGeometry({ base: null, head: s.git("rev-parse", "HEAD"), cwd: s.dir, mode: "enforce", env: {} });
    refused(result, /src\/ui\/Panel\.tsx/);
  } finally { s.done(); }
});

test("evidence counts as the gate takes it: a dirty run, a narrowed one, one with a condition not opened or a new failure, a run whose commit is not there, a dirty or partial shared result do not cover", () => {
  const bad: [string, (s: ReturnType<typeof story>, at: string) => void][] = [
    ["a dirty run", (s, at) => s.write(`${RUNS}/r/geometry.json`, JSON.stringify({ ...runReport(at), dirty: true }))],
    ["a narrowed run", (s, at) => s.write(`${RUNS}/r/geometry.json`, JSON.stringify({ ...runReport(at), axesNarrowed: true }))],
    ["a run with a condition not opened", (s, at) => s.write(`${RUNS}/r/geometry.json`, JSON.stringify({ ...runReport(at), totals: { unopened: 1 } }))],
    ["a run with a new failure", (s, at) => s.write(`${RUNS}/r/geometry.json`, JSON.stringify(runReport(at, ["overflow|div.x"])))],
    ["a run whose commit is not there", (s) => s.write(`${RUNS}/r/geometry.json`, JSON.stringify(runReport("0".repeat(40))))],
  ];
  for (const [what, write] of bad) {
    const s = story();
    try {
      s.git("checkout", "-q", "trunk"); s.git("checkout", "-qb", "p"); s.write("src/ui/Card.tsx", "// changed\n"); const at = s.commit("p: the card");
      write(s, at); s.commit("p: its rows\n\nUI-Geometry-Run: r"); s.git("checkout", "-q", "trunk"); s.git("merge", "-q", "--no-ff", "--no-edit", "p");
      refused(s.check(), /src\/ui\/Card\.tsx — audit again/);
    } finally { s.done(); }
  }
  for (const [what, extra] of [["a dirty full result", { dirty: true }], ["a partial shared result", { full: false }], ["a full result with a condition not opened", { unopened: 2 }]] as const) {
    const s = story({ own: "rows" });
    try {
      s.git("checkout", "-q", "trunk"); s.git("checkout", "-qb", "p"); s.write("src/ui/Card.tsx", "// changed\n"); const at = s.commit("p: the card");
      s.write(SHARED, JSON.stringify({ run: "p-full", full: true, commit: at, dirty: false, failureKeys: [], unopened: 0, unregisteredFramed: 0, rows: 1, ...extra })); s.commit(`p: ${what}`);
      s.git("checkout", "-q", "trunk"); s.git("merge", "-q", "--ff-only", "p");
      refused(s.check(), /src\/ui\/Card\.tsx — audit again/);
    } finally { s.done(); }
  }
});

test("a deleted UI file is not covered by a run whose commit is not there (an absent blob is not a measurement)", () => {
  const s = story();
  try {
    s.git("checkout", "-q", "trunk"); s.git("checkout", "-qb", "p"); s.git("rm", "-q", "src/ui/Other.tsx"); s.commit("p: the other panel goes");
    s.write(`${RUNS}/r/geometry.json`, JSON.stringify(runReport("1".repeat(40)))); s.commit("p: rows\n\nUI-Geometry-Run: r");
    s.git("checkout", "-q", "trunk"); s.git("merge", "-q", "--no-ff", "--no-edit", "p");
    refused(s.check(), /src\/ui\/Other\.tsx/);
  } finally { s.done(); }
});

test("a push whose own run failed and went through the override: covered only as an override, and the output says so", () => {
  const s = story();
  try {
    s.git("checkout", "-q", "trunk"); s.git("checkout", "-qb", "hurried"); s.write("src/ui/Card.tsx", "// changed\n"); const at = s.commit("hurried: the card");
    s.write(`${RUNS}/hurried-rows/geometry.json`, JSON.stringify({ ...runReport(at, ["overflow|div.card"]), run: "hurried-rows" })); s.commit("hurried: its failing rows\n\nUI-Geometry-Run: hurried-rows");
    s.git("checkout", "-q", "trunk"); s.git("merge", "-q", "--no-ff", "-m", `Merge hurried${s.OVERRIDE("hurried")}`, "hurried");
    const result = s.check();
    assert.equal(result.ok, true, result.reasons.join("\n"));
    const text = formatUiGeometryResult(result);
    assert.match(text, /\(override, recorded: hurried pushed through the override, a reason; 1 file\(s\)\)/);
    assert.doesNotMatch(text, /UI-Geometry-Run hurried-rows/, "the failing run is no measurement");
  } finally { s.done(); }
});

test("an override counts only on the commit that carries the change into the trunk: not a later docs push's, not an earlier one's", () => {
  const s = story();
  try {
    s.push("bare", "src/ui/Other.tsx", "none", "ff");                        // no evidence
    s.git("checkout", "-q", "trunk"); s.write("docs/notes.md", "x\n"); s.commit(`docs: a note${s.OVERRIDE("docs")}`);   // a docs push that never needed it
    refused(s.check(), /src\/ui\/Other\.tsx/);
  } finally { s.done(); }
  const t = story();
  try {
    t.git("checkout", "-q", "trunk"); t.write("docs/notes.md", "x\n"); t.commit(`docs: a note${t.OVERRIDE("early")}`);   // an override before the change
    t.push("bare", "src/ui/Other.tsx", "none", "ff");
    refused(t.check(), /src\/ui\/Other\.tsx/);
  } finally { t.done(); }
  const u = story();
  try {
    // A fast-forward push whose override sits on a later commit than the change: not where the change came in — refused.
    u.git("checkout", "-q", "trunk"); u.git("checkout", "-qb", "late"); u.write("src/ui/Card.tsx", "// changed\n"); u.commit("late: the card");
    u.write("docs/notes.md", "y\n"); u.commit(`late: a note${u.OVERRIDE("late")}`); u.git("checkout", "-q", "trunk"); u.git("merge", "-q", "--ff-only", "late");
    refused(u.check(), /src\/ui\/Card\.tsx/);
  } finally { u.done(); }
});

test("only the trunk's last change of a file counts: an old run that measured the same content before an unaudited change and its revert does not cover", () => {
  const s = story();
  try {
    s.push("one", "src/ui/Panel.tsx", "run", "ff");                           // measured: Panel as one left it
    const measured = `${s.git("show", "trunk:src/ui/Panel.tsx")}\n`;   // (the helper trims the output)
    s.git("checkout", "-q", "trunk"); s.write("src/ui/Panel.tsx", "// unaudited\n"); s.commit("two: the panel, no evidence");
    s.write("src/ui/Panel.tsx", measured); s.commit("three: back as one measured it, no evidence");
    refused(s.check(), /src\/ui\/Panel\.tsx/);
  } finally { s.done(); }
});

/** A valid changed-rows report measured at `at` (with failure `keys`). */
function runReport(at: string, keys: string[] = []) {
  return { run: "r", commit: at, axesNarrowed: false, dirty: false, totals: { unopened: 0 }, unregisteredFramed: [],
    rows: { "modal.panel": { conditions: Object.fromEntries(CONDITIONS.map(condition => [condition, { status: "measured", keys }])) } } };
}

test("a measured cover also lists the override its push recorded", () => {
  const s = story();
  try {
    s.git("checkout", "-q", "trunk"); s.git("checkout", "-qb", "both"); s.write("src/ui/Card.tsx", "// changed\n"); const at = s.commit("both: the card");
    s.rowRun("both-rows", at); s.git("checkout", "-q", "trunk"); s.git("merge", "-q", "--no-ff", "-m", `Merge both${s.OVERRIDE("both")}`, "both");
    assert.match(formatUiGeometryResult(s.check()), /\(UI-Geometry-Run both-rows; override, recorded: both pushed through the override, a reason; 1 file\(s\)\)/);
  } finally { s.done(); }
});

test("an old full result is no new evidence: an unaudited revert to what it measured is not covered", () => {
  const s = story({ own: "rows" });
  try {
    // The trunk's full result (full-0) measured Panel as A. A push changes Panel to B with its run; this push branches
    // after it and measures B; then an unaudited trunk commit puts Panel back to A — what full-0 measured, long before.
    const a = `${s.git("show", "trunk:src/ui/Panel.tsx")}\n`;
    s.push("one", "src/ui/Panel.tsx", "run", "ff");
    s.git("checkout", "-q", "trunk"); s.git("checkout", "-qb", "later"); s.write("scripts/tool.mjs", "// later's script\n"); const at = s.commit("later: the script"); s.rowRun("later-rows", at);
    s.git("checkout", "-q", "trunk"); s.write("src/ui/Panel.tsx", a); s.commit("trunk: Panel back to A, no evidence");
    s.git("checkout", "-q", "later"); const base = s.git("rev-parse", "trunk"); s.git("merge", "-q", "--no-edit", "trunk");
    refused(checkUiGeometry({ base, head: s.git("rev-parse", "HEAD"), cwd: s.dir, mode: "enforce", env: {} }), /src\/ui\/Panel\.tsx/);
  } finally { s.done(); }
});
