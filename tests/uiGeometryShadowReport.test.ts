import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { gitIn, tempDir } from "./helpers/tempRepo";
import { checkUiGeometry } from "../scripts/checks/uiGeometry.mjs";
import { shadowStep, type Fingerprint } from "../scripts/checks/uiGeometryMeasured.mjs";
import { formatShadowMarkdown, loadRecords, shadowHistory } from "../scripts/uiGeometryShadow.mjs";
import { packInputs } from "../scripts/checks/testInputs/testInputs.mjs";

// RR26 shadow (user rulings 2026-10-10): SHADOW.md counts only the records of commits on the trunk's first-parent line
// (the newest per commit), a stretch with no record and a record without the DGX's values as "판정 불가", both
// directions of a disagreement in tables of their own, and checks an audit a′ would have skipped for a false pass: the
// audit the push carried against the full audit before it — a changed-rows audit only on its rows (비교한 줄 / 전체 줄),
// and again at the next full audit. The story: pushes made on the trunk, each with its check:merge record.
const SHARED = "docs/verification/uiaudit1/geometry.json";
const RUNS = "docs/verification/uiaudit1/geometry";
const READ = ["index.html", "src/main.tsx", "src/ui/Panel.tsx", "scripts/uiGeometryAudit.mjs"];
const DECLARED = { states: { ui5: "ui5-a" }, chromium: "151.0" };
const SAME: Fingerprint = { node: "v24.21.0", chromium: "151.0", playwright: null, system: {}, states: { ui5: "ui5-a" }, nodeModules: null };
const C1 = "1280x800/normal/normal"; const C2 = "390x844/normal/normal";

