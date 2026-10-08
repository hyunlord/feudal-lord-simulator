// UI-AUDIT-1: the geometry audit's gate (check:merge), on a baseline. The DGX audit (npm run remote:ui-geometry,
// scripts/uiGeometryAudit.mjs) writes docs/verification/uiaudit1/geometry.json: the hash of its UI inputs at the commit
// it measured (UI_INPUT_ROOTS below: what can change UI geometry — src/ui, src/styles, src/render/*.tsx, the *.ko.ts
// copy, App/main, index.html, vite.config.ts, public/assets, the audit's scripts; not the engine, sim, ledger or state)
// and every failure's key (row | viewport/copy/numbers | check | element path — stable across runs, no px). A result
// file cannot carry its own commit's sha, so the step keys on those inputs. A range that changes no UI input passes
// ("no UI inputs changed"); only the lists' shrink rules are checked then. Otherwise the step fails when, at <head>:
//  - the result is missing, of other inputs, or measured from a tree with uncommitted changes;
//  - a surface condition could not be opened, or a framed root (data-frame) on screen is in no registry row;
//  - a failure is neither in the baseline (docs/verification/uiaudit1/geometry-baseline.json) nor matched by an
//    exception (docs/verification/uiaudit1/geometry-exceptions.json: row + check + element path fragment + reason);
//  - a baseline entry no longer fails ("N fixed, drop them": npm run ui-geometry:baseline), or an exception matches
//    nothing — both lists only shrink;
//  - base..head adds baseline entries without a recorded reason (the baseline script's --reason), or adds exceptions.
// A changed-rows audit (`--only`) counts in place of a stale shared result (decision RR26, the first step of the user's
// ruling 2026-10-09) when a commit in base..head names it with a `UI-Geometry-Run: <run>` trailer and its report
// (docs/verification/uiaudit1/geometry/<run>/geometry.json at <head>) was measured from a clean tree, opened every
// condition, has no framed root outside the registry, has no failure of its rows outside the baseline and the
// exceptions, no baseline entry of its rows left unfailing, and has <head>'s UI input hash: no UI input changed since
// it was measured, however far the trunk moved. Otherwise the step names the UI input files changed since that run.
// The thresholds are the audit's (8 px gap, 40 % empty warning, 0.5–1 px tolerance); an exemption is an exception entry,
// never a looser check. Mode: UI_GEOMETRY_GATE ('enforce' fails check:merge, 'warn' only reports);
// FLS_UI_GEOMETRY_GATE=warn lets a failing result through only with a reason: FLS_UI_GEOMETRY_REASON="<one line>" (a few
// words), and the head commit carrying the same reason as a `UI-Geometry-Override: <reason>` trailer (the record every
// worktree sees; the refusal prints the `git commit --amend --trailer` command). The override also prints the line a
// report must carry and appends it to .remote-runs/local-heavy.log. check:merge states how many commits in the range
// carry the trailer ("ui-geometry: warn overrides in this range: N").
//   node scripts/checks/uiGeometry.mjs [--base <rev>] [--head <rev>]
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync } from 'node:fs';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { git, isMain, resolveRange } from './gitRange.mjs';

export const UI_GEOMETRY_SUMMARY = 'docs/verification/uiaudit1/geometry.json';
export const UI_GEOMETRY_BASELINE = 'docs/verification/uiaudit1/geometry-baseline.json';
export const UI_GEOMETRY_EXCEPTIONS = 'docs/verification/uiaudit1/geometry-exceptions.json';
/** What can change UI geometry: path roots, each with the files under it that count (null: every file). */
export const UI_INPUT_ROOTS = Object.freeze([
  ['src/ui', null], ['src/styles', null], ['src/render', /\.tsx$/], ['src/content', /\.ko\.ts$/], ['src/App.tsx', null], ['src/main.tsx', null],
  ['index.html', null], ['vite.config.ts', null], ['public/assets', null],
  ['scripts/uiGeometryAudit.mjs', null], ['scripts/uiGeometryMeasure.ts', null], ['scripts/uiGeometryScene.ts', null],
  ['scripts/renderCommitProbe.mjs', null], ['scripts/sceneInjection.mjs', null], ['scripts/remote/viteNoWatch.config.ts', null],
].map(([root, only]) => Object.freeze({ root, only })));
/** The audit scripts among them (their uncommitted changes make a result dirty). */
export const UI_GEOMETRY_SCRIPTS = Object.freeze(UI_INPUT_ROOTS.map(item => item.root).filter(root => root.startsWith('scripts/')));
// UI-AUDIT-1 (the user's decision): enforcing on the baseline — no new failure, the baseline and the exceptions only
// shrink.
export const UI_GEOMETRY_GATE = 'enforce';

