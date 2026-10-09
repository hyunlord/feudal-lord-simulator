import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { checkUiGeometry, defaultSummaryPath, formatUiGeometryResult, geometryInputHash, geometryInputs, uiInputsDirty } from "../scripts/checks/uiGeometry.mjs";

// RR26 (user ruling 2026-10-09, step (c)): a changed-rows audit run that a push names (UI-Geometry-Run trailer) counts
// in place of the stale shared result when no UI input changed since it was measured. Each case is made to overlap or to
// break the result on purpose (RR22). The story: the trunk, a branch that changes a panel's component and style, the
// branch's changed-rows run committed with the trailer, then the trunk moves and the branch merges it.
const RUN = "render-TEST-geometry-1";
const ROW = "modal.panel";
const CONDITIONS = ["1280x800/normal/normal", "390x844/normal/normal"];

type Report = { dirty?: boolean; unopened?: number; keys?: readonly string[]; inputHash?: string; runName?: string; commit?: string | null; unregistered?: number;
  noRows?: boolean; axesNarrowed?: boolean | null; rowsNull?: boolean; commitOf?: "trunk0" };

function story({ trunkMove, report = {}, baseline = [], trailer = true, sharedFailure = null, sharedPartial = false }: {
  trunkMove: (write: (path: string, text: string) => void) => void; report?: Report; baseline?: string[]; trailer?: boolean;
  sharedFailure?: string | null;   // a current shared result (of the head's inputs) with this failure key
  sharedPartial?: boolean;         // a shared result of the head's inputs written by a changed-rows run (not a full audit)
}) {
  const dir = mkdtempSync(join(tmpdir(), "fls-rowrun-"));
  const git = (...args: string[]) => execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd: dir, encoding: "utf8" }).trim();
  const write = (path: string, text: string) => { mkdirSync(dirname(join(dir, path)), { recursive: true }); writeFileSync(join(dir, path), text); };
  write("scripts/uiGeometryAudit.mjs", "// the audit\n");
  // The UI's import graph (RR26 (가)): main.tsx → App.tsx → components → a helper → the data at the chain's end.
  write("src/main.tsx", 'import { App } from "./App.tsx";\nexport const main = App;\n');
  write("src/App.tsx", 'import { Panel } from "./ui/Panel.tsx";\nimport { Ledger } from "./ui/Ledger.tsx";\nimport { Build } from "./ui/Build.tsx";\nimport { used } from "./engine/used.ts";\nexport const App = [Panel, Ledger, Build, used];\n');
  write("src/ui/Ledger.tsx", 'import { LEDGER_COPY } from "../ledger/ledgerCopy.ko.ts";\nexport const Ledger = LEDGER_COPY;\n');
  write("src/ledger/ledgerCopy.ko.ts", 'export const LEDGER_COPY = "장부";\n');
  write("src/ui/Build.tsx", 'import { BUILDINGS } from "../content/buildingConfig.ts";\nexport const Build = BUILDINGS;\n');
  write("src/content/buildingConfig.ts", 'export const BUILDINGS = { mill: { name: "방앗간" } };\n');
  write("src/ui/helpers/format.ts", 'import table from "../../data/deep/table.json";\nexport const fmt = table.unit;\n');
  write("src/data/deep/table.json", '{"unit":"단"}\n');
  write("src/engine/used.ts", "export const used = 1;\n");
  write("src/ui/Panel.tsx", 'import { fmt } from "./helpers/format.ts";\nexport const Panel = () => fmt;\n');
  write("src/ui/Other.tsx", "export const Other = () => null;\n");
  write("src/styles/panel.css", ".panel { padding: 8px; }\n.spacer {}\n.spacer2 {}\n.panel-title { margin: 0; }\n");
  write("src/styles/global.css", ":root { --gap: 8px; }\n");
  write("src/content/panelCopy.ko.ts", 'export const PANEL = "판";\n');
  write("public/assets/frame.png", "png\n");
  write("src/engine/core.ts", "export const core = 1;\n");
  write("docs/notes.md", "x\n");
  write("docs/verification/uiaudit1/geometry-baseline.json", JSON.stringify({ entries: baseline }));
  write("docs/verification/uiaudit1/geometry-exceptions.json", JSON.stringify({ exceptions: [] }));
  write("docs/verification/uiaudit1/geometry.json", JSON.stringify({ run: "full-old", full: true, inputHash: "stale", failureKeys: [], unopened: 0 }));   // the shared result: a full audit of older inputs
  git("init", "-q", "-b", "trunk"); git("add", "-A"); git("commit", "-qm", "trunk");
  const trunk0 = git("rev-parse", "HEAD");
  git("checkout", "-qb", "branch");
  write("src/ui/Panel.tsx", 'import { fmt } from "./helpers/format.ts";\nexport const Panel = () => fmt + "panel";\n'); write("src/styles/panel.css", ".panel { padding: 12px; }\n.spacer {}\n.spacer2 {}\n.panel-title { margin: 0; }\n");
  git("commit", "-qam", "branch: the panel");
  const measured = git("rev-parse", "HEAD");
  const rows = report.rowsNull ? { [ROW]: null } : report.noRows ? {} : { [ROW]: { conditions: Object.fromEntries(CONDITIONS.map(condition => [condition, { status: "measured", keys: report.keys ?? [] }])) } };
  write(`docs/verification/uiaudit1/geometry/${RUN}/geometry.json`, JSON.stringify({ run: report.runName ?? RUN,
    commit: report.commitOf === "trunk0" ? trunk0 : report.commit === undefined ? measured : report.commit ?? undefined,
    axesNarrowed: report.axesNarrowed === null ? undefined : report.axesNarrowed ?? false, dirty: report.dirty ?? false, inputHash: report.inputHash ?? geometryInputHash(geometryInputs(measured, dir)), totals: { unopened: report.unopened ?? 0 },
    unregisteredFramed: Array.from({ length: report.unregistered ?? 0 }, (_, i) => ({ root: `.stray-${i}`, seenIn: [ROW] })), rows }));
  if (sharedFailure !== null) write("docs/verification/uiaudit1/geometry.json", JSON.stringify({ run: "full-now", full: true, inputHash: geometryInputHash(geometryInputs(measured, dir)), failureKeys: [sharedFailure], unopened: 0 }));
  if (sharedPartial) write("docs/verification/uiaudit1/geometry.json", JSON.stringify({ run: "rows-only", full: false, rows: 1, inputHash: geometryInputHash(geometryInputs(measured, dir)), failureKeys: [], unopened: 0 }));
  git("add", "-A"); git("commit", "-qm", `branch: the changed rows' geometry${trailer ? `\n\nUI-Geometry-Run: ${RUN}` : ""}`);
  git("checkout", "-q", "trunk"); trunkMove(write); git("add", "-A"); git("commit", "-qm", "trunk moves", "--allow-empty");
  const trunk = git("rev-parse", "HEAD");
  git("checkout", "-q", "branch"); git("merge", "-q", "--no-edit", "trunk");
  const check = () => checkUiGeometry({ base: trunk, head: git("rev-parse", "HEAD"), cwd: dir, mode: "enforce", env: {} });
  const run = (name: string) => {   // a new changed-rows run of the same row on the branch's current content, with its trailer
    const commit = git("rev-parse", "HEAD");
    write(`docs/verification/uiaudit1/geometry/${name}/geometry.json`, JSON.stringify({ run: name, commit, axesNarrowed: false, dirty: false,
      inputHash: geometryInputHash(geometryInputs(commit, dir)), totals: { unopened: 0 }, unregisteredFramed: [], rows }));
    git("add", "-A"); git("commit", "-qm", `a new changed-rows run\n\nUI-Geometry-Run: ${name}`);
  };
  return { git, write, check, run, done: () => rmSync(dir, { recursive: true, force: true }) };
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