test("SHADOW.md: pushed commits only, both directions, false passes on the carried audit, the re-check at the next full audit, 판정 불가", () => {
  const dir = tempDir("fls-shadow-md-");
  const git = gitIn(dir);
  const write = (path: string, text: string) => { mkdirSync(dirname(join(dir, path)), { recursive: true }); writeFileSync(join(dir, path), text); };
  const head = () => git("rev-parse", "HEAD");
  const commit = (message: string) => { git("add", "-A"); git("commit", "-qm", message); return head(); };
  /** A run report: rows → { condition: failure keys } (a null condition was not opened). */
  const report = (run: string, at: string, rows: Record<string, Record<string, string[] | null>>, full: boolean, durationS: number) => {
    const body = { run, commit: at, full, axesNarrowed: false, dirty: false, durationS, totals: { unopened: 0 }, unregisteredFramed: [],
      rows: Object.fromEntries(Object.entries(rows).map(([row, conditions]) => [row, { scene: "ui5", conditions: Object.fromEntries(Object.entries(conditions).map(([condition, keys]) => [condition, keys === null ? { status: "error" } : { status: "measured", keys }])) }])) };
    if (full) {
      const inputs = `${JSON.stringify({ schema: 1, kind: "ui-geometry-inputs", run, commit: at, declared: DECLARED, inputs: packInputs(new Map([["audit", { files: READ, dirs: [], missing: [], untraceable: [] }]])) })}\n`;
      write(`${RUNS}/${run}/inputs.json`, inputs);
      const link = { file: `${RUNS}/${run}/inputs.json`, sha256: createHash("sha256").update(inputs).digest("hex"), declared: DECLARED };
      write(`${RUNS}/${run}/geometry.json`, JSON.stringify({ ...body, measuredInputs: link }));
      write(SHARED, JSON.stringify({ run, full: true, commit: at, dirty: false, failureKeys: [], unopened: 0, unregisteredFramed: 0, rows: Object.keys(rows).length, report: `${RUNS}/${run}/geometry.json`, measuredInputs: link }));
    } else write(`${RUNS}/${run}/geometry.json`, JSON.stringify(body));
  };
  const records = join(dir, ".remote-runs/_shadow");
  let minute = 0;
  /** check:merge's shadow at the pushed head (base: the trunk before the push), with or without the DGX's values. */
  const record = (base: string, fingerprint: Fingerprint | null) => {
    minute += 1;
    shadowStep({ base, head: head(), gate: checkUiGeometry({ base, head: head(), cwd: dir, mode: "enforce", env: {} }), cwd: dir, env: { FLS_SESSION: "infra" },
      now: new Date(Date.UTC(2026, 9, 12, 9, minute)), remote: () => fingerprint === null ? { error: "the DGX did not answer in 5 s" } : { fingerprint } });
  };
  try {
    for (const path of READ) write(path, `${path}\n`);
    write("src/unused.ts", "export const u = 1;\n"); write(".gitignore", ".remote-runs/\n");
    write("docs/verification/uiaudit1/geometry-baseline.json", '{"entries":[]}'); write("docs/verification/uiaudit1/geometry-exceptions.json", '{"exceptions":[]}');
    git("init", "-q", "-b", "trunk"); const c0 = commit("trunk");
    report("full-1", c0, { "hud.panel": { [C1]: [], [C2]: [] }, "lord.card": { [C1]: [], [C2]: [] } }, true, 3600);
    const since = commit("the shadow lands, with the full audit");
    // Push A: a file no page loads, with a changed-rows audit of hud.panel that shows a new failure — a′ would have skipped it.
    write("src/unused.ts", "a\n"); const a1 = commit("A: a file no page loads");
    report("rows-a", a1, { "hud.panel": { [C1]: ["overflow|div.panel"], [C2]: [] } }, false, 600);
    git("add", "-A"); git("commit", "-qm", "A: its rows' audit\n\nUI-Geometry-Run: rows-a"); record(since, SAME); const a = head();
    // A commit of push A's branch that was never pushed as such: its record does not count.
    // Push B: a document while a state folder changed on the DGX — a′ alone wants an audit.
    write("docs/b.md", "b\n"); commit("B: a document"); record(a, { ...SAME, states: { ui5: "ui5-b" } }); const b = head();
    // Push C: no record (a check:merge from before the shadow, or skipped) — 판정 불가.
    write("docs/c.md", "c\n"); commit("C: a document, no record");
    // Push D: a file no page loads, the DGX did not answer — 판정 불가 (no fingerprint).
    const c = head(); write("src/unused.ts", "d\n"); commit("D: a file no page loads"); record(c, null); const d = head();
    // Push E: a file no page loads with a clean changed-rows audit of lord.card — skipped by a′, no false pass yet, checked again later.
    write("src/unused.ts", "e\n"); const e1 = commit("E: a file no page loads");
    report("rows-e", e1, { "lord.card": { [C1]: [], [C2]: [] } }, false, 300);
    git("add", "-A"); git("commit", "-qm", "E: its rows' audit\n\nUI-Geometry-Run: rows-e");
    record(d, null); record(d, SAME); const e = head();   // check:merge twice: the newer record counts
    // Push F: a panel change with a new full audit, where lord.card does not open in one condition.
    write("src/ui/Panel.tsx", "f\n"); const f1 = commit("F: the panel");
    report("full-2", f1, { "hud.panel": { [C1]: [], [C2]: [] }, "lord.card": { [C1]: [], [C2]: null } }, true, 3500);
    commit("F: the full audit"); record(e, SAME);
    // A record of a commit not on the trunk (check:merge on a branch never pushed).
    git("checkout", "-qb", "side"); write("src/unused.ts", "side\n"); commit("side"); record(head(), SAME); git("checkout", "-q", "trunk");

    const history = shadowHistory({ records: loadRecords(records), trunk: head(), since, cwd: dir });
    assert.deepEqual(history.pushes.map(push => [push.head.slice(0, 8), push.judgement.rr26, push.judgement.aprime]), [
      [a.slice(0, 8), "needed", "not needed"], [b.slice(0, 8), "not needed", "needed"], [d.slice(0, 8), "needed", "undecidable"],
      [e.slice(0, 8), "needed", "not needed"], [head().slice(0, 8), "needed", "needed"]]);
    assert.equal(history.unrecorded.length, 2, "the first commit (no record of its own) and push C");
    const [pushA, , , pushE] = history.pushes;
    assert.deepEqual(pushA!.carried?.comparison, { rows: 1, total: 2, failures: [`hud.panel|${C1}|overflow|div.panel`], unopened: [] });
    assert.equal(pushE!.carried?.comparison?.failures.length, 0);
    assert.deepEqual(pushE!.recheck, { status: "checked", run: "full-2", rows: 2, total: 2, failures: [], unopened: [`lord.card|${C2}`] });
    const text = formatShadowMarkdown(history);
    assert.match(text, /\*\*RR26 감사 필요 \/ a′ 불필요 2\*\* · \*\*RR26 불필요 \/ a′ 감사 필요 1\*\* · 안전 목록 대체 0 · 판정 불가: 지문 없음 1, 기록 없는 구간 2개\(커밋 2개\)/);
    assert.match(text, new RegExp(`\\| ${a.slice(0, 8)} \\| 2026-10-12 09:01 \\| infra \\| \\d+ \\| 바뀐 줄: rows-a \\(10분\\) \\| 1 / 2 \\| \\*\\*거짓 통과\\*\\*: 새 실패 \`hud\\.panel\\|${C1}\\|overflow\\|div\\.panel\``));
    assert.match(text, new RegExp(`\\| ${e.slice(0, 8)} \\| [^|]+ \\| infra \\| \\d+ \\| 바뀐 줄: rows-e \\(5분\\) \\| 1 / 2 \\| 없음 \\| \\*\\*full-2: 새 실패 없음, 못 연 조건 \`lord\\.card\\|${C2}\`\\*\\* \\|`));
    assert.match(text, new RegExp(`\\| ${b.slice(0, 8)} \\| [^|]+ \\| infra \\| the environment: the state folder ui5 changed \\|`));
    assert.match(text, /그림자 기록이 실제로 시작되는 시점: 그다음 전체 감사부터/);
    assert.match(text, new RegExp(`a′가 처음 판정한 푸시: ${a.slice(0, 8)} \\(2026-10-12\\)\\.`));
    assert.match(text, /현재: 엇갈린 푸시\(a′가 건너뛰었을 감사\) 2개, 거짓 통과 2개/);
    assert.match(text, /\| 2026-10-12 \| 5 \| 2 \| 15분 \| 1 \| 1 \|/);
    assert.match(text, new RegExp(`\\| 지문 없음 \\| ${d.slice(0, 8)} \\| the DGX did not answer in 5 s \\|`));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