/** The UI inputs at `rev`: one line per counted file (`<blob> <path>`), from git objects. */
export function geometryInputs(rev, cwd = process.cwd()) {
  const out = git(['ls-tree', '-r', '--full-tree', rev, '--', ...UI_INPUT_ROOTS.map(item => item.root)], cwd);
  const lines = [];
  for (const row of out.split('\n')) {
    const tab = row.indexOf('\t'); if (tab < 0) continue;
    const [, , blob] = row.slice(0, tab).split(' '); const path = row.slice(tab + 1);
    const input = UI_INPUT_ROOTS.find(item => path === item.root || path.startsWith(`${item.root}/`));
    if (input !== undefined && (input.only === null || input.only.test(path))) lines.push(`${blob} ${path}`);
  }
  return lines.sort();
}

export function geometryInputHash(inputs) {
  return createHash('sha256').update(inputs.join('\n')).digest('hex');
}

export function gateMode(env = process.env) {
  const value = env.FLS_UI_GEOMETRY_GATE;
  return value === 'enforce' || value === 'warn' ? value : UI_GEOMETRY_GATE;
}

/** A failure key's parts: row | condition | check | path. */
export const splitKey = key => { const [row, condition, check, ...path] = key.split('|'); return { row, condition, check, path: path.join('|') }; };
const exceptionId = entry => `${entry.row}|${entry.check}|${entry.match}`;

/**
 * Pure: a run's failure keys against the baseline and the exceptions. An exception covers every condition of its row
 * and check whose element path contains `match`.
 */
export function compareBaseline({ keys, baseline = [], exceptions = [] }) {
  const used = new Set();
  const excepted = []; const counted = [];
  for (const key of new Set(keys)) {
    const { row, check, path } = splitKey(key);
    const entry = exceptions.find(item => item.row === row && item.check === check && path.includes(item.match));
    if (entry === undefined) counted.push(key); else { excepted.push(key); used.add(exceptionId(entry)); }
  }
  const inBaseline = new Set(baseline); const now = new Set(counted);
  return {
    failures: counted.length, excepted: excepted.length, baseline: inBaseline.size, exceptions: exceptions.length, counted: counted.sort(),
    added: counted.filter(key => !inBaseline.has(key)).sort(),
    fixed: [...inBaseline].filter(key => !now.has(key)).sort(),
    staleExceptions: exceptions.filter(entry => !used.has(exceptionId(entry))),
  };
}

const readJson = (rev, path, cwd) => {
  try { return JSON.parse(execFileSync('git', ['show', `${rev}:${path}`], { cwd, encoding: 'utf8', maxBuffer: 256 * 2 ** 20, stdio: ['ignore', 'pipe', 'ignore'] })); } catch { return null; }
};
const sample = list => list.slice(0, 5).map(item => `    ${typeof item === 'string' ? item : exceptionId(item)}`);

export const UI_GEOMETRY_RUNS = 'docs/verification/uiaudit1/geometry';

/** The UI-Geometry-Run trailers of base..head: the changed-rows audit runs a push names (RR26). */
export function rowRunsInRange(base, head, cwd = process.cwd()) {
  const range = base === null ? ['-1', head] : [`${base}..${head}`];
  const out = git(['log', '--format=%(trailers:key=UI-Geometry-Run,valueonly,separator=%x01)%x02', ...range], cwd);
  return [...new Set(out.split('\x02').flatMap(row => row.split('\x01')).map(value => value.trim()).filter(Boolean))];
}

/** A run report's failure keys (row | condition | check | path), its measured rows and their conditions. */
export function reportFailures(report) {
  const keys = []; const measured = new Map();
  for (const [row, entry] of Object.entries(report?.rows ?? {})) {
    for (const [condition, record] of Object.entries(entry.conditions ?? {})) {
      if (record.status !== 'measured') continue;
      if (!measured.has(row)) measured.set(row, new Set());
      measured.get(row).add(condition);
      for (const key of record.keys ?? []) keys.push(`${row}|${condition}|${key}`);
    }
  }
  return { keys: keys.sort(), measured };
}

