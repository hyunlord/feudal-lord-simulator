import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import test from 'node:test';
import { compareHistoricalProjection, HISTORICAL_REFERENCE } from '../scripts/engineBHistoricalProjection.mjs';

const archive = readFileSync(new URL('../docs/verification/lm-e9c-final/distribution/run-1.json.gz', import.meta.url));
const raw = gunzipSync(archive);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function changed(edit) { const value = JSON.parse(raw); edit(value); return JSON.stringify(value); }
function rejected(actual, path) {
  const result = compareHistoricalProjection(archive, actual);
  assert.equal(result.projectionMatched, false);
  assert.equal(result.applicabilityAllowed, false);
  assert.equal(result.firstMismatch.path, path);
  assert.equal(result.actualSha256, sha(actual));
  return result;
}
test('entire real archived run matches while applicability and runtime remain unverified', () => {
  const result = compareHistoricalProjection(archive, raw);
  assert.equal(result.projectionMatched, true);
  assert.equal(result.referenceVerified, true);
  assert.equal(result.firstMismatch, null);
  assert.equal(result.expectedSha256, sha(raw));
  assert.equal(result.actualSha256, sha(raw));
  assert.equal(result.sourceRevision, HISTORICAL_REFERENCE.sourceRevision);
  for (const flag of ['applicabilityAllowed', 'fullStateComparable', 'originalRuntimeVerified']) assert.equal(result[flag], false);
});
test('formatting and object key order may differ but byte hashes expose that difference', () => {
  const actual = JSON.stringify(Object.fromEntries(Object.entries(JSON.parse(raw)).reverse()));
  const result = compareHistoricalProjection(archive, actual);
  assert.equal(result.projectionMatched, true);
  assert.notEqual(result.actualSha256, result.expectedSha256);
});
test('changed occurrence choice fails at exact nested path', () => {
  rejected(changed(value => { value.occurrences[0].choice = 'mutated'; }), '/occurrences/0/choice');
});
for (const field of ['decisionsHash', 'homesHash']) test(`changed ${field} cannot hide behind unchanged rows`, () => {
  rejected(changed(value => { value[field] = 'mutated'; }), `/${field}`);
});
test('extra recursive key is rejected including escaped JSON pointer tokens', () => {
  rejected(changed(value => { value.occurrences[0]['extra~/key'] = 1; }), '/occurrences/0/extra~0~1key');
});
test('missing recursive key is rejected', () => {
  rejected(changed(value => { delete value.occurrences[0].choice; }), '/occurrences/0/choice');
});
test('array order and length remain significant', () => {
  const swapped = changed(value => { [value.occurrences[0], value.occurrences[1]] = [value.occurrences[1], value.occurrences[0]]; });
  assert.match(compareHistoricalProjection(archive, swapped).firstMismatch.path, /^\/occurrences\/0\//);
  rejected(changed(value => { value.homeList.pop(); }), '/homeList/length');
});
test('invalid replay JSON and a replaced root fail closed', () => {
  assert.equal(rejected('{', '').firstMismatch.reason, 'invalid replay JSON');
  rejected('null', '');
});
test('wrong or recompressed reference cannot substitute an arbitrary expected object', () => {
  for (const reference of [Buffer.from('invalid'), gzipSync('{}'), gzipSync(raw, { level: 0 })]) {
    const result = compareHistoricalProjection(reference, raw);
    assert.equal(result.projectionMatched, false);
    assert.equal(result.referenceVerified, false);
    assert.equal(result.firstMismatch.reason, 'reference gzip SHA mismatch');
    assert.equal(result.applicabilityAllowed, false);
  }
  assert.throws(() => compareHistoricalProjection(JSON.parse(raw), raw), /bytes/);
  assert.throws(() => compareHistoricalProjection(archive, JSON.parse(raw)), /bytes/);
});
test('scalar types and array identity are strict even when values look equivalent', () => {
  rejected(changed(value => { value.seed = String(value.seed); }), '/seed');
  rejected(changed(value => { value.occurrences = { ...value.occurrences }; }), '/occurrences');
});
