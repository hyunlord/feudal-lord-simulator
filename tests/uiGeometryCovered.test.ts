import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { gitIn, tempDir } from "./helpers/tempRepo";
import { checkUiGeometry, formatUiGeometryResult } from "../scripts/checks/uiGeometry.mjs";

// RR26 covered (user ruling 2026-10-10, per file content approved the same day): a result stays good at <head> when
// every file changed since it that this push's commits do not change comes as the trunk has it at <base>, and the
// trunk's own pushes audited exactly that content — a valid UI-Geometry-Run report or new full shared result pushed
// with it, which saw every change of the file — or carried it in through a recorded UI-Geometry-Override on their head.
// Each case is made to break the rule on purpose (RR22); the stories of two independent reviews are among them. The
// story (as on 2026-10-10): a push audits its own change on its branch while the trunk takes other pushes; it then
// merges the trunk and the gate runs on trunk..head.
const SHARED = "docs/verification/uiaudit1/geometry.json";
const RUNS = "docs/verification/uiaudit1/geometry";
const CONDITIONS = ["1280x800/normal/normal", "390x844/normal/normal"];
/** git's message for a merge of the trunk into a branch (`git merge origin/<trunk>`), as every session's push has it. */
const TRUNK_MERGE = (branch: string) => `Merge remote-tracking branch 'origin/codex/phase15-organic-ground' into ${branch}`;
const OVERRIDE = (name: string) => `\n\nUI-Geometry-Override: ${name} pushed through the override, a reason`;

/** A changed-rows report measured at `at` (failure `keys` in each condition; `extra` overrides fields). */
function rowsReport(run: string, at: string, keys: string[] = [], extra: object = {}) {
  return { run, commit: at, axesNarrowed: false, dirty: false, totals: { unopened: 0 }, unregisteredFramed: [],
    rows: { "modal.panel": { conditions: Object.fromEntries(CONDITIONS.map(condition => [condition, { status: "measured", keys }])) } }, ...extra };
}

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
  /** A full shared result measured at `at`, with its report (as the audit writes both). */
  const full = (run: string, at: string, extra: object = {}) => {
    write(`${RUNS}/${run}/geometry.json`, JSON.stringify({ ...rowsReport(run, at), full: true }));
    write(SHARED, JSON.stringify({ run, full: true, commit: at, dirty: false, failureKeys: [], unopened: 0, unregisteredFramed: 0, rows: 1, report: `${RUNS}/${run}/geometry.json`, ...extra }));
  };
  full("full-0", c0); commit("the trunk's shared result");
  /** A changed-rows run's report measured at `at`, committed with its trailer; the commit. */
  const rowRun = (run: string, at: string, keys: string[] = [], extra: object = {}) => {
    write(`${RUNS}/${run}/geometry.json`, JSON.stringify(rowsReport(run, at, keys, extra)));
    return commit(`its rows' geometry\n\nUI-Geometry-Run: ${run}`);
  };
  // The pushing branch: its own change (a script) and its own audit of it, measured before the trunk moves.
  git("checkout", "-qb", "pushing"); write("scripts/tool.mjs", "// the push's script\n"); const at = commit("pushing: the script");
  if (own === "full") { full("full-branch", at); commit("pushing: its full audit"); } else rowRun("pushing-rows", at);
  /**
   * A trunk push of a side branch that changes `path`, with `evidence`: "merge" merges it on the trunk (--no-ff);
   * "ff" fast-forwards it; an override goes where the gate reads it, on the pushed head — the commit itself (ff), or the
   * merge of the trunk into the branch (the sessions' way: the trunk moves first, the branch merges it, fast-forward).
   * Returns { head, evidence } — the commit carrying the run, the full result or the override.
   */
  const push = (name: string, path: string, evidence: "run" | "override" | "none" | "full", how: "merge" | "ff" = "merge") => {
    git("checkout", "-q", "trunk"); git("checkout", "-qb", name);
    write(path, `// ${path} changed by ${name}\n`); let carrier = commit(`${name}: ${path}${evidence === "override" && how === "ff" ? OVERRIDE(name) : ""}`);
    if (evidence === "run") carrier = rowRun(`${name}-rows`, carrier);
    if (evidence === "full") { full(`${name}-full`, carrier); carrier = commit(`${name}: a new full audit`); }
    if (evidence === "override" && how === "merge") {
      git("checkout", "-q", "trunk"); write(`docs/${name}-trunk.md`, "the trunk moves\n"); commit("the trunk moves");
      git("checkout", "-q", name); git("merge", "-q", "--no-ff", "-m", `${TRUNK_MERGE(name)}${OVERRIDE(name)}`, "trunk"); carrier = head();
      git("checkout", "-q", "trunk"); git("merge", "-q", "--ff-only", name);
    } else {
      git("checkout", "-q", "trunk");
      if (how === "ff") git("merge", "-q", "--ff-only", name); else git("merge", "-q", "--no-ff", "--no-edit", name);
    }
    return { head: head(), evidence: carrier };
  };
  /** A branch `name` merges the trunk (its result stays ours); the gate on trunk..head (from `cwd`). */
  const checkOn = (name: string, cwd = "") => {
    git("checkout", "-q", name); const base = git("rev-parse", "trunk");
    try { git("merge", "-q", "--no-edit", "-X", "ours", "trunk"); } catch { /* a conflict-free story */ }
    return checkUiGeometry({ base, head: head(), cwd: join(dir, cwd), mode: "enforce", env: {} });
  };
  const check = (cwd = "") => checkOn("pushing", cwd);
  return { dir, git, write, commit, rowRun, full, push, check, checkOn, c0, done: () => rmSync(dir, { recursive: true, force: true }) };
}