// Cases from the independent review (RR22).
test("a current shared result with its own new failure is not set aside by a trailer (it is not stale)", () => {
  const s = story({ trunkMove: engineOnly, sharedFailure: "other.row|1280x800/normal/normal|overflow|.x" });
  try {
    const result = s.check();
    assert.equal(result.ok, false);
    assert.ok(result.reasons.some(reason => /1 new failure\(s\), in no baseline entry or exception/.test(reason)), result.reasons.join("\n"));
  } finally { s.done(); }
});

test("a run that is not what the trailer names, or has no measured commit, does not count", () => {
  for (const [report, expected] of [
    [{ runName: "render-SOMETHING-ELSE" }, /its report names another run \(render-SOMETHING-ELSE\)/],
    [{ commit: null }, /its report has no measured commit/],
  ] as const) {
    const s = story({ trunkMove: engineOnly, report });
    try {
      const result = s.check();
      assert.equal(result.ok, false);
      assert.ok(result.reasons.some(reason => expected.test(reason)), result.reasons.join("\n"));
    } finally { s.done(); }
  }
});

test("a run with a framed root outside the registry, or with no row measured, does not count", () => {
  for (const [report, expected] of [
    [{ unregistered: 1 }, /1 framed root\(s\) on screen that no registry row measures/],
    [{ noRows: true }, /no row was measured/],
  ] as const) {
    const s = story({ trunkMove: engineOnly, report });
    try {
      const result = s.check();
      assert.equal(result.ok, false);
      assert.ok(result.reasons.some(reason => expected.test(reason)), result.reasons.join("\n"));
    } finally { s.done(); }
  }
});

