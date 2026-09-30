// UI-AUDIT-1: the geometry audit's gate (check:merge), on a baseline. The DGX audit (npm run remote:ui-geometry,
// scripts/uiGeometryAudit.mjs) writes docs/verification/uiaudit1/geometry.json: the hash of its inputs at the commit it
// measured (the trees of src and public/assets, the audit's scripts, vite.config.ts) and every failure's key
// (row | viewport/copy/numbers | check | element path — stable across runs, no px). A result file cannot carry its own
// commit's sha, so the step keys on those inputs; a commit that changes none of them (docs, tests) keeps the result.
// The step fails when, at <head>:
//  - the result is missing, of other inputs, or measured from a tree with uncommitted changes;
//  - a surface condition could not be opened, or a framed root (data-frame) on screen is in no registry row;
//  - a failure is neither in the baseline (docs/verification/uiaudit1/geometry-baseline.json) nor matched by an
//    exception (docs/verification/uiaudit1/geometry-exceptions.json: row + check + element path fragment + reason);
//  - a baseline entry no longer fails ("N fixed, drop them": npm run ui-geometry:baseline), or an exception matches
//    nothing — both lists only shrink;
//  - base..head adds baseline entries without a recorded reason (the baseline script's --reason), or adds exceptions.
// The thresholds are the audit's (8 px gap, 40 % empty warning, 0.5–1 px tolerance); an exemption is an exception entry,
// never a looser check. Mode: UI_GEOMETRY_GATE ('enforce' fails check:merge, 'warn' only reports);
// FLS_UI_GEOMETRY_GATE=enforce|warn overrides it for one run.
//   node scripts/checks/uiGeometry.mjs [--base <rev>] [--head <rev>]
import { createHash } from 'node:crypto';
import { git, isMain, resolveRange } from './gitRange.mjs';

export const UI_GEOMETRY_SUMMARY = 'docs/verification/uiaudit1/geometry.json';
export const UI_GEOMETRY_BASELINE = 'docs/verification/uiaudit1/geometry-baseline.json';
export const UI_GEOMETRY_EXCEPTIONS = 'docs/verification/uiaudit1/geometry-exceptions.json';
export const UI_GEOMETRY_INPUTS = Object.freeze({ src: 'src', assets: 'public/assets', audit: 'scripts/uiGeometryAudit.mjs', measure: 'scripts/uiGeometryMeasure.ts',
  scene: 'scripts/uiGeometryScene.ts', vite: 'vite.config.ts' });
// UI-AUDIT-1 (the user's decision): enforcing on the baseline — no new failure, the baseline and the exceptions only
// shrink.
export const UI_GEOMETRY_GATE = 'enforce';

/** The inputs' object ids at `rev` (null for one that does not exist there). */
export function geometryInputs(rev, cwd = process.cwd()) {
  const ids = {};
  for (const [key, path] of Object.entries(UI_GEOMETRY_INPUTS)) {
    try { ids[key] = git(['rev-parse', '--verify', '--quiet', `${rev}:${path}`], cwd).trim() || null; } catch { ids[key] = null; }
  }
  return ids;
}

export function geometryInputHash(inputs) {
  const keys = Object.keys(UI_GEOMETRY_INPUTS);
  return createHash('sha256').update(keys.map(key => `${key}=${inputs[key] ?? ''}`).join('\n')).digest('hex');
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

const readJson = (rev, path, cwd) => { try { return JSON.parse(git(['show', `${rev}:${path}`], cwd)); } catch { return null; } };
const sample = list => list.slice(0, 5).map(item => `    ${typeof item === 'string' ? item : exceptionId(item)}`);

export function checkUiGeometry({ base = null, head, cwd = process.cwd(), mode = gateMode() }) {
  const inputs = geometryInputs(head, cwd);
  if (inputs.audit === null) return { skipped: true, mode, ok: true, pass: true, reasons: [] };
  const hash = geometryInputHash(inputs);
  const summary = readJson(head, UI_GEOMETRY_SUMMARY, cwd);
  const baselineFile = readJson(head, UI_GEOMETRY_BASELINE, cwd);
  const exceptions = readJson(head, UI_GEOMETRY_EXCEPTIONS, cwd)?.exceptions ?? [];
  const reasons = [];
  let comparison = null;
  if (summary === null) reasons.push(`no ${UI_GEOMETRY_SUMMARY} at ${head.slice(0, 8)}`);
  else {
    if (summary.inputHash !== hash) reasons.push(`the result is of other inputs (measured at ${String(summary.commit ?? '?').slice(0, 8)}; src, public/assets, vite.config.ts or the audit changed since): run npm run remote:ui-geometry and commit its geometry.json`);
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
  return { skipped: false, mode, ok, pass: ok || mode === 'warn', reasons, summary, hash, comparison };
}

export function formatUiGeometryResult(result) {
  if (result.skipped) return 'ui-geometry: skipped (no geometry audit at this commit)';
  const tag = result.mode === 'warn' ? ' (report only: UI_GEOMETRY_GATE = warn)' : '';
  const counts = result.comparison === null || result.comparison === undefined ? ''
    : ` — ${result.comparison.failures} failure(s): ${result.comparison.baseline} in the baseline, ${result.comparison.excepted} under ${result.comparison.exceptions} exception(s)`;
  if (result.ok) return `ui-geometry: run ${result.summary.run}, no new failure${counts}${tag}`;
  const lines = [`ui-geometry: ${result.mode === 'warn' ? 'not green' : 'FAILED'}${counts}${tag}`];
  for (const reason of result.reasons) lines.push(reason.startsWith('    ') ? reason : `  ${reason}`);
  return lines.join('\n');
}

if (isMain(import.meta.url)) {
  const { base, head } = resolveRange();
  const result = checkUiGeometry({ base, head });
  console.log(formatUiGeometryResult(result));
  process.exitCode = result.pass ? 0 : 1;
}