const refused = (result: ReturnType<typeof checkUiGeometry>, pattern: RegExp) => assert.ok(!result.ok && result.reasons.some(reason => pattern.test(reason)), result.reasons.join("\n"));
const short = (commit: string) => commit.slice(0, 8);

test("a UI commit pushed to the trunk with its trailer after the result is covered: the push passes, and the output names the cover", () => {
  for (const how of ["merge", "ff"] as const) {
    const s = story();
    try {
      const pushed = s.push("render", "src/ui/Panel.tsx", "run", how);
      const result = s.check();
      assert.equal(result.ok, true, `${how}: ${result.reasons.join("\n")}`);
      assert.match(formatUiGeometryResult(result), new RegExp(`the shared result \\(run full-branch\\): changes since covered by trunk pushes — ${short(pushed.evidence)} \\(UI-Geometry-Run render-rows; 1 file\\(s\\)\\)`));
    } finally { s.done(); }
  }
});

test("a branch commit not on the trunk, merged without a trailer after the audit, is refused — only the trunk's own pushes are covered", () => {
  const s = story();
  try {
    s.push("render", "src/ui/Panel.tsx", "run");
    s.git("checkout", "-q", "trunk"); s.git("checkout", "-qb", "side"); s.write("src/ui/Card.tsx", "// changed off the trunk\n"); s.commit("side: the card");
    s.git("checkout", "-q", "pushing"); s.git("merge", "-q", "--no-ff", "--no-edit", "side");
    refused(s.check(), /the shared result \(run full-branch\): 1 file\(s\) off the safe list changed since it was measured at [0-9a-f]{8} .*: src\/ui\/Card\.tsx — audit again/);
  } finally { s.done(); }
});

