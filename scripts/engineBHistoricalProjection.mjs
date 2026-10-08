import { deepStrictEqual } from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';

export const HISTORICAL_REFERENCE = Object.freeze({
  sourceRevision: '56ee1d9d8259f89e6122153cedd82e783a74f5c7',
  gzipSha256: '61593ede78f3eae8a9ea60e512a00aa453bf924e7fb1fc40d1591f9e5c960cfc',
  jsonSha256: '95d34c0a79b51856386c4cfc443ddb1a224a3d9408d928ca33b105b67ffb3d52',
});
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const pointer = key => String(key).replaceAll('~', '~0').replaceAll('/', '~1');
function firstMismatch(expected, actual, path = '') {
  if (Object.is(expected, actual)) return null;
  if (expected === null || actual === null || typeof expected !== 'object' || typeof actual !== 'object'
    || Array.isArray(expected) !== Array.isArray(actual)) return { path, reason: 'value or type differs' };
  if (Array.isArray(expected) && expected.length !== actual.length) return { path: `${path}/length`, reason: 'array length differs' };
  const keys = Array.isArray(expected) ? Object.keys(expected) : [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort();
  for (const key of keys) {
    const next = `${path}/${pointer(key)}`;
    if (!Object.hasOwn(expected, key)) return { path: next, reason: 'extra key' };
    if (!Object.hasOwn(actual, key)) return { path: next, reason: 'missing key' };
    const mismatch = firstMismatch(expected[key], actual[key], next);
    if (mismatch) return mismatch;
  }
  return null;
}

// Pure byte comparison: no engine, filesystem, replay-source, or launch-gate evaluation.
export function compareHistoricalProjection(referenceGzip, replayJson) {
  if (!(referenceGzip instanceof Uint8Array)) throw new TypeError('Original gzip bytes required');
  if (typeof replayJson !== 'string' && !(replayJson instanceof Uint8Array)) throw new TypeError('Replay JSON bytes required');
  const actualBytes = Buffer.from(replayJson);
  const result = {
    sourceRevision: HISTORICAL_REFERENCE.sourceRevision, projection: 'registry-decision-home',
    referenceVerified: false, projectionMatched: false, applicabilityAllowed: false,
    fullStateComparable: false, originalRuntimeVerified: false,
    unevaluatedGates: ['priority', 'replay-source', 'replay-runtime', 'instrumentation', 'observer', 'report-context'],
    referenceGzipSha256: sha(referenceGzip), expectedSha256: HISTORICAL_REFERENCE.jsonSha256,
    actualSha256: sha(actualBytes), firstMismatch: null,
  };
  if (result.referenceGzipSha256 !== HISTORICAL_REFERENCE.gzipSha256) {
    result.firstMismatch = { path: '', reason: 'reference gzip SHA mismatch' }; return result;
  }
  const expectedBytes = gunzipSync(referenceGzip);
  if (sha(expectedBytes) !== HISTORICAL_REFERENCE.jsonSha256) {
    result.firstMismatch = { path: '', reason: 'reference JSON SHA mismatch' }; return result;
  }
  const expected = JSON.parse(expectedBytes.toString('utf8'));
  result.referenceVerified = true;
  let actual;
  try { actual = JSON.parse(actualBytes.toString('utf8')); }
  catch { result.firstMismatch = { path: '', reason: 'invalid replay JSON' }; return result; }
  const mismatchError = new Error('Historical projection differs');
  try { deepStrictEqual(actual, expected, mismatchError); result.projectionMatched = true; }
  catch (error) {
    if (error !== mismatchError) throw error;
    result.firstMismatch = firstMismatch(expected, actual);
  }
  return result;
}
