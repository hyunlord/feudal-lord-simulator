import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';
import test from 'node:test';
import { validateHistoricalReference } from '../scripts/engineBHistoricalReference.mjs';
const names = { runGzip: 'run-1', reportGzip: 'report-1', contextGzip: 'context' };
const bundle = Object.fromEntries(Object.entries(names).map(([key, name]) => [key, readFileSync(new URL(`../docs/verification/lm-e9c-final/distribution/${name}.json.gz`, import.meta.url))]));
const parsed = Object.fromEntries(Object.entries(bundle).map(([key, bytes]) => [key, JSON.parse(gunzipSync(bytes))]));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
test('actual reference proves exact support partition and raw provenance relationships only', () => {
  const result = validateHistoricalReference(bundle);
  const run = parsed.runGzip, report = parsed.reportGzip, context = parsed.contextGzip;
  const observed = [...new Set(run.occurrences.map(row => row.entry))].sort();
  const enabled = [...context.enabledEntryIds].sort();
  assert.equal(result.referenceVerified, true);
  assert.deepEqual(result.enabledEntryIds, enabled);
  assert.deepEqual(result.observedEntryIds, observed);
  assert.deepEqual(result.absentEntryIds, enabled.filter(id => !observed.includes(id)));
  assert.deepEqual([enabled.length, observed.length, result.absentEntryIds.length], [56, 16, 40]);
  assert.equal(report.provenance.inputSha256, result.hashes.run.jsonSha256);
  assert.equal(report.provenance.contextSha256, result.hashes.context.jsonSha256);
  assert.equal(result.sourceRevision, context.sourceRevision);
  assert.deepEqual([result.seed, result.years, result.startYear, result.endYearExclusive], [1, 125, 1300, 1425]);
  for (const flag of ['applicabilityAllowed', 'fullStateComparable', 'originalRuntimeVerified']) assert.equal(result[flag], false);
  assert.equal('valid' in result, false);
  for (const [key, bytes] of Object.entries(bundle)) {
    assert.equal(result.hashes[key.replace('Gzip', '')].gzipSha256, sha(bytes));
    assert.equal(result.hashes[key.replace('Gzip', '')].jsonSha256, sha(gunzipSync(bytes)));
  }
});
test('missing, extra and non-byte inputs fail closed', () => {
  for (const key of Object.keys(bundle)) {
    const missing = { ...bundle }; delete missing[key];
    assert.throws(() => validateHistoricalReference(missing), /exact.*inputs/);
    assert.throws(() => validateHistoricalReference({ ...bundle, [key]: parsed[key] }), /bytes/);
  }
  assert.throws(() => validateHistoricalReference({ ...bundle, extra: Buffer.alloc(0) }), /exact.*inputs/);
  assert.throws(() => validateHistoricalReference(null), /exact.*inputs/);
});
test('swapped gzip artifacts cannot satisfy another role', () => {
  assert.throws(() => validateHistoricalReference({ ...bundle, reportGzip: bundle.contextGzip, contextGzip: bundle.reportGzip }), /SHA mismatch/);
});
for (const key of Object.keys(bundle)) test(`altered ${key} and invalid compressed bytes reject before identities are exposed`, () => {
  const altered = Buffer.from(bundle[key]); altered[altered.length - 1] ^= 1;
  for (const bytes of [altered, Buffer.from('invalid'), gzipSync('{}')]) {
    assert.throws(() => validateHistoricalReference({ ...bundle, [key]: bytes }), /SHA mismatch/);
  }
});
test('semantic reference substitutions cannot choose fresh hash pins', () => {
  const report = structuredClone(parsed.reportGzip); report.summary.support.enabledNotObserved[0] = report.summary.support.observedEnabled[0];
  assert.throws(() => validateHistoricalReference({ ...bundle, reportGzip: gzipSync(JSON.stringify(report)) }), /SHA mismatch/);
});
test('returned identity arrays cannot mutate a later validation', () => {
  const first = validateHistoricalReference(bundle); first.enabledEntryIds.length = 0; first.absentEntryIds[0] = 'changed';
  const next = validateHistoricalReference(bundle);
  assert.equal(next.enabledEntryIds.length, 56);
  assert.notEqual(next.absentEntryIds[0], 'changed');
});