test("a trunk commit pushed through the override is covered, and the output records its reason — the commit itself, or a merge of the trunk pushed fast-forward", () => {
  for (const how of ["merge", "ff"] as const) {
    const s = story();
    try {
      const pushed = s.push("hurried", "src/ui/Card.tsx", "override", how);
      const result = s.check();
      assert.equal(result.ok, true, `${how}: ${result.reasons.join("\n")}`);
      assert.match(formatUiGeometryResult(result), new RegExp(`${short(pushed.evidence)} \\(override, recorded: hurried pushed through the override, a reason; 1 file\\(s\\)\\)`));
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
    s.full("full-branch2", at); s.commit("pushing: its full audit again");
    s.git("checkout", "-q", "trunk"); s.git("checkout", "-qb", "render"); s.write("src/ui/Panel.tsx", lines("// 1", "// the trunk's last line")); const changed = s.commit("render: the panel");
    s.rowRun("render-rows", changed); s.git("checkout", "-q", "trunk"); s.git("merge", "-q", "--no-ff", "--no-edit", "render");
    refused(s.check(), /src\/ui\/Panel\.tsx — audit again/);
  } finally { s.done(); }
});

test("a run measured before a trunk commit does not cover it, though its trailer comes later in the same push — or in the same commit, from any working folder", () => {
  const s = story();
  try {
    s.git("checkout", "-q", "trunk"); s.git("checkout", "-qb", "late");
    s.write("src/ui/Panel.tsx", "// measured\n"); const measured = s.commit("late: the panel");
    s.write("src/ui/Card.tsx", "// after the run measured\n"); s.commit("late: the card, after the run");
    s.rowRun("late-rows", measured);
    s.git("checkout", "-q", "trunk"); s.git("merge", "-q", "--ff-only", "late");
    refused(s.check(), /1 file\(s\) off the safe list changed since it was measured at [0-9a-f]{8} .*: src\/ui\/Card\.tsx/);
  } finally { s.done(); }
  // Review 2, R4: one commit changes Panel and carries a run of the tree before it — refused, from the top or a subfolder.
  for (const cwd of ["", "src"]) {
    const t = story();
    try {
      t.git("checkout", "-q", "trunk"); const before = t.git("rev-parse", "HEAD");
      t.write("src/ui/Panel.tsx", "// new panel\n"); t.write(`${RUNS}/old-rows/geometry.json`, JSON.stringify(rowsReport("old-rows", before))); t.commit("trunk: panel + a run of the older tree\n\nUI-Geometry-Run: old-rows");
      refused(t.check(cwd), /src\/ui\/Panel\.tsx/);
    } finally { t.done(); }
  }
});

test("an override covers only what its pushed head brought: not a change already on the trunk, not one before it, not one of a later docs push", () => {
  const s = story();
  try {
    s.push("bare", "src/ui/Other.tsx", "none", "ff");                        // no evidence
    s.git("checkout", "-q", "trunk"); s.write("docs/notes.md", "x\n"); s.commit(`docs: a note${OVERRIDE("docs")}`);   // a docs push that never needed it
    refused(s.check(), /src\/ui\/Other\.tsx/);
  } finally { s.done(); }
  const t = story();
  try {
    t.git("checkout", "-q", "trunk"); t.write("docs/notes.md", "x\n"); t.commit(`docs: a note${OVERRIDE("early")}`);   // an override before the change
    t.push("bare", "src/ui/Other.tsx", "none", "ff");
    refused(t.check(), /src\/ui\/Other\.tsx/);
  } finally { t.done(); }
  const u = story();
  try {
    // A fast-forward push whose override sits on a later commit than the change, no merge: refused (not where it came in).
    u.git("checkout", "-q", "trunk"); u.git("checkout", "-qb", "late"); u.write("src/ui/Card.tsx", "// changed\n"); u.commit("late: the card");
    u.write("docs/notes.md", "y\n"); u.commit(`late: a note${OVERRIDE("late")}`); u.git("checkout", "-q", "trunk"); u.git("merge", "-q", "--ff-only", "late");
    refused(u.check(), /src\/ui\/Card\.tsx/);
  } finally { u.done(); }
  const v = story();
  try {
    // Review 2, R10: an unaudited trunk commit, then another push merges the trunk into its docs branch with an override
    // of its own: the trunk side was not what that push brought — refused.
    v.git("checkout", "-q", "trunk"); const fork = v.git("rev-parse", "HEAD");
    v.write("src/ui/Other.tsx", "// bypassed, no evidence\n"); v.commit("t: other, no evidence");
    v.git("checkout", "-qb", "b", fork); v.write("docs/b.md", "b\n"); v.commit("b: docs");
    v.git("merge", "-q", "--no-ff", "-m", `${TRUNK_MERGE("b")}${OVERRIDE("b")}`, "trunk");
    v.git("checkout", "-q", "trunk"); v.git("merge", "-q", "--ff-only", "b");
    refused(v.check(), /src\/ui\/Other\.tsx/);
  } finally { v.done(); }
});

test("a new full shared result pushed on the trunk with its report covers what it measured (for this push's changed-rows run)", () => {
  const s = story({ own: "rows" });
  try {
    const pushed = s.push("nightly", "src/ui/Card.tsx", "full", "ff");
    const result = s.check();
    assert.equal(result.ok, true, result.reasons.join("\n"));
    assert.match(formatUiGeometryResult(result), new RegExp(`run pushing-rows: changes since covered by trunk pushes — ${short(pushed.evidence)} \\(full audit nightly-full; 1 file\\(s\\)\\)`));
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

test("without a base nothing is covered; a result on an unrelated root does not crash the gate (review 2, R7)", () => {
  const s = story();
  try {
    s.push("render", "src/ui/Panel.tsx", "run");
    s.check();
    refused(checkUiGeometry({ base: null, head: s.git("rev-parse", "HEAD"), cwd: s.dir, mode: "enforce", env: {} }), /src\/ui\/Panel\.tsx/);
  } finally { s.done(); }
  const t = story();
  try {
    // Review 2, R7: a full result measured on an unrelated root.
    t.git("checkout", "-q", "--orphan", "alien"); t.git("rm", "-rqf", ".");
    for (const path of ["scripts/uiGeometryAudit.mjs", "src/ui/Panel.tsx", "src/ui/Card.tsx"]) t.write(path, `// alien ${path}\n`);
    t.write("docs/verification/uiaudit1/geometry-baseline.json", '{"entries":[]}'); t.write("docs/verification/uiaudit1/geometry-exceptions.json", '{"exceptions":[]}');
    const alien = t.commit("alien root"); t.full("alien-full", alien); t.commit("alien full");
    t.git("checkout", "-q", "trunk"); t.git("checkout", "-qb", "p2"); t.git("merge", "-q", "--allow-unrelated-histories", "-X", "theirs", "--no-edit", "alien");
    t.write("src/ui/Panel.tsx", "// src/ui/Panel.tsx\n"); t.write("src/ui/Card.tsx", "// src/ui/Card.tsx\n"); t.commit("p2: trunk content kept");
    // No crash; what differs from the alien result comes as the trunk has it, and only the trunk's own full audit (full-0,
    // which measured exactly that content) may cover it.
    const result = checkUiGeometry({ base: t.git("rev-parse", "trunk"), head: t.git("rev-parse", "HEAD"), cwd: t.dir, mode: "enforce", env: {} });
    assert.ok(result.ok || result.reasons.length > 0);
    for (const cover of result.sharedCovered ?? []) assert.match(cover.what, /^full audit full-0/);
  } finally { t.done(); }
});

test("evidence counts as the gate takes it: an invalid run or full result covers nothing", () => {
  const bad: [string, (at: string) => object][] = [
    ["a dirty run", at => rowsReport("r", at, [], { dirty: true })],
    ["a narrowed run", at => rowsReport("r", at, [], { axesNarrowed: true })],
    ["a run counting a condition not opened", at => rowsReport("r", at, [], { totals: { unopened: 1 } })],
    ["a run with a condition not opened, though it counts none", at => ({ ...rowsReport("r", at), rows: { "modal.panel": { conditions: { [CONDITIONS[0]!]: { status: "measured", keys: [] }, [CONDITIONS[1]!]: { status: "error" } } } } })],
    ["a run with a framed root outside the registry", at => rowsReport("r", at, [], { unregisteredFramed: [{ root: ".stray" }] })],
    ["a run with a new failure", at => rowsReport("r", at, ["overflow|div.x"])],
    ["a run that measured no row", at => ({ ...rowsReport("r", at), rows: {} })],
    ["a run whose report names another run", at => rowsReport("other", at)],
    ["a run whose commit is not there", () => rowsReport("r", "0".repeat(40))],
  ];
  for (const [what, report] of bad) {
    const s = story();
    try {
      s.git("checkout", "-q", "trunk"); s.git("checkout", "-qb", "p"); s.write("src/ui/Card.tsx", "// changed\n"); const at = s.commit("p: the card");
      s.write(`${RUNS}/r/geometry.json`, JSON.stringify(report(at))); s.commit("p: its rows\n\nUI-Geometry-Run: r"); s.git("checkout", "-q", "trunk"); s.git("merge", "-q", "--no-ff", "--no-edit", "p");
      const result = s.check();
      assert.ok(!result.ok && result.reasons.some(reason => /src\/ui\/Card\.tsx — audit again/.test(reason)), `${what}: ${result.reasons.join("\n")}`);
    } finally { s.done(); }
  }
  for (const [what, extra] of [["a dirty full result", { dirty: true }], ["a partial shared result", { full: false }], ["a full result with a condition not opened", { unopened: 2 }],
    ["a full result with a failure outside the baseline", { failureKeys: ["modal.panel|1280x800/normal/normal|overflow|div.x"] }]] as const) {
    const s = story({ own: "rows" });
    try {
      s.git("checkout", "-q", "trunk"); s.git("checkout", "-qb", "p"); s.write("src/ui/Card.tsx", "// changed\n"); const at = s.commit("p: the card");
      s.full("p-full", at, extra); s.commit(`p: ${what}`); s.git("checkout", "-q", "trunk"); s.git("merge", "-q", "--ff-only", "p");
      const result = s.check();
      assert.ok(!result.ok && result.reasons.some(reason => /src\/ui\/Card\.tsx — audit again/.test(reason)), `${what}: ${result.reasons.join("\n")}`);
    } finally { s.done(); }
  }
});

test("a deleted UI file is not covered by a run whose commit is not there (an absent blob is not a measurement)", () => {
  const s = story();
  try {
    s.git("checkout", "-q", "trunk"); s.git("checkout", "-qb", "p"); s.git("rm", "-q", "src/ui/Other.tsx"); s.commit("p: the other panel goes");
    s.write(`${RUNS}/r/geometry.json`, JSON.stringify(rowsReport("r", "1".repeat(40)))); s.commit("p: rows\n\nUI-Geometry-Run: r");
    s.git("checkout", "-q", "trunk"); s.git("merge", "-q", "--no-ff", "--no-edit", "p");
    refused(s.check(), /src\/ui\/Other\.tsx/);
  } finally { s.done(); }
});

test("a push whose own run failed and went through the override: covered only as an override, and the output says so", () => {
  const s = story();
  try {
    s.git("checkout", "-q", "trunk"); s.git("checkout", "-qb", "hurried"); s.write("src/ui/Card.tsx", "// changed\n"); const at = s.commit("hurried: the card");
    s.rowRun("hurried-rows", at, ["overflow|div.card"]);
    s.git("checkout", "-q", "trunk"); s.write("docs/moves.md", "x\n"); s.commit("the trunk moves");
    s.git("checkout", "-q", "hurried"); s.git("merge", "-q", "--no-ff", "-m", `${TRUNK_MERGE("hurried")}${OVERRIDE("hurried")}`, "trunk");
    s.git("checkout", "-q", "trunk"); s.git("merge", "-q", "--ff-only", "hurried");
    const result = s.check();
    assert.equal(result.ok, true, result.reasons.join("\n"));
    const text = formatUiGeometryResult(result);
    assert.match(text, /\(override, recorded: hurried pushed through the override, a reason; 1 file\(s\)\)/);
    assert.doesNotMatch(text, /UI-Geometry-Run hurried-rows/, "the failing run is no measurement");
  } finally { s.done(); }
});

test("a measured cover also lists the override in the message of the commit carrying it", () => {
  const s = story();
  try {
    s.git("checkout", "-q", "trunk"); s.git("checkout", "-qb", "both"); s.write("src/ui/Card.tsx", "// changed\n"); const at = s.commit("both: the card");
    s.write(`${RUNS}/both-rows/geometry.json`, JSON.stringify(rowsReport("both-rows", at)));
    s.commit("its rows' geometry\n\nUI-Geometry-Run: both-rows\nUI-Geometry-Override: both pushed through the override, a reason");
    s.git("checkout", "-q", "trunk"); s.git("merge", "-q", "--ff-only", "both");
    assert.match(formatUiGeometryResult(s.check()), /\(UI-Geometry-Run both-rows; override, recorded: both pushed through the override, a reason; 1 file\(s\)\)/);
  } finally { s.done(); }
});

test("a measurement must have seen every change of the file: an unaudited change and revert after an old run — linear, or lumped by a merged branch — is not covered", () => {
  const s = story();
  try {
    s.push("one", "src/ui/Panel.tsx", "run", "ff");
    const measured = `${s.git("show", "trunk:src/ui/Panel.tsx")}\n`;   // (the helper trims the output)
    s.git("checkout", "-q", "trunk"); s.write("src/ui/Panel.tsx", "// unaudited\n"); s.commit("two: the panel, no evidence");
    s.write("src/ui/Panel.tsx", measured); s.commit("three: back as one measured it, no evidence");
    refused(s.check(), /src\/ui\/Panel\.tsx/);
  } finally { s.done(); }
  const t = story();
  try {
    // Review 2, R6: the same, the trunk's commits then lumped behind a branch that merges the trunk and is pushed fast-forward.
    t.git("checkout", "-q", "trunk"); const fork = t.git("rev-parse", "HEAD");
    t.push("one", "src/ui/Panel.tsx", "run", "ff"); const measured = `${t.git("show", "trunk:src/ui/Panel.tsx")}\n`;
    t.git("checkout", "-q", "trunk"); t.write("src/ui/Panel.tsx", "// unaudited\n"); t.commit("two"); t.write("src/ui/Panel.tsx", measured); t.commit("three: back");
    t.git("checkout", "-qb", "w", fork); t.write("docs/w.md", "w\n"); t.commit("w"); t.git("merge", "-q", "--no-edit", "trunk");
    t.git("checkout", "-q", "trunk"); t.git("merge", "-q", "--ff-only", "w");
    refused(t.check(), /src\/ui\/Panel\.tsx/);
  } finally { t.done(); }
});

test("old evidence brought back is no new evidence: a docs push naming an old run, restoring an old full result, or covering a deletion with a run from before the file", () => {
  const s = story();
  try {
    // Review 2, R1.
    s.push("one", "src/ui/Panel.tsx", "run", "ff"); const measured = `${s.git("show", "trunk:src/ui/Panel.tsx")}\n`;
    s.git("checkout", "-q", "trunk"); s.write("src/ui/Panel.tsx", "// unaudited\n"); s.commit("two: no evidence"); s.write("src/ui/Panel.tsx", measured); s.commit("three: revert, no evidence");
    s.write("docs/n.md", "x\n"); s.commit("docs: a note\n\nUI-Geometry-Run: one-rows");
    refused(s.check(), /src\/ui\/Panel\.tsx/);
  } finally { s.done(); }
  const t = story({ own: "rows" });
  try {
    // Review 2, R2: after an unaudited revert of Panel to what full-0 measured, a docs push restores full-0.
    const a = `${t.git("show", "trunk:src/ui/Panel.tsx")}\n`;
    t.push("one", "src/ui/Panel.tsx", "full", "ff");
    t.git("checkout", "-q", "trunk"); t.git("checkout", "-qb", "later"); t.write("scripts/tool.mjs", "// later\n"); const at = t.commit("later"); t.rowRun("later-rows", at);
    t.git("checkout", "-q", "trunk"); t.write("src/ui/Panel.tsx", a); t.commit("trunk: Panel back to A, no evidence");
    t.write(SHARED, JSON.stringify({ run: "full-0", full: true, commit: t.c0, dirty: false, failureKeys: [], unopened: 0, unregisteredFramed: 0, rows: 1, report: `${RUNS}/full-0/geometry.json` }));
    t.commit("docs: restore the older shared result");
    refused(t.checkOn("later"), /src\/ui\/Panel\.tsx/);
  } finally { t.done(); }
  const u = story();
  try {
    // Review 2, R3: a deletion, then a docs push naming a run measured before the file existed.
    u.git("checkout", "-q", "trunk"); u.write(`${RUNS}/ancient-rows/geometry.json`, JSON.stringify(rowsReport("ancient-rows", u.c0))); u.commit("ancient run of c0\n\nUI-Geometry-Run: ancient-rows");
    u.git("checkout", "-qb", "add"); u.write("src/ui/New.tsx", "// new\n"); const added = u.commit("add new"); u.rowRun("add-rows", added);
    u.git("checkout", "-q", "trunk"); u.git("merge", "-q", "--ff-only", "add");
    u.git("checkout", "-q", "pushing"); u.git("merge", "-q", "--no-edit", "trunk"); const at = u.git("rev-parse", "HEAD"); u.full("full-branch2", at); u.commit("pushing: full again");
    u.git("checkout", "-q", "trunk"); u.git("rm", "-q", "src/ui/New.tsx"); u.commit("trunk: delete New, no evidence");
    u.write("docs/n.md", "x\n"); u.commit("docs\n\nUI-Geometry-Run: ancient-rows");
    refused(u.check(), /src\/ui\/New\.tsx/);
  } finally { u.done(); }
});

test("an old full result is no new evidence: an unaudited revert to what it measured is not covered", () => {
  const s = story({ own: "rows" });
  try {
    const a = `${s.git("show", "trunk:src/ui/Panel.tsx")}\n`;
    s.push("one", "src/ui/Panel.tsx", "run", "ff");
    s.git("checkout", "-q", "trunk"); s.git("checkout", "-qb", "later"); s.write("scripts/tool.mjs", "// later's script\n"); const at = s.commit("later: the script"); s.rowRun("later-rows", at);
    s.git("checkout", "-q", "trunk"); s.write("src/ui/Panel.tsx", a); s.commit("trunk: Panel back to A, no evidence");
    refused(s.checkOn("later"), /src\/ui\/Panel\.tsx/);
  } finally { s.done(); }
});
