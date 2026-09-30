// UI-AUDIT-1: writes the geometry gate's baseline (docs/verification/uiaudit1/geometry-baseline.json) from the committed
// audit result (docs/verification/uiaudit1/geometry.json): every failure key the run found that no exception covers.
// It drops what no longer fails, and refuses to add a key unless --reason names why (the reason is recorded, and
// check:merge accepts a grown baseline only with one more recorded reason).
//   npm run ui-geometry:baseline [-- --reason "why the baseline grows"]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { compareBaseline, UI_GEOMETRY_BASELINE, UI_GEOMETRY_EXCEPTIONS, UI_GEOMETRY_SUMMARY } from './checks/uiGeometry.mjs';

const flag = name => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const read = path => existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
const summary = read(UI_GEOMETRY_SUMMARY);
if (summary === null || !Array.isArray(summary.failureKeys)) { console.error(`${UI_GEOMETRY_SUMMARY} has no failure keys: run npm run remote:ui-geometry first`); process.exit(2); }
const before = read(UI_GEOMETRY_BASELINE) ?? { entries: [], reasons: [] };
const exceptions = read(UI_GEOMETRY_EXCEPTIONS)?.exceptions ?? [];
const comparison = compareBaseline({ keys: summary.failureKeys, baseline: before.entries, exceptions });
const reason = flag('reason');
if (comparison.added.length > 0 && (reason === undefined || reason.trim() === '')) {
  console.error(`refused: ${comparison.added.length} failure(s) are not in the baseline. Fix them, or name why the baseline grows: --reason "…"`);
  for (const key of comparison.added.slice(0, 20)) console.error(`  ${key}`);
  process.exit(1);
}
const entries = comparison.counted;
const reasons = [...(before.reasons ?? []), ...(comparison.added.length > 0 ? [{ run: summary.run, commit: summary.commit, added: comparison.added.length, reason }] : [])];
writeFileSync(UI_GEOMETRY_BASELINE, `${JSON.stringify({ schema: 1, run: summary.run, commit: summary.commit, count: entries.length, reasons, entries }, null, 1)}\n`);
console.log(`baseline: ${entries.length} entr(ies) (was ${before.entries.length}; ${comparison.fixed.length} fixed and dropped, ${comparison.added.length} added), ${exceptions.length} exception(s) covering ${comparison.excepted}`);
if (comparison.staleExceptions.length > 0) console.log(`  ${comparison.staleExceptions.length} exception(s) match no failure: drop them from ${UI_GEOMETRY_EXCEPTIONS}`);
