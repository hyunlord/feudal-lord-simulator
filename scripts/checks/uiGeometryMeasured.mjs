// RR26 measured (a′, user ruling 2026-10-10) — in shadow (user rulings 2026-10-10): the gate judges by RR26's safe list
// (scripts/checks/uiGeometry.mjs, unchanged); this module computes what a′ would judge and check:merge only records it.
// a′: a geometry result counts on a newer commit when nothing its audit read changed since — the files, listed folders
// and missing paths the dev server and the audit read (scripts/uiGeometryInputs.mjs writes them next to the result,
// linked by hash), a package.json or tsconfig.json anywhere and the lock file; without a measurement, a broken one or an
// untraceable audit, the safe list judges. The declared inputs (scene state folders, Chromium, Playwright, node, the
// node_modules install, system identity files, Vite's dependency cache) are bound by value.
// The shadow (shadowStep): for base..head, RR26's verdict (an audit needed: a file off the safe list changed) and a′'s,
// judged against the shared result as it was at <base> (the one the push found) — the files, and the DGX's values now
// (the fingerprint, scripts/uiGeometryFingerprint.mjs, read once over ssh with a 5 s cap) against its declared inputs.
// Each run is recorded in .remote-runs/_shadow/ and on the DGX (~/fls-runs/_shadow/, a file per run);
// scripts/uiGeometryShadow.mjs builds docs/verification/uiaudit1/SHADOW.md from the records of pushed commits. A missing
// fingerprint is "판정 불가": the gate goes on as it is, and the shadow never changes its verdict.
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { git } from './gitRange.mjs';
import { inputOverlap, treeChanges, unpackInputs } from './testInputs/testInputs.mjs';
import { UI_GEOMETRY_BASELINE, UI_GEOMETRY_EXCEPTIONS, UI_GEOMETRY_RUNS, UI_GEOMETRY_SUMMARY, compareBaseline, exceptionId, gateMode, measuredAt, overridesInRange,
  readJson, reportFailures, reportNotOpened, rowRunsInRange, sample, splitKey, unsafeChanges } from './uiGeometry.mjs';

/** The reason line for stale changes since a measurement (measured inputs, or the safe list and why). */
const unsafeLine = (what, commit, changes) => {
  const list = `${changes.unsafe.slice(0, 6).join(', ')}${changes.unsafe.length > 6 ? ` … ${changes.unsafe.length - 6} more` : ''}`;
  if (changes.how === 'measured') return `${what}: ${changes.unsafe.length} file(s) the audit read changed since it was measured at ${commit.slice(0, 8)} (measured inputs): ${list} — audit again`;
  return `${what}: ${changes.unsafe.length} file(s) off the safe list changed since it was measured at ${commit.slice(0, 8)} (${changes.reaching === null ? 'the import closure could not be read' : `${changes.reaching} of them reach the UI or the audit by import`}): ${list} — audit again`;
};
/** The note under a stale line judged by the safe list: why there were no measured inputs to judge by. */
const safeListNote = changes => changes.how === 'measured' ? [] : [`    judged by the safe list: ${changes.how}`];

/**
 * RR26 measured (a′, user ruling 2026-10-10): what an audit read, linked from its result (`measuredInputs`, written by
 * scripts/uiGeometryInputs.mjs): { status: 'ok', inputs, declared } — or 'none' / 'broken' (no link, the file not
 * committed at <head>, its hash or form wrong) or 'untraceable' (the dev server or the audit did what the recorder cannot
 * follow), each with `why`. Only 'ok' is used; the others fall back to the safe list.
 */