/** The UI input files that differ between two commits (added, removed or changed), or null when `from` is not here. */
export function changedUiInputs(from, to, cwd = process.cwd()) {
  let before; try { before = geometryInputs(from, cwd); } catch { return null; }
  const after = geometryInputs(to, cwd);
  const blobs = lines => new Map(lines.map(line => { const space = line.indexOf(' '); return [line.slice(space + 1), line.slice(0, space)]; }));
  const a = blobs(before); const b = blobs(after);
  return [...new Set([...a.keys(), ...b.keys()])].filter(path => a.get(path) !== b.get(path)).sort();
}

/** One changed-rows run against <head> (RR26): ok, the reasons it is not, and the evidence. */
export function checkRowRun({ run, head, hash, baseline, exceptions, cwd = process.cwd() }) {
  const report = readJson(head, `${UI_GEOMETRY_RUNS}/${run}/geometry.json`, cwd);
  if (report === null) return { run, ok: false, reasons: [`run ${run}: no ${UI_GEOMETRY_RUNS}/${run}/geometry.json at ${head.slice(0, 8)} (commit the run's report)`] };
  const reasons = [];
  const commit = String(report.commit ?? '');
  if (report.inputHash !== hash) {
    const files = changedUiInputs(commit, head, cwd);
    reasons.push(files === null
      ? `run ${run}: the UI inputs changed since it was measured at ${commit.slice(0, 8)} (that commit is not here to name them): audit the changed rows again`
      : `run ${run}: ${files.length} UI input file(s) changed since it was measured at ${commit.slice(0, 8)}: ${files.slice(0, 6).join(', ')}${files.length > 6 ? ` … ${files.length - 6} more` : ''} — audit the changed rows again`);
  }
  if (report.dirty) reasons.push(`run ${run}: measured from a tree with uncommitted changes`);
  if ((report.totals?.unopened ?? 0) !== 0) reasons.push(`run ${run}: ${report.totals.unopened} surface condition(s) could not be opened`);
  if ((report.unregisteredFramed?.length ?? 0) !== 0) reasons.push(`run ${run}: ${report.unregisteredFramed.length} framed root(s) on screen that no registry row measures`);
  const { keys, measured } = reportFailures(report);
  if (measured.size === 0) reasons.push(`run ${run}: no row was measured`);
  const ofRun = key => { const { row, condition } = splitKey(key); return measured.get(row)?.has(condition) === true; };
  const comparison = compareBaseline({ keys, baseline: baseline.filter(ofRun), exceptions: exceptions.filter(entry => measured.has(entry.row)) });
  if (comparison.added.length > 0) reasons.push(`run ${run}: ${comparison.added.length} new failure(s), in no baseline entry or exception:`, ...sample(comparison.added));
  if (comparison.fixed.length > 0) reasons.push(`run ${run}: ${comparison.fixed.length} baseline entr(ies) of its rows fixed, drop them (npm run ui-geometry:baseline):`, ...sample(comparison.fixed));
  let moved = null; try { moved = git(['diff', '--name-only', commit, head], cwd).split('\n').filter(Boolean).length; } catch { /* the commit is not here */ }
  const cells = [...measured.values()].reduce((sum, set) => sum + set.size, 0);
  return { run, ok: reasons.length === 0, reasons, commit, rows: [...measured.keys()].sort(), cells, failures: comparison.failures, moved };
}

/** The UI-Geometry-Override trailers of base..head (the head alone without a base): [{ commit, reason }]. */
export function overridesInRange(base, head, cwd = process.cwd()) {
  const range = base === null ? ['-1', head] : [`${base}..${head}`];
  const out = git(['log', '--format=%H%x00%(trailers:key=UI-Geometry-Override,valueonly,separator=%x01)%x02', ...range], cwd);
  return out.split('\x02').map(row => row.trim()).filter(Boolean).flatMap(row => {
    const [commit, values = ''] = row.split('\x00');
    return values.split('\x01').map(value => value.trim()).filter(Boolean).map(reason => ({ commit, reason }));
  });
}

