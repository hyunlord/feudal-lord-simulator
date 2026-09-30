// UI-AUDIT-1: the geometry audit's summary step (check:merge). The DGX audit (npm run remote:ui-geometry, scripts/
// uiGeometryAudit.mjs) writes docs/verification/uiaudit1/geometry.json with the hash of its inputs at the commit it
// measured: the tree of src (the registry is in it), the tree of public/assets, the audit script's, the measure's and
// the scene helpers' blobs. A result file cannot carry its own commit's sha, so the step keys on those inputs instead:
// it passes when the file at <head> carries <head>'s input hash, was measured from a clean tree, and has 0 failures
// and 0 surface conditions that could not be opened. A commit that changes none of the inputs (docs, tests) keeps the
// result valid.
//   node scripts/checks/uiGeometry.mjs [--head <rev>]
// Mode: UI_GEOMETRY_GATE below ('warn': the step reports and never fails check:merge; 'enforce': it fails). The
// environment variable FLS_UI_GEOMETRY_GATE=enforce|warn overrides it for one run.
import { createHash } from 'node:crypto';
import { git, isMain } from './gitRange.mjs';

export const UI_GEOMETRY_SUMMARY = 'docs/verification/uiaudit1/geometry.json';
export const UI_GEOMETRY_INPUTS = Object.freeze({ src: 'src', assets: 'public/assets', audit: 'scripts/uiGeometryAudit.mjs', measure: 'scripts/uiGeometryMeasure.ts',
  scene: 'scripts/uiGeometryScene.ts' });
// UI-AUDIT-1: report-only until the fix groups land and a DGX run of their merge is 0 failures; the lead flips this to
// 'enforce' in the same commit that adds that run's geometry.json.
export const UI_GEOMETRY_GATE = 'warn';

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

export function checkUiGeometry({ head, cwd = process.cwd(), mode = gateMode() }) {
  const inputs = geometryInputs(head, cwd);
  if (inputs.audit === null) return { skipped: true, mode, ok: true, pass: true, reasons: [] };
  const hash = geometryInputHash(inputs);
  let summary = null;
  try { summary = JSON.parse(git(['show', `${head}:${UI_GEOMETRY_SUMMARY}`], cwd)); } catch { summary = null; }
  const reasons = [];
  if (summary === null) reasons.push(`no ${UI_GEOMETRY_SUMMARY} at ${head.slice(0, 8)}`);
  else {
    if (summary.inputHash !== hash) reasons.push(`the result is of other inputs (measured at ${String(summary.commit ?? '?').slice(0, 8)}; src, public/assets or the audit changed since): run npm run remote:ui-geometry`);
    if (summary.dirty) reasons.push('the result was measured from a tree with uncommitted changes');
    if (summary.failures !== 0) reasons.push(`${summary.failures} failure(s)`);
    if (summary.unopened !== 0) reasons.push(`${summary.unopened} surface condition(s) could not be opened`);
  }
  const ok = reasons.length === 0;
  return { skipped: false, mode, ok, pass: ok || mode === 'warn', reasons, summary, hash };
}

export function formatUiGeometryResult(result) {
  if (result.skipped) return 'ui-geometry: skipped (no geometry audit at this commit)';
  const tag = result.mode === 'warn' ? ' (report only: UI_GEOMETRY_GATE = warn)' : '';
  if (result.ok) return `ui-geometry: ${result.summary.measured} surface condition(s), 0 failures, run ${result.summary.run}${tag}`;
  const lines = [`ui-geometry: ${result.mode === 'warn' ? 'not green' : 'FAILED'}${tag}`];
  for (const reason of result.reasons) lines.push(`  ${reason}`);
  if (result.summary?.byCheck) lines.push(`  by check: ${Object.entries(result.summary.byCheck).map(([check, count]) => `${check} ${count}`).join(', ')}`);
  return lines.join('\n');
}

if (isMain(import.meta.url)) {
  const index = process.argv.indexOf('--head');
  const head = git(['rev-parse', '--verify', `${index > 0 ? process.argv[index + 1] : 'HEAD'}^{commit}`]).trim();
  const result = checkUiGeometry({ head });
  console.log(formatUiGeometryResult(result));
  process.exitCode = result.pass ? 0 : 1;
}
