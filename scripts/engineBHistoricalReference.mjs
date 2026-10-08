import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { isDeepStrictEqual } from 'node:util';
import { HISTORICAL_REFERENCE } from './engineBHistoricalProjection.mjs';

export const HISTORICAL_BUNDLE_PINS = Object.freeze({
  run: HISTORICAL_REFERENCE,
  report: Object.freeze({ gzipSha256: 'e77fbda5dabda2c39118c16538c85c2c69b8fefb5dca19c9f4cd78f4ed87a114', jsonSha256: '89baff649b0f7c7f6805159183bb530290c5efba92d29b819d6e45b08e076a84' }),
  context: Object.freeze({ gzipSha256: '89bbbf0d0324e6146700a3d4536fe8932266a8e964410e8ae39b9ba95996e859', jsonSha256: '14ade8f46c5ef2c613e46cbbb44200216a18efa7767b270deb204934499b52a6' }),
});
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const check = (condition, message) => { if (!condition) throw new Error(`Historical reference: ${message}`); };
function uniqueIds(ids, label) {
  check(Array.isArray(ids) && ids.every(id => typeof id === 'string' && /^ck_evt_\d{3}$/.test(id))
    && new Set(ids).size === ids.length, `${label} must contain unique entry IDs`);
  return [...ids].sort();
}
const same = (actual, expected, label) => check(isDeepStrictEqual(actual, expected), `${label} mismatch`);

// Validates the original reference only; source identity is not replay-source verification.
export function validateHistoricalReference(bundle) {
  check(bundle !== null && typeof bundle === 'object'
    && isDeepStrictEqual(Object.keys(bundle).sort(), ['contextGzip', 'reportGzip', 'runGzip']), 'exact three gzip inputs required');
  const parsed = {}, hashes = {};
  for (const [name, pin] of Object.entries(HISTORICAL_BUNDLE_PINS)) {
    const bytes = bundle[`${name}Gzip`];
    check(bytes instanceof Uint8Array, `${name} gzip bytes required`);
    const gzipSha256 = sha(bytes);
    check(gzipSha256 === pin.gzipSha256, `${name} gzip SHA mismatch`);
    const raw = gunzipSync(bytes), jsonSha256 = sha(raw);
    check(jsonSha256 === pin.jsonSha256, `${name} JSON SHA mismatch`);
    parsed[name] = JSON.parse(raw.toString('utf8'));
    hashes[name] = { gzipSha256, jsonSha256 };
  }
  const { run, report, context } = parsed;
  const sourceRevision = HISTORICAL_REFERENCE.sourceRevision;
  check(context.sourceRevision === sourceRevision && report.provenance.sourceRevision === sourceRevision, 'reference source identity mismatch');
  check(report.provenance.inputSha256 === hashes.run.jsonSha256 && report.provenance.contextSha256 === hashes.context.jsonSha256, 'report provenance relationship mismatch');
  same([run.seed, run.years, run.startYear, run.endYearExclusive], [1, 125, 1300, 1425], 'run identity/range');
  same(context.legacyRange, { startYear: run.startYear, endYearExclusive: run.endYearExclusive }, 'context range');
  same(report.summary.range, { startYear: run.startYear, endYearExclusive: run.endYearExclusive, source: 'run' }, 'report range');
  const enabledEntryIds = uniqueIds(context.enabledEntryIds, 'enabled');
  const catalogIds = uniqueIds(context.catalog.map(row => row.id), 'catalog');
  check(enabledEntryIds.length === 56 && enabledEntryIds.every(id => catalogIds.includes(id)), 'enabled/catalog relationship mismatch');
  check(run.occurrences.length === 85 && run.registryOffers === run.occurrences.length
    && new Set(run.occurrences.map(row => row.id)).size === run.occurrences.length, 'occurrence count/identity mismatch');
  check(run.occurrences.every(row => Number.isInteger(row.year) && row.year >= run.startYear && row.year < run.endYearExclusive), 'occurrence outside original range');
  const observedEntryIds = uniqueIds([...new Set(run.occurrences.map(row => row.entry))], 'observed');
  check(observedEntryIds.length === 16 && observedEntryIds.every(id => enabledEntryIds.includes(id)), 'observed/enabled relationship mismatch');
  const absentEntryIds = enabledEntryIds.filter(id => !observedEntryIds.includes(id));
  check(absentEntryIds.length === 40, 'absent count mismatch');
  const support = report.summary.support;
  check(support.enabledCount === enabledEntryIds.length, 'report enabled count mismatch');
  same(uniqueIds(support.observedEnabled, 'report observed'), observedEntryIds, 'report observed set');
  same(uniqueIds(support.enabledNotObserved, 'report absent'), absentEntryIds, 'report absent set');
  same(support.observedNotEnabled, [], 'report unsupported set');
  same(uniqueIds(report.summary.inRange.distinctEntryIds, 'report in-range'), observedEntryIds, 'report in-range set');
  check(report.summary.inRange.total === run.occurrences.length && report.summary.boundary.before.total === 0
    && report.summary.boundary.after.total === 0, 'report occurrence/boundary counts mismatch');
  same(report.summary.inRange.unknownEntryIds, [], 'report unknown set');
  return { referenceVerified: true, sourceRevision, seed: run.seed, years: run.years,
    startYear: run.startYear, endYearExclusive: run.endYearExclusive, enabledEntryIds, observedEntryIds, absentEntryIds, hashes,
    applicabilityAllowed: false, fullStateComparable: false, originalRuntimeVerified: false };
}
