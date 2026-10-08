import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { checkUiGeometry, formatUiGeometryResult, geometryInputHash, geometryInputs } from "../scripts/checks/uiGeometry.mjs";

// RR26 (user ruling 2026-10-09, step (c)): a changed-rows audit run that a push names (UI-Geometry-Run trailer) counts
// in place of the stale shared result when no UI input changed since it was measured. Each case is made to overlap or to
// break the result on purpose (RR22). The story: the trunk, a branch that changes a panel's component and style, the
// branch's changed-rows run committed with the trailer, then the trunk moves and the branch merges it.
const RUN = "render-TEST-geometry-1";
const ROW = "modal.panel";
const CONDITIONS = ["1280x800/normal/normal", "390x844/normal/normal"];

type Report = { dirty?: boolean; unopened?: number; keys?: string[]; inputHash?: string };

function story({ trunkMove, report = {}, baseline = [], trailer = true }: {
  trunkMove: (write: (path: string, text: string) => void) => void; report?: Report; baseline?: string[]; trailer?: boolean;
}) {
  const dir = mkdtempSync(join(tmpdir(), "fls-rowrun-"));
  const git = (...args: string[]) => execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd: dir, encoding: "utf8" }).trim();
  const write = (path: string, text: string) => { mkdirSync(dirname(join(dir, path)), { recursive: true }); writeFileSync(join(dir, path), text); };
  write("scripts/uiGeometryAudit.mjs", "// the audit\n");
  write("src/ui/Panel.tsx", "export const Panel = () => null;\n");
  write("src/ui/Other.tsx", "export const Other = () => null;\n");
  write("src/styles/panel.css", ".panel { padding: 8px; }\n.spacer {}\n.spacer2 {}\n.panel-title { margin: 0; }\n");
  write("src/styles/global.css", ":root { --gap: 8px; }\n");
  write("src/content/panelCopy.ko.ts", 'export const PANEL = "판";\n');
  write("public/assets/frame.png", "png\n");
  write("src/engine/core.ts", "export const core = 1;\n");
  write("docs/notes.md", "x\n");
  write("docs/verification/uiaudit1/geometry-baseline.json", JSON.stringify({ entries: baseline }));
  write("docs/verification/uiaudit1/geometry-exceptions.json", JSON.stringify({ exceptions: [] }));
  write("docs/verification/uiaudit1/geometry.json", JSON.stringify({ inputHash: "stale", failureKeys: [], unopened: 0 }));   // the shared result, of older inputs
  git("init", "-q", "-b", "trunk"); git("add", "-A"); git("commit", "-qm", "trunk");
  git("checkout", "-qb", "branch");
  write("src/ui/Panel.tsx", "export const Panel = () => 'panel';\n"); write("src/styles/panel.css", ".panel { padding: 12px; }\n.spacer {}\n.spacer2 {}\n.panel-title { margin: 0; }\n");
  git("commit", "-qam", "branch: the panel");
  const measured = git("rev-parse", "HEAD");
  const rows = { [ROW]: { conditions: Object.fromEntries(CONDITIONS.map(condition => [condition, { status: "measured", keys: report.keys ?? [] }])) } };
  write(`docs/verification/uiaudit1/geometry/${RUN}/geometry.json`, JSON.stringify({ run: RUN, commit: measured, dirty: report.dirty ?? false,
    inputHash: report.inputHash ?? geometryInputHash(geometryInputs(measured, dir)), totals: { unopened: report.unopened ?? 0 }, unregisteredFramed: [], rows }));
  git("add", "-A"); git("commit", "-qm", `branch: the changed rows' geometry${trailer ? `\n\nUI-Geometry-Run: ${RUN}` : ""}`);
  git("checkout", "-q", "trunk"); trunkMove(write); git("add", "-A"); git("commit", "-qm", "trunk moves", "--allow-empty");
  const trunk = git("rev-parse", "HEAD");
  git("checkout", "-q", "branch"); git("merge", "-q", "--no-edit", "trunk");
  const check = () => checkUiGeometry({ base: trunk, head: git("rev-parse", "HEAD"), cwd: dir, mode: "enforce", env: {} });
  return { git, write, check, done: () => rmSync(dir, { recursive: true, force: true }) };
}

const engineOnly = (write: (path: string, text: string) => void) => { write("src/engine/core.ts", "export const core = 2;\n"); write("docs/notes.md", "y\n"); };