export function checkUiGeometry({ base = null, head, cwd = process.cwd(), mode = gateMode(), env = process.env }) {
  const inputs = geometryInputs(head, cwd);
  if (!inputs.some(line => line.endsWith(' scripts/uiGeometryAudit.mjs'))) return { skipped: true, mode, ok: true, pass: true, reasons: [] };
  const hash = geometryInputHash(inputs);
  // A range that changes no UI input cannot move the result: only the lists' shrink rules apply.
  const unchanged = base !== null && geometryInputHash(geometryInputs(base, cwd)) === hash;
  const summary = readJson(head, UI_GEOMETRY_SUMMARY, cwd);
  const baselineFile = readJson(head, UI_GEOMETRY_BASELINE, cwd);
  const exceptions = readJson(head, UI_GEOMETRY_EXCEPTIONS, cwd)?.exceptions ?? [];
  const reasons = [];
  let comparison = null;
  if (!unchanged && summary === null) reasons.push(`no ${UI_GEOMETRY_SUMMARY} at ${head.slice(0, 8)}`);
  else if (!unchanged) {
    if (summary.inputHash !== hash) reasons.push(`the UI inputs changed since the result (measured at ${String(summary.commit ?? '?').slice(0, 8)}): refresh it — npm run remote:ui-geometry, commit docs/verification/uiaudit1/geometry.json (and npm run ui-geometry:baseline if something was fixed)`);
    if (summary.dirty) reasons.push('the result was measured from a tree with uncommitted changes');
    if (summary.unopened !== 0) reasons.push(`${summary.unopened} surface condition(s) could not be opened`);
    if ((summary.unregisteredFramed ?? 0) !== 0) reasons.push(`${summary.unregisteredFramed} framed root(s) (data-frame) on screen that no registry row measures`);
    if (!Array.isArray(summary.failureKeys)) reasons.push('the result has no failure keys (an audit from before the baseline): run the audit again');
    else {
      if (baselineFile === null) reasons.push(`no ${UI_GEOMETRY_BASELINE}: npm run ui-geometry:baseline -- --reason "…"`);
      comparison = compareBaseline({ keys: summary.failureKeys, baseline: baselineFile?.entries ?? [], exceptions });
      if (comparison.added.length > 0) reasons.push(`${comparison.added.length} new failure(s), in no baseline entry or exception:`, ...sample(comparison.added));
      if (comparison.fixed.length > 0) reasons.push(`${comparison.fixed.length} fixed, drop them from the baseline (npm run ui-geometry:baseline):`, ...sample(comparison.fixed));
      if (comparison.staleExceptions.length > 0) reasons.push(`${comparison.staleExceptions.length} exception(s) match no failure, drop them:`, ...sample(comparison.staleExceptions));
    }
  }
  // RR26: a stale or missing shared result gives way to the changed-rows runs the range names, when every one holds.
  let rowRuns = null;
  if (!unchanged && reasons.length > 0) {
    const runs = rowRunsInRange(base, head, cwd);
    if (runs.length > 0) {
      rowRuns = runs.map(run => checkRowRun({ run, head, hash, baseline: baselineFile?.entries ?? [], exceptions, cwd }));
      reasons.length = 0; comparison = null;
      for (const entry of rowRuns) reasons.push(...entry.reasons);
    }
  }
  // Only shrink: what base..head adds.
  if (base !== null && baselineFile !== null) {
    const before = readJson(base, UI_GEOMETRY_BASELINE, cwd);
    if (before !== null) {
      const had = new Set(before.entries ?? []); const grown = (baselineFile.entries ?? []).filter(key => !had.has(key));
      if (grown.length > 0 && (baselineFile.reasons?.length ?? 0) <= (before.reasons?.length ?? 0)) reasons.push(`the baseline grew by ${grown.length} entr(ies) with no recorded reason (npm run ui-geometry:baseline -- --reason "…")`);
    }
    const exceptionsBefore = readJson(base, UI_GEOMETRY_EXCEPTIONS, cwd);
    if (exceptionsBefore !== null) {
      const had = new Set((exceptionsBefore.exceptions ?? []).map(exceptionId)); const addedExceptions = exceptions.filter(entry => !had.has(exceptionId(entry)));
      if (addedExceptions.length > 0) reasons.push(`${addedExceptions.length} exception(s) added (the list only shrinks):`, ...sample(addedExceptions));
    }
  }
  const ok = reasons.length === 0;
  // The override: only from the environment, with a reason the head commit records as a trailer.
  let override = null;
  if (!ok && mode === 'warn' && env.FLS_UI_GEOMETRY_GATE === 'warn') {
    const reason = (env.FLS_UI_GEOMETRY_REASON ?? '').replace(/\s+/g, ' ').trim();
    const recorded = overridesInRange(null, head, cwd).map(item => item.reason);
    if (reason.split(' ').filter(Boolean).length < 3) override = { refused: 'FLS_UI_GEOMETRY_GATE=warn needs FLS_UI_GEOMETRY_REASON="<one line: why, in a few words>"' };
    else if (!recorded.includes(reason)) override = { refused: `the head commit does not record the override: git commit --amend --no-edit --trailer "UI-Geometry-Override: ${reason}"` };
    else override = { reason };
  }
  const pass = ok || (mode === 'warn' && env.FLS_UI_GEOMETRY_GATE !== 'warn') || override?.reason !== undefined;
  return { skipped: false, mode, ok, pass, reasons: override?.refused === undefined ? reasons : [...reasons, `override refused: ${override.refused}`], summary, hash, comparison, unchanged, override, rowRuns };
}