export function measuredInputs(result, head, cwd = process.cwd()) {
  const link = result?.measuredInputs;
  if (link === undefined || link === null) return { status: 'none', why: 'no measured inputs' };
  if (typeof link !== 'object' || typeof link.file !== 'string' || !/^[0-9a-f]{64}$/.test(String(link.sha256 ?? ''))) return { status: 'broken', why: 'its measured inputs are not linked whole' };
  let text; try { text = execFileSync('git', ['show', `${head}:${link.file}`], { cwd, encoding: 'utf8', maxBuffer: 256 * 2 ** 20, stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return { status: 'broken', why: `its measured inputs (${link.file}) are not committed` }; }
  if (createHash('sha256').update(text).digest('hex') !== link.sha256) return { status: 'broken', why: `its measured inputs (${link.file}) do not match their hash` };
  let body; try { body = JSON.parse(text); } catch { return { status: 'broken', why: `its measured inputs (${link.file}) are not JSON` }; }
  if (body?.kind !== 'ui-geometry-inputs' || body.schema !== 1) return { status: 'broken', why: `its measured inputs (${link.file}) are of another kind or schema` };
  const inputs = unpackInputs(body.inputs, 'audit');
  if (inputs === null) return { status: 'broken', why: `its measured inputs (${link.file}) hold no audit record` };
  if (body.run !== result.run || body.commit !== result.commit) return { status: 'broken', why: `its measured inputs (${link.file}) are of another run or commit (${body.run ?? '?'} at ${String(body.commit ?? '?').slice(0, 8)})` };
  if (inputs.untraceable.length > 0) return { status: 'untraceable', why: `not measurable: ${inputs.untraceable.slice(0, 3).join('; ')}`, declared: body.declared ?? null };
  return { status: 'ok', inputs, declared: body.declared ?? null };
}

/**
 * The changes from `from` to `to` that make a result stale: with measured inputs, the files the audit read (or folders
 * it listed, paths it looked for, a package.json or tsconfig.json anywhere, the lock file) that changed — `how:
 * 'measured'`; without, the changes off the safe list — `how` says why the safe list judged.
 */
export function staleChanges(from, to, cwd = process.cwd(), cache = new Map(), measured = null) {
  if (measured?.status === 'ok') {
    const changes = treeChanges(cwd, from, to);
    // A folder listed one level counts when its entries differ between the two trees (a missing folder has none).
    const names = rev => dir => { try { return git(['ls-tree', '--name-only', `${rev}:${dir}`], cwd); } catch { return null; } };
    const namesChanged = dir => names(from)(dir) !== names(to)(dir);
    return { changed: changes.length, unsafe: inputOverlap(measured.inputs, changes, { namesChanged, shadows: true }), reaching: null, how: 'measured' };
  }
  return { ...unsafeChanges(from, to, cwd, cache), how: measured === null ? 'no measured inputs' : measured.why };
}

/** One changed-rows run against <head> (RR26): ok, the reasons it is not, and the evidence. */
export function checkRowRunMeasured({ run, head, baseline, exceptions, cwd = process.cwd(), cache = new Map() }) {
  const report = readJson(head, `${UI_GEOMETRY_RUNS}/${run}/geometry.json`, cwd);
  if (report === null) return { run, ok: false, reasons: [`run ${run}: no ${UI_GEOMETRY_RUNS}/${run}/geometry.json at ${head.slice(0, 8)} (commit the run's report)`] };
  const reasons = [];
  const commit = /^[0-9a-f]{40}$/.test(String(report.commit ?? '')) ? report.commit : '';
  if (report.run !== run) reasons.push(`run ${run}: its report names another run (${report.run ?? 'none'})`);
  if (commit === '') reasons.push(`run ${run}: its report has no measured commit`);
  let changes = null;
  if (commit !== '') {
    const at = measuredAt(commit, head, cwd);
    if (at === 'missing') reasons.push(`run ${run}: its measured commit ${commit.slice(0, 8)} is not here`);
    else if (at === 'not-ancestor') reasons.push(`run ${run}: its measured commit ${commit.slice(0, 8)} is not in the pushed history (amended or rebased away): audit again`);
    else { changes = staleChanges(commit, head, cwd, cache, measuredInputs(report, head, cwd)); if (changes.unsafe.length > 0) reasons.push(unsafeLine(`run ${run}`, commit, changes), ...safeListNote(changes)); }
  }
  if (report.axesNarrowed !== false) reasons.push(`run ${run}: ${report.axesNarrowed === true ? 'narrowed by --viewports, --copy or --numbers' : 'its report does not say it measured every condition (an audit from before RR26)'}: audit the rows in every condition`);
  // A report that leaves out what it must say fails (the audit always writes these fields).
  if (report.dirty !== false) reasons.push(`run ${run}: ${report.dirty === true ? 'measured from a tree with uncommitted changes' : 'its report does not say whether the tree was clean'}`);
  const notOpened = reportNotOpened(report);
  if (typeof report.totals?.unopened !== 'number') reasons.push(`run ${run}: its report does not count the surface conditions not opened`);
  else if (Math.max(report.totals.unopened, notOpened) !== 0) reasons.push(`run ${run}: ${Math.max(report.totals.unopened, notOpened)} surface condition(s) could not be opened`);
  if (!Array.isArray(report.unregisteredFramed)) reasons.push(`run ${run}: its report does not list the framed roots no registry row measures`);
  else if (report.unregisteredFramed.length !== 0) reasons.push(`run ${run}: ${report.unregisteredFramed.length} framed root(s) on screen that no registry row measures`);
  const { keys, measured } = reportFailures(report);
  if (measured.size === 0) reasons.push(`run ${run}: no row was measured`);
  const ofRun = key => { const { row, condition } = splitKey(key); return measured.get(row)?.has(condition) === true; };
  const comparison = compareBaseline({ keys, baseline: baseline.filter(ofRun), exceptions: exceptions.filter(entry => measured.has(entry.row)) });
  if (comparison.added.length > 0) reasons.push(`run ${run}: ${comparison.added.length} new failure(s), in no baseline entry or exception:`, ...sample(comparison.added));
  if (comparison.fixed.length > 0) reasons.push(`run ${run}: ${comparison.fixed.length} baseline entr(ies) of its rows fixed, drop them (npm run ui-geometry:baseline):`, ...sample(comparison.fixed));
  const moved = changes === null ? null : changes.changed;
  const cells = [...measured.values()].reduce((sum, set) => sum + set.size, 0);
  return { run, ok: reasons.length === 0, reasons, commit, rows: [...measured.keys()].sort(), cells, failures: comparison.failures, moved, how: changes?.how ?? null };
}

/** The reasons a named run's declared inputs leave the shared result's rows stale (see checkUiGeometryMeasured). */
export function declaredReasons({ shared, sharedDeclared, sharedRows, runs, head, cwd = process.cwd() }) {
  const reasons = [];
  const covered = new Set(); const reports = [];
  for (const entry of runs) {
    const report = readJson(head, `${UI_GEOMETRY_RUNS}/${entry.run}/geometry.json`, cwd);
    if (report === null || (entry.ok === false)) continue;
    for (const row of Object.keys(report.rows ?? {})) covered.add(row);
    const measured = measuredInputs(report, head, cwd);
    // A named run without declared values (no measured inputs) cannot be compared: it counts as changed (fails closed).
    reports.push({ run: entry.run, declared: measured.declared ?? null });
  }
  for (const { run, declared: given } of reports) {
    if (given === null) {
      const all = sharedRows.map(([row]) => row).filter(row => !covered.has(row));
      if (all.length > 0) reasons.push(`run ${run}: no declared inputs to compare with the shared result's (run ${shared.run ?? '?'}; it has no measured inputs): every row it did not measure is stale — a full audit`);
      continue;
    }
    const declared = given;
    const sets = Object.keys(declared.states ?? {}).filter(set => typeof sharedDeclared.states?.[set] === 'string' && sharedDeclared.states[set] !== declared.states[set]);
    if (sets.length > 0) {
      const stale = sharedRows.filter(([row, entry]) => sets.includes(entry?.scene) && !covered.has(row)).map(([row]) => row);
      if (stale.length > 0) reasons.push(`run ${run}: the state folder(s) ${sets.join(', ')} changed since the shared result (run ${shared.run ?? '?'}) — ${stale.length} row(s) it measured on them are not measured again: ${stale.slice(0, 6).join(', ')}${stale.length > 6 ? ' …' : ''} — audit them (or a full audit)`);
    }
    // Every other declared input, compared as recorded: a value on one side only counts as a change (fails closed).
    const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
    const tools = [['chromium', 'chromium'], ['playwright', 'playwright'], ['lock', 'the lock file'], ['system', 'the system identity files'], ['node', 'node'],
      ['nodeModules', 'the node_modules install'], ['viteDeps', 'Vite\'s dependency cache']].filter(([key]) => !same(declared[key], sharedDeclared[key])).map(([, name]) => name);
    const all = sharedRows.map(([row]) => row).filter(row => !covered.has(row));
    if (tools.length > 0 && all.length > 0) reasons.push(`run ${run}: ${tools.join(', ')} changed since the shared result (run ${shared.run ?? '?'}): every row is stale — a full audit`);
  }
  return reasons;
}

export function checkUiGeometryMeasured({ base = null, head, cwd = process.cwd(), mode = gateMode(), env = process.env }) {
  try { execFileSync('git', ['cat-file', '-e', `${head}:scripts/uiGeometryAudit.mjs`], { cwd, stdio: 'ignore' }); } catch { return { skipped: true, mode, ok: true, pass: true, reasons: [] }; }
  const cache = new Map();
  const summary = readJson(head, UI_GEOMETRY_SUMMARY, cwd);
  // RR26 measured: the shared full audit's measured inputs judge what moves the screen; without them, the safe list.
  const sharedMeasured = summary !== null && summary.full === true ? measuredInputs(summary, head, cwd) : null;
  // A range that changes only safe files, or nothing the audit read, cannot move the screen: only the lists' shrink
  // rules apply. The measured set describes what was read at the shared result's commit C; a file that became read
  // after C (a new import, accepted through a changed-rows run) is not in it. So the measured judgement of the range
  // holds only while the shared result is still fresh at <base> (nothing it read changed in C..base); else the safe list.
  const sharedCommit = /^[0-9a-f]{40}$/.test(String(summary?.commit ?? '')) ? summary.commit : '';
  const freshAtBase = base !== null && sharedMeasured?.status === 'ok' && sharedCommit !== '' && measuredAt(sharedCommit, base, cwd) === 'ok'
    && staleChanges(sharedCommit, base, cwd, cache, sharedMeasured).unsafe.length === 0;
  const rangeChanges = base === null ? null : staleChanges(base, head, cwd, cache, freshAtBase ? sharedMeasured
    : sharedMeasured?.status === 'ok' ? { status: 'stale', why: `the shared result's measured inputs are of ${sharedCommit.slice(0, 8)}, and what it read changed before ${base.slice(0, 8)}` } : sharedMeasured);
  const unchanged = rangeChanges !== null && rangeChanges.unsafe.length === 0;
  const baselineFile = readJson(head, UI_GEOMETRY_BASELINE, cwd);
  const exceptions = readJson(head, UI_GEOMETRY_EXCEPTIONS, cwd)?.exceptions ?? [];
  const reasons = [];
  let comparison = null;
  const sharedFull = summary !== null && summary.full === true;
  if (!unchanged && summary === null) reasons.push(`no ${UI_GEOMETRY_SUMMARY} at ${head.slice(0, 8)}`);
  else if (!unchanged && !sharedFull) reasons.push(`the shared result (run ${summary.run ?? '?'}, ${summary.rows ?? '?'} row(s)) is not a full audit: a changed-rows run counts only through its own report and a UI-Geometry-Run trailer (RR26)`);
  let sharedStale = false;
  if (!unchanged && sharedFull) {
    const commit = /^[0-9a-f]{40}$/.test(String(summary.commit ?? '')) ? summary.commit : '';
    const at = commit === '' ? 'missing' : measuredAt(commit, head, cwd);
    if (at !== 'ok') { sharedStale = true; reasons.push(`the shared result (run ${summary.run ?? '?'}): its measured commit ${commit.slice(0, 8) || '(none)'} is ${at === 'missing' ? 'not here' : 'not in the pushed history'}: refresh it — npm run remote:ui-geometry`); }
    else {
      const changes = staleChanges(commit, head, cwd, cache, sharedMeasured);
      if (changes.unsafe.length > 0) { sharedStale = true; reasons.push(`${unsafeLine(`the shared result (run ${summary.run ?? '?'})`, commit, changes)}: refresh it — npm run remote:ui-geometry, commit docs/verification/uiaudit1/geometry.json (and npm run ui-geometry:baseline if something was fixed)`, ...safeListNote(changes)); }
    }
  }
  if (!unchanged && sharedFull) {
    if (summary.dirty !== false) reasons.push(summary.dirty === true ? 'the result was measured from a tree with uncommitted changes' : 'the result does not say whether the tree was clean');
    if (typeof summary.unopened !== 'number') reasons.push('the result does not count the surface conditions not opened');
    else if (summary.unopened !== 0) reasons.push(`${summary.unopened} surface condition(s) could not be opened`);
    if (typeof summary.unregisteredFramed !== 'number') reasons.push('the result does not count the framed roots no registry row measures');
    else if (summary.unregisteredFramed !== 0) reasons.push(`${summary.unregisteredFramed} framed root(s) (data-frame) on screen that no registry row measures`);
    if (!Array.isArray(summary.failureKeys)) reasons.push('the result has no failure keys (an audit from before the baseline): run the audit again');
    else {
      if (baselineFile === null) reasons.push(`no ${UI_GEOMETRY_BASELINE}: npm run ui-geometry:baseline -- --reason "…"`);
      comparison = compareBaseline({ keys: summary.failureKeys, baseline: baselineFile?.entries ?? [], exceptions });
      if (comparison.added.length > 0) reasons.push(`${comparison.added.length} new failure(s), in no baseline entry or exception:`, ...sample(comparison.added));
      if (comparison.fixed.length > 0) reasons.push(`${comparison.fixed.length} fixed, drop them from the baseline (npm run ui-geometry:baseline):`, ...sample(comparison.fixed));
      if (comparison.staleExceptions.length > 0) reasons.push(`${comparison.staleExceptions.length} exception(s) match no failure, drop them:`, ...sample(comparison.staleExceptions));
    }
  }
  // RR26: a stale or missing shared result (not a current one with its own failures) gives way to the changed-rows runs
  // the range names, when every one holds.
  let rowRuns = null;
  if (!unchanged && reasons.length > 0 && (!sharedFull || sharedStale)) {
    const runs = rowRunsInRange(base, head, cwd);
    if (runs.length > 0) {
      // Newest first: a run whose rows a newer named run measured again is superseded (the remedy for a stale run is a
      // new one, so the old trailer must not keep refusing).
      const covered = new Set(); rowRuns = [];
      for (const run of runs) {
        const entry = checkRowRunMeasured({ run, head, baseline: baselineFile?.entries ?? [], exceptions, cwd, cache });
        const rows = entry.rows ?? [];
        if (rows.length > 0 && rows.every(row => covered.has(row))) { rowRuns.push({ ...entry, ok: true, superseded: true, reasons: [] }); continue; }
        // A named run with no report or no measured row counts for nothing; a newer valid named run supersedes it.
        if (rows.length === 0 && rowRuns.some(newer => newer.ok && !newer.superseded)) { rowRuns.push({ ...entry, rows: [], ok: true, superseded: true, reasons: [] }); continue; }
        for (const row of rows) covered.add(row);
        rowRuns.push(entry);
      }
      reasons.length = 0; comparison = null;
      for (const entry of rowRuns) reasons.push(...entry.reasons);
    }
  }
  // RR26 measured: the declared inputs (the scene state folders, the browser, Vite's dependency cache) are bound by value.
  // A named run whose state folder differs from the shared result's leaves the shared result's rows on that set stale
  // unless the named runs measured them again; a different browser or dependency cache leaves every row stale.
  if (sharedMeasured?.declared) {
    const runs = rowRuns ?? rowRunsInRange(base, head, cwd).map(run => ({ run }));
    const sharedReport = typeof summary.report === 'string' ? readJson(head, summary.report, cwd) : null;
    const sharedRows = Object.entries(sharedReport?.rows ?? {});
    for (const reason of declaredReasons({ shared: summary, sharedDeclared: sharedMeasured.declared, sharedRows, runs, head, cwd })) reasons.push(reason);
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
  return { skipped: false, mode, ok, pass, reasons: override?.refused === undefined ? reasons : [...reasons, `override refused: ${override.refused}`], summary, comparison, unchanged, rangeChanges, override, rowRuns,
    measured: sharedMeasured === null ? null : { status: sharedMeasured.status, why: sharedMeasured.why ?? null } };
}

export function formatMeasuredResult(result) {
  if (result.skipped) return 'ui-geometry (a′): skipped (no geometry audit at this commit)';
  const tag = result.override?.reason !== undefined ? ` (overridden: ${result.override.reason})` : result.mode === 'warn' && result.pass ? ' (report only: UI_GEOMETRY_GATE = warn)' : '';
  const counts = result.comparison === null || result.comparison === undefined ? ''
    : ` — ${result.comparison.failures} failure(s): ${result.comparison.baseline} in the baseline, ${result.comparison.excepted} under ${result.comparison.exceptions} exception(s)`;
  if (result.ok && result.unchanged) return [result.rangeChanges.how === 'measured'
    ? `ui-geometry (a′): nothing the audit read changed (${result.rangeChanges.changed} file(s), measured inputs of the shared result): no audit needed (RR26 measured)${tag}`
    : `ui-geometry (a′): only files on the safe list changed (${result.rangeChanges.changed}): no audit needed (RR26)${tag}`].join('\n');
  if (result.ok && result.rowRuns) return [`ui-geometry (a′): changed rows accepted (decision RR26)${tag}`, ...result.rowRuns.map(entry => entry.superseded
    ? `  run ${entry.run}: superseded — ${entry.rows.length > 0 ? `a newer named run measured its rows (${entry.rows.join(', ')}) again` : 'it has no report or no measured row, and a newer named run holds'}`
    : `  run ${entry.run} (commit ${entry.commit.slice(0, 8)}): ${entry.rows.length} row(s), ${entry.cells} cell(s), no new failure; ${entry.moved} file(s) changed since it was measured, ${entry.how === 'measured' ? 'none the audit read (measured inputs)' : 'all on the safe list'} — ${entry.rows.slice(0, 4).join(', ')}${entry.rows.length > 4 ? ' …' : ''}`)].join('\n');
  if (result.ok) return [`ui-geometry (a′): run ${result.summary.run}, no new failure${counts}${tag}`].join('\n');
  const lines = [`ui-geometry (a′): ${result.pass ? 'not green' : 'FAILED'}${counts}${tag}`];
  for (const reason of result.reasons) lines.push(reason.startsWith('    ') ? reason : `  ${reason}`);
  return lines.join('\n');
}

/**
 * a′'s view of base..head, against the shared result at <base> (the one the push found): { status: 'ok', changed, files:
 * the changed files it read, shared } — or 'none' / 'broken' / 'untraceable' (no usable measured inputs) or 'stale'
 * (what it read changed before <base>, so its measured set may miss a newer import): a′ then falls back to the safe list.
 */
export function measuredRange({ base, head, cwd = process.cwd() }) {
  if (base === null) return { status: 'none', why: 'no base: the range is not known', shared: null };
  const summary = readJson(base, UI_GEOMETRY_SUMMARY, cwd);
  if (summary === null || summary.full !== true) return { status: 'none', why: 'no full shared result at the base', shared: null };
  const measured = measuredInputs(summary, base, cwd);
  const shared = { run: summary.run ?? null, commit: summary.commit ?? null, declared: measured.declared ?? null };
  if (measured.status !== 'ok') return { status: measured.status, why: measured.why, shared };
  const commit = /^[0-9a-f]{40}$/.test(String(summary.commit ?? '')) ? summary.commit : '';
  if (commit === '' || measuredAt(commit, base, cwd) !== 'ok') return { status: 'stale', why: 'the shared result\'s measured commit is not in the base\'s history', shared };
  const cache = new Map();
  const before = staleChanges(commit, base, cwd, cache, measured);
  if (before.unsafe.length > 0) return { status: 'stale', why: `what the shared result read changed before the base: ${before.unsafe.slice(0, 3).join(', ')}${before.unsafe.length > 3 ? ' …' : ''}`, shared };
  const changes = staleChanges(base, head, cwd, cache, measured);
  return { status: 'ok', changed: changes.changed, files: changes.unsafe, shared };
}

/**
 * What differs between the shared result's declared inputs and the DGX's values now (the fingerprint): a state set the
 * audit read, Chromium, Playwright, node, a system identity file, the node_modules install. A value the fingerprint
 * could not read counts as changed. Vite's dependency cache is not compared (made per run from the lock file and the
 * config, which git holds, and node_modules, compared here).
 */
export function environmentReasons(declared, fingerprint) {
  const reasons = [];
  for (const [set, hash] of Object.entries(declared?.states ?? {})) if (fingerprint.states?.[set] !== hash) reasons.push(`the state folder ${set} ${fingerprint.states?.[set] ? 'changed' : 'is not on the DGX'}`);
  for (const [key, name] of [['chromium', 'Chromium'], ['playwright', 'Playwright'], ['node', 'node']]) {
    if (declared?.[key] !== null && declared?.[key] !== undefined && declared[key] !== fingerprint[key]) reasons.push(`${name} ${declared[key]} → ${fingerprint[key] ?? 'unknown'}`);
  }
  for (const [path, hash] of Object.entries(declared?.system ?? {})) if (fingerprint.system?.[path] !== hash) reasons.push(`the system file ${path} changed`);
  const installed = declared?.nodeModules;
  if (installed?.inode && (fingerprint.nodeModules?.key !== installed.key || fingerprint.nodeModules?.inode !== installed.inode)) reasons.push(`node_modules installed again (${installed.key})`);
  return reasons;
}

/** The verdict words of the shadow line (user ruling 2026-10-10: "RR26: 감사 필요 / a′: 불필요"). */
export const SHADOW_WORDS = Object.freeze({ needed: '감사 필요', 'not needed': '불필요', fallback: '안전 목록 대체', undecidable: '판정 불가' });

/**
 * The two verdicts for base..head. rr26: 'needed' | 'not needed' (the gate's own: a file off the safe list changed).
 * aprime: 'needed' (a file it read changed, or the environment) | 'not needed' | 'fallback' (no usable measured inputs:
 * a′ would judge by the safe list, as RR26) | 'undecidable' (no fingerprint: 판정 불가, kept out of the evidence).
 * direction: 'saved' (an audit a′ would have skipped) | 'aprime-only' (a′ alone wants one) | null.
 */
export function shadowJudgement({ gate, range, fingerprint }) {
  const rr26 = gate.skipped || gate.unchanged ? 'not needed' : 'needed';
  const environment = range.status === 'ok' && fingerprint !== null ? environmentReasons(range.shared?.declared, fingerprint) : null;
  let aprime; let why;
  if (range.status !== 'ok') { aprime = 'fallback'; why = range.why; }
  else if (fingerprint === null) { aprime = 'undecidable'; why = `no fingerprint of the DGX${range.files.length > 0 ? ` (by the files alone: ${range.files.length} it read changed)` : ''}`; }
  else if (range.files.length > 0) { aprime = 'needed'; why = `${range.files.length} file(s) the audit read changed: ${range.files.slice(0, 4).join(', ')}${range.files.length > 4 ? ' …' : ''}`; }
  else if (environment.length > 0) { aprime = 'needed'; why = `the environment: ${environment.slice(0, 4).join('; ')}`; }
  else { aprime = 'not needed'; why = `nothing the audit read changed (${range.changed} file(s); measured inputs of ${range.shared?.run ?? '?'}), the environment the same`; }
  const direction = rr26 === 'needed' && aprime === 'not needed' ? 'saved' : rr26 === 'not needed' && aprime === 'needed' ? 'aprime-only' : null;
  return { rr26, aprime, why, direction, environment, files: range.status === 'ok' ? range.files : null, changed: range.changed ?? null };
}

/** The shadow's lines under the gate's. */
export function formatShadow(judgement) {
  const lines = [`ui-geometry shadow (recorded only, the gate judged by RR26): RR26: ${SHADOW_WORDS[judgement.rr26]} / a′: ${SHADOW_WORDS[judgement.aprime]} — ${judgement.why}`];
  if (judgement.direction === 'saved') lines.push('  disagreement: an audit a′ would have skipped (checked for a false pass in docs/verification/uiaudit1/SHADOW.md)');
  if (judgement.direction === 'aprime-only') lines.push('  disagreement: a′ alone wants an audit (a gap of RR26?) — tell the REMOTE session');
  return lines.join('\n');
}

/** The DGX host (scripts/remote/run.sh's default). */
const HOST = env => env.FLS_REMOTE_HOST ?? 'hyunlord@100.70.109.50';

/** Read the fingerprint on the DGX and write the record there, in one ssh call capped at 5 s: { fingerprint, name } or { error }. */
export function remoteShadow({ record, nodeModulesKey, env = process.env, cwd = process.cwd() }) {
  if (env.FLS_SHADOW_REMOTE === 'off') return { error: 'FLS_SHADOW_REMOTE=off' };
  let source; try { source = readFileSync(join(cwd, 'scripts/uiGeometryFingerprint.mjs'), 'utf8'); } catch { return { error: 'no scripts/uiGeometryFingerprint.mjs' }; }
  const script = `${source}\nconst shadow = ${JSON.stringify({ record, nodeModulesKey })};\nconst fingerprint = environmentFingerprint({ nodeModulesKey: shadow.nodeModulesKey });\n`
    + 'const name = writeShadowRecord({ ...shadow.record, fingerprint });\nprocess.stdout.write(JSON.stringify({ fingerprint, name }));\n';
  const result = spawnSync('ssh', ['-o', 'ConnectTimeout=3', '-o', 'BatchMode=yes', HOST(env), '$HOME/fls-runs/_tools/node/bin/node --input-type=module -'],
    { input: script, encoding: 'utf8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] });
  if (result.error) return { error: result.error.code === 'ETIMEDOUT' ? 'the DGX did not answer in 5 s' : result.error.message };
  if (result.status !== 0) return { error: `ssh exit ${result.status}: ${String(result.stderr).trim().split('\n').pop() ?? ''}` };
  try { const out = JSON.parse(result.stdout); return { fingerprint: out.fingerprint, name: out.name }; } catch { return { error: 'the DGX answered no fingerprint' }; }
}

/** The session a record names: FLS_SESSION, else the branch, else the folder. */
const sessionName = (cwd, env) => {
  let name = env.FLS_SESSION ?? '';
  if (name === '') { try { name = git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd).trim(); } catch { /* none */ } }
  if (name === '' || name === 'HEAD') name = cwd.split('/').pop() ?? 'unknown';
  return name.replace(/[^A-Za-z0-9_.-]/g, '_');
};

/**
 * check:merge's shadow: judge, fetch the fingerprint and write the DGX record (one ssh call), keep the record in
 * .remote-runs/_shadow/ and return the lines. Never throws: the gate's verdict is RR26's whatever happens here.
 */
export function shadowStep({ base, head, gate, cwd = process.cwd(), env = process.env, now = new Date(), remote = remoteShadow }) {
  try {
    const range = measuredRange({ base, head, cwd });
    const record = { schema: 1, kind: 'ui-geometry-shadow', time: now.toISOString(), session: sessionName(cwd, env), base, head,
      rr26: { needed: !(gate.skipped || gate.unchanged), changed: gate.rangeChanges?.changed ?? null, unsafe: gate.rangeChanges?.unsafe?.slice(0, 20) ?? null },
      measured: { status: range.status, why: range.why ?? null, changed: range.changed ?? null, files: range.files ?? null }, shared: range.shared };
    const got = remote({ record, nodeModulesKey: range.shared?.declared?.nodeModules?.key ?? null, env, cwd });
    const fingerprint = got.fingerprint ?? null;
    const judgement = shadowJudgement({ gate, range, fingerprint });
    const full = { ...record, fingerprint, fingerprintError: got.error ?? null, dgxRecord: got.name ?? null, judgement };
    try {
      const dir = join(cwd, '.remote-runs/_shadow'); mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, `${head.slice(0, 12)}-${record.time.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}-${record.session}.json`), `${JSON.stringify(full)}\n`);
    } catch { /* the DGX record stands */ }
    const text = formatShadow(judgement);
    return { judgement, record: full, text: got.error ? `${text}\n  (no fingerprint: ${got.error})` : text };
  } catch (error) {
    return { judgement: null, record: null, text: `ui-geometry shadow: not recorded (${error instanceof Error ? error.message : String(error)}) — the gate judged by RR26 as always` };
  }
}