test("no UI input moved: the trunk changed the engine and a document — the changed rows' run counts, the output says why", () => {
  const s = story({ trunkMove: engineOnly });
  try {
    const result = s.check();
    assert.equal(result.ok, true, result.reasons.join("\n"));
    assert.match(formatUiGeometryResult(result), /changed rows accepted \(decision RR26\)\n  run render-TEST-geometry-1 \(commit [0-9a-f]{8}\): 1 row\(s\), 2 cell\(s\), no new failure; no UI input changed since it was measured \(\d+ file\(s\) changed since, none a UI input\)/);
  } finally { s.done(); }
});

for (const [what, path, text] of [
  ["a CSS rule file the row uses (another rule of it)", "src/styles/panel.css", ".panel { padding: 8px; }\n.spacer {}\n.spacer2 {}\n.panel-title { margin: 4px; }\n"],
  ["a global style", "src/styles/global.css", ":root { --gap: 10px; }\n"],
  ["another component", "src/ui/Other.tsx", "export const Other = () => 'other';\n"],
  ["the copy (*.ko.ts)", "src/content/panelCopy.ko.ts", 'export const PANEL = "판자";\n'],
  ["a picture", "public/assets/frame.png", "png2\n"],
] as const) {
  test(`UI input moved: the trunk changed ${what} — the run does not count, the output names ${path}`, () => {
    const s = story({ trunkMove: write => write(path, text) });
    try {
      const result = s.check();
      assert.equal(result.ok, false);
      assert.ok(result.reasons.some(reason => reason.includes(`1 UI input file(s) changed since it was measured`) && reason.includes(path)), result.reasons.join("\n"));
    } finally { s.done(); }
  });
}

test("the branch's own UI edit after the run: the run does not count", () => {
  const s = story({ trunkMove: engineOnly });
  try {
    s.write("src/ui/Panel.tsx", "export const Panel = () => 'panel!';\n"); s.git("commit", "-qam", "branch: one more panel edit");
    const result = s.check();
    assert.equal(result.ok, false);
    assert.ok(result.reasons.some(reason => reason.includes("src/ui/Panel.tsx")));
  } finally { s.done(); }
});

test("a broken result does not count: measured dirty, a condition not opened, a new failure, a baseline entry fixed", () => {
  for (const [report, baseline, expected] of [
    [{ dirty: true }, [], /measured from a tree with uncommitted changes/],
    [{ unopened: 1 }, [], /1 surface condition\(s\) could not be opened/],
    [{ keys: ["overflow|.panel-body"] }, [], /2 new failure\(s\), in no baseline entry or exception/],   // one per condition
    [{}, [`${ROW}|${CONDITIONS[0]}|overflow|.panel-body`], /1 baseline entr\(ies\) of its rows fixed, drop them/],
  ] as const) {
    const s = story({ trunkMove: engineOnly, report, baseline: [...baseline] });
    try {
      const result = s.check();
      assert.equal(result.ok, false);
      assert.ok(result.reasons.some(reason => expected.test(reason)), result.reasons.join("\n"));
    } finally { s.done(); }
  }
});

test("a failure already in the baseline is no new failure: the run counts", () => {
  const s = story({ trunkMove: engineOnly, report: { keys: ["overflow|.panel-body"] }, baseline: [`${ROW}|${CONDITIONS[0]}|overflow|.panel-body`, `${ROW}|${CONDITIONS[1]}|overflow|.panel-body`] });
  try { assert.equal(s.check().ok, true); } finally { s.done(); }
});

test("without the trailer the stale shared result still fails, as before", () => {
  const s = story({ trunkMove: engineOnly, trailer: false });
  try {
    const result = s.check();
    assert.equal(result.ok, false);
    assert.ok(result.reasons.some(reason => reason.startsWith("the UI inputs changed since the result")));
  } finally { s.done(); }
});

test("a trailer naming a run with no committed report does not count", () => {
  const s = story({ trunkMove: engineOnly });
  try {
    s.git("commit", "-q", "--allow-empty", "-m", "another run\n\nUI-Geometry-Run: render-TEST-missing");
    const result = s.check();
    assert.equal(result.ok, false);
    assert.ok(result.reasons.some(reason => reason.includes("render-TEST-missing") && reason.includes("commit the run's report")));
  } finally { s.done(); }
});