/** An accepted override: the line a report must carry, also appended (time, host, commit, reason) to .remote-runs/local-heavy.log. */
export function logWarnOverride(result, { top = process.cwd(), head = '' } = {}) {
  if (result.override?.reason === undefined) return null;
  const line = `${new Date().toISOString()}\t${hostname()}\t${head.slice(0, 8)}\tui-geometry gate overridden (FLS_UI_GEOMETRY_GATE=warn)\t${result.override.reason}`;
  try { mkdirSync(join(top, '.remote-runs'), { recursive: true }); appendFileSync(join(top, '.remote-runs', 'local-heavy.log'), `${line}\n`); } catch { /* read-only tree */ }
  return `[FLS_UI_GEOMETRY_GATE=warn] 기하 감사 관문을 우회했다(${head.slice(0, 8)}): ${result.override.reason}. 보고서에 반드시 적는다. 기록: 커밋 트레일러 UI-Geometry-Override, .remote-runs/local-heavy.log`;
}

/** check:merge's count line: the commits of base..head carrying a UI-Geometry-Override trailer, with their reasons. */
export function formatOverrideCount(base, head, cwd = process.cwd()) {
  const overrides = overridesInRange(base, head, cwd);
  return [`ui-geometry: warn overrides in this range: ${overrides.length}`, ...overrides.map(item => `  ${item.commit.slice(0, 8)} ${item.reason}`)].join('\n');
}

export function formatUiGeometryResult(result) {
  if (result.skipped) return 'ui-geometry: skipped (no geometry audit at this commit)';
  const tag = result.override?.reason !== undefined ? ` (overridden: ${result.override.reason})` : result.mode === 'warn' && result.pass ? ' (report only: UI_GEOMETRY_GATE = warn)' : '';
  const counts = result.comparison === null || result.comparison === undefined ? ''
    : ` — ${result.comparison.failures} failure(s): ${result.comparison.baseline} in the baseline, ${result.comparison.excepted} under ${result.comparison.exceptions} exception(s)`;
  if (result.ok && result.unchanged) return `ui-geometry: no UI inputs changed${tag}`;
  if (result.ok && result.rowRuns) return [`ui-geometry: changed rows accepted (decision RR26)${tag}`, ...result.rowRuns.map(entry =>
    `  run ${entry.run} (commit ${entry.commit.slice(0, 8)}): ${entry.rows.length} row(s), ${entry.cells} cell(s), no new failure; no UI input changed since it was measured${entry.moved === null ? '' : ` (${entry.moved} file(s) changed since, none a UI input)`} — ${entry.rows.slice(0, 4).join(', ')}${entry.rows.length > 4 ? ' …' : ''}`)].join('\n');
  if (result.ok) return `ui-geometry: run ${result.summary.run}, no new failure${counts}${tag}`;
  const lines = [`ui-geometry: ${result.pass ? 'not green' : 'FAILED'}${counts}${tag}`];
  for (const reason of result.reasons) lines.push(reason.startsWith('    ') ? reason : `  ${reason}`);
  return lines.join('\n');
}

if (isMain(import.meta.url)) {
  const { base, head } = resolveRange();
  const result = checkUiGeometry({ base, head });
  console.log(formatUiGeometryResult(result));
  const override = logWarnOverride(result, { head }); if (override !== null) console.error(override);
  console.log(formatOverrideCount(base, head));
  process.exitCode = result.pass ? 0 : 1;
}