test("another row's baseline entries are not this run's to fix: the run counts", () => {
  const s = story({ trunkMove: engineOnly, baseline: ["other.row|1280x800/normal/normal|overflow|.x"] });
  try { assert.equal(s.check().ok, true); } finally { s.done(); }
});

test("the measured tree is dirty when a UI input is not its committed blob: an edit, a new file, a picture; an LFS picture compares by content", () => {
  const dir = mkdtempSync(join(tmpdir(), "fls-dirty-"));
  const git = (...args: string[]) => execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd: dir, encoding: "utf8" }).trim();
  const write = (path: string, text: string | Buffer) => { mkdirSync(dirname(join(dir, path)), { recursive: true }); writeFileSync(join(dir, path), text); };
  try {
    const picture = Buffer.from("real picture bytes");
    const oid = createHash("sha256").update(picture).digest("hex");
    write("src/ui/Panel.tsx", "export const Panel = 1;\n"); write("public/assets/plain.png", "plain\n");
    write("public/assets/lfs.png", `version https://git-lfs.github.com/spec/v1\noid sha256:${oid}\nsize ${picture.length}\n`);   // committed as a pointer
    write("src/engine/core.ts", "export const core = 1;\n");
    git("init", "-q"); git("add", "-A"); git("commit", "-qm", "c");
    write("public/assets/lfs.png", picture);   // the run folder holds the real content (no git-lfs there)
    assert.deepEqual(uiInputsDirty(dir), [], "an LFS picture whose content matches its pointer is clean");
    write("src/engine/core.ts", "export const core = 2;\n");
    assert.deepEqual(uiInputsDirty(dir), [], "the engine is not a UI input");
    write("public/assets/lfs.png", Buffer.from("another picture"));
    assert.deepEqual(uiInputsDirty(dir), ["public/assets/lfs.png"]);
    write("public/assets/lfs.png", picture); write("public/assets/plain.png", "changed\n");
    assert.deepEqual(uiInputsDirty(dir), ["public/assets/plain.png"]);
    write("public/assets/plain.png", "plain\n"); write("src/ui/New.tsx", "export const New = 1;\n");
    assert.deepEqual(uiInputsDirty(dir), ["src/ui/New.tsx"], "an untracked UI file");
    rmSync(join(dir, "src/ui/New.tsx")); write("src/ui/Panel.tsx", "export const Panel = 2;\n");
    assert.deepEqual(uiInputsDirty(dir), ["src/ui/Panel.tsx"]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// Cases from the second independent review (RR22).
test("a run narrowed by --viewports, --copy or --numbers, or one that does not say, does not count", () => {
  for (const [report, expected] of [
    [{ axesNarrowed: true }, /narrowed by --viewports, --copy or --numbers/],
    [{ axesNarrowed: null }, /does not say it measured every condition/],
  ] as const) {
    const s = story({ trunkMove: engineOnly, report });
    try {
      const result = s.check();
      assert.equal(result.ok, false);
      assert.ok(result.reasons.some(reason => expected.test(reason)), result.reasons.join("\n"));
    } finally { s.done(); }
  }
});

test("the remedy works: a stale run is superseded by a newer named run of the same rows", () => {
  const s = story({ trunkMove: write => write("src/styles/global.css", ":root { --gap: 10px; }\n") });
  try {
    assert.equal(s.check().ok, false, "the first run is stale: a UI input moved");
    s.run("render-TEST-geometry-2");
    const result = s.check();
    assert.equal(result.ok, true, result.reasons.join("\n"));
    assert.match(formatUiGeometryResult(result), /run render-TEST-geometry-1: superseded — a newer named run measured its rows \(modal\.panel\) again/);
  } finally { s.done(); }
});

test("a report whose hash is not its commit's, or with a broken row, does not count (and does not crash)", () => {
  for (const [report, expected] of [
    [{ commitOf: "trunk0" }, /its hash is not its measured commit's/],
    [{ rowsNull: true }, /no row was measured/],
  ] as const) {
    const s = story({ trunkMove: engineOnly, report });
    try {
      const result = s.check();
      assert.equal(result.ok, false);
      assert.ok(result.reasons.some(reason => expected.test(reason)), result.reasons.join("\n"));
    } finally { s.done(); }
  }
});

test("dirty counts only UI inputs, and an LFS pointer left as text is no picture", () => {
  const dir = mkdtempSync(join(tmpdir(), "fls-dirty2-"));
  const git = (...args: string[]) => execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd: dir, encoding: "utf8" }).trim();
  const write = (path: string, text: string | Buffer) => { mkdirSync(dirname(join(dir, path)), { recursive: true }); writeFileSync(join(dir, path), text); };
  try {
    const picture = Buffer.from("real picture bytes"); const oid = createHash("sha256").update(picture).digest("hex");
    const pointer = `version https://git-lfs.github.com/spec/v1\noid sha256:${oid}\nsize ${picture.length}\n`;
    write("src/render/draw.ts", "export const draw = 1;\n"); write("public/assets/lfs.png", pointer);
    git("init", "-q"); git("add", "-A"); git("commit", "-qm", "c");
    write("src/render/draw.ts", "export const draw = 2;\n"); write("src/content/new.ts", "export const n = 1;\n");   // not UI inputs
    assert.deepEqual(uiInputsDirty(dir), ["public/assets/lfs.png"], "the pointer text in place of the picture");
    write("public/assets/lfs.png", picture);
    assert.deepEqual(uiInputsDirty(dir), []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// RR26 with the user's ruling of 2026-10-09: the UI inputs are the roots plus everything src/main.tsx reaches by import
// (copy files outside src/content, data at the end of an import chain, the engine the UI imports), the shared result
// counts only as a full audit, paths with Korean letters or spaces stay in, and a trailer with no report gives way.
for (const [what, path, text] of [
  ["a copy file outside the old roots (ledgerCopy.ko.ts)", "src/ledger/ledgerCopy.ko.ts", 'export const LEDGER_COPY = "영주의 장부";\n'],
  ["a building name in buildingConfig.ts", "src/content/buildingConfig.ts", 'export const BUILDINGS = { mill: { name: "물레방앗간" } };\n'],
  ["the file at the end of an import chain (main → App → Panel → format → table.json)", "src/data/deep/table.json", '{"unit":"단위"}\n'],
  ["an engine file the UI imports", "src/engine/used.ts", "export const used = 2;\n"],
] as const) {
  test(`UI input moved: the trunk changed ${what} — the run does not count, the output names ${path}`, () => {
    const s = story({ trunkMove: write => write(path, text) });
    try {
      const result = s.check();
      assert.equal(result.ok, false);
      assert.ok(result.reasons.some(reason => reason.includes("1 UI input file(s) changed since it was measured") && reason.includes(path)), result.reasons.join("\n"));
    } finally { s.done(); }
  });
}

test("a shared result written by a changed-rows run is no full audit: it does not count, the named run does", () => {
  const s = story({ trunkMove: engineOnly, sharedPartial: true, trailer: false });
  try {
    const result = s.check();
    assert.equal(result.ok, false);
    assert.ok(result.reasons.some(reason => /the shared result \(run rows-only, 1 row\(s\)\) is not a full audit/.test(reason)), result.reasons.join("\n"));
  } finally { s.done(); }
  const t = story({ trunkMove: engineOnly, sharedPartial: true });
  try { assert.equal(t.check().ok, true, "with the trailer the run's own report decides"); } finally { t.done(); }
});

test("only a full audit writes the shared result by default", () => {
  assert.equal(defaultSummaryPath({ explicit: undefined, full: true }), "docs/verification/uiaudit1/geometry.json");
  assert.equal(defaultSummaryPath({ explicit: undefined, full: false }), "none");
  assert.equal(defaultSummaryPath({ explicit: "out/x.json", full: false }), "out/x.json");
});

test("a path with Korean letters and spaces stays a UI input: in the hash, in dirty, in the evidence", () => {
  const s = story({ trunkMove: write => write("src/ui/한글 패널.tsx", "export const k = 2;\n") });
  try {
    const result = s.check();
    assert.equal(result.ok, false);
    assert.ok(result.reasons.some(reason => reason.includes("src/ui/한글 패널.tsx")), result.reasons.join("\n"));
  } finally { s.done(); }
  const dir = mkdtempSync(join(tmpdir(), "fls-quoted-"));
  const git = (...args: string[]) => execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd: dir, encoding: "utf8" }).trim();
  try {
    mkdirSync(join(dir, "src/ui"), { recursive: true }); writeFileSync(join(dir, "src/ui/한글 패널.tsx"), "export const k = 1;\n");
    git("init", "-q"); git("add", "-A"); git("commit", "-qm", "c");
    assert.ok(geometryInputs("HEAD", dir).some(line => line.endsWith(" src/ui/한글 패널.tsx")));
    writeFileSync(join(dir, "src/ui/한글 패널.tsx"), "export const k = 2;\n");
    assert.deepEqual(uiInputsDirty(dir), ["src/ui/한글 패널.tsx"]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a trailer with no report counts for nothing and gives way to a newer named run", () => {
  const s = story({ trunkMove: engineOnly });
  try {
    s.git("commit", "-q", "--allow-empty", "-m", "a run never committed\n\nUI-Geometry-Run: render-TEST-never");
    assert.equal(s.check().ok, false, "the empty trailer is newer than the valid run: it is not superseded");
    s.run("render-TEST-geometry-2");
    const result = s.check();
    assert.equal(result.ok, true, result.reasons.join("\n"));
    assert.match(formatUiGeometryResult(result), /run render-TEST-never: superseded — it has no report or no measured row, and a newer named run holds/);
  } finally { s.done(); }
});

test("a report whose measured commit is not in the repository does not count", () => {
  const s = story({ trunkMove: engineOnly, report: { commit: "0123456789abcdef0123456789abcdef01234567" } });
  try {
    const result = s.check();
    assert.equal(result.ok, false);
    assert.ok(result.reasons.some(reason => /its measured commit 01234567 is not here to check its hash/.test(reason)), result.reasons.join("\n"));
  } finally { s.done(); }
});
