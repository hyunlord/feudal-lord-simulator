import { createHash } from 'node:crypto';
import { createGunzip, gunzipSync } from 'node:zlib';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { isDeepStrictEqual } from 'node:util';
import { validateHistoricalReference } from './engineBHistoricalReference.mjs';
import { compareHistoricalProjection } from './engineBHistoricalProjection.mjs';
import { createHistoricalObservations } from './engineBHistoricalObservations.mjs';

const ARTIFACTS = ['candidate-observation.ndjson', 'candidate-observation.ndjson.gz', 'observation-counts.json', 'observer-summary.json',
  'projection-parity.json', 'report-parity.json', 'replay-distribution-summary.json', 'replay-run.json', 'tool-hashes.json',
  'instrumentation-manifest.json', 'reference-validation.json', 'priority-prerequisites.json'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const check = (condition, message) => { if (!condition) throw new Error(`Historical replay artifacts: ${message}`); };
const same = (actual, expected, label) => check(isDeepStrictEqual(actual, expected), `${label} mismatch`);
const parse = bytes => JSON.parse(Buffer.from(bytes).toString('utf8'));
async function* chunks(input) {
  const value = await input;
  if (value instanceof Uint8Array) { yield value; return; }
  check(value !== null && typeof value === 'object' && (Symbol.asyncIterator in value || Symbol.iterator in value), 'artifact bytes or byte iterable required');
  for await (const chunk of value) { check(chunk instanceof Uint8Array, 'artifact chunk bytes required'); yield chunk; }
}

export async function validateHistoricalReplayArtifacts({ referenceBundle, manifestBytes, manifestSha256, readArtifact }) {
  check(manifestBytes instanceof Uint8Array && hash(manifestSha256) && sha(manifestBytes) === manifestSha256, 'external manifest SHA mismatch');
  check(typeof readArtifact === 'function', 'artifact accessor required');
  const reference = validateHistoricalReference(referenceBundle), manifest = parse(manifestBytes);
  same([manifest.sourceRevision, manifest.node, manifest.seed, manifest.years], [reference.sourceRevision, 'v24.21.0', 1, 125], 'manifest identity labels');
  check(manifest.valid === true && manifest.projectionMatched === true && manifest.reportMatched === true
    && manifest.applicabilityAllowed === false && manifest.observerFailures === 0, 'manifest failure flags');
  check(Number.isSafeInteger(manifest.rows) && manifest.rows > 0 && /^[a-f0-9]{40}$/.test(manifest.toolRevision), 'manifest rows/tool revision invalid');
  check(manifest.artifactSha256 && typeof manifest.artifactSha256 === 'object', 'mandatory artifact hashes required');
  same(Object.keys(manifest.artifactSha256).sort(), [...ARTIFACTS].sort(), 'mandatory artifact names');
  check(ARTIFACTS.every(name => hash(manifest.artifactSha256[name])), 'invalid artifact hash');
  async function* verified(name) {
    const digest = createHash('sha256');
    for await (const chunk of chunks(readArtifact(name))) { digest.update(chunk); yield chunk; }
    check(digest.digest('hex') === manifest.artifactSha256[name], `${name} SHA mismatch`);
  }
  const bytes = {}, data = {};
  for (const name of ARTIFACTS.filter(name => name.endsWith('.json'))) {
    const parts = []; for await (const chunk of verified(name)) parts.push(Buffer.from(chunk));
    bytes[name] = Buffer.concat(parts); data[name] = parse(bytes[name]);
  }
  same(data['reference-validation.json'], reference, 'saved reference validation');
  check(data['tool-hashes.json'].toolRevision === manifest.toolRevision, 'tool revision relationship mismatch');
  const parity = compareHistoricalProjection(referenceBundle.runGzip, bytes['replay-run.json']);
  check(parity.projectionMatched, `whole projection mismatch at ${parity.firstMismatch?.path}`);
  same(data['projection-parity.json'], parity, 'saved projection parity');
  check(manifest.replayRunSha256 === parity.actualSha256, 'manifest replay run hash mismatch');
  same(data['replay-distribution-summary.json'], parse(gunzipSync(referenceBundle.reportGzip)).summary, 'original report summary');
  same(data['report-parity.json'], { reportMatched: true, reportError: null, replayRunSha256: parity.actualSha256, originalProvenanceCompared: false }, 'saved report parity');
  const accumulator = createHistoricalObservations(reference.absentEntryIds), decoder = new TextDecoder('utf-8', { fatal: true });
  let pending = '';
  function line(value) {
    const record = JSON.parse(value);
    check(record?.tick <= 500000, 'observation beyond historical end tick');
    accumulator.observe(record);
  }
  for await (const chunk of verified('candidate-observation.ndjson')) {
    pending += decoder.decode(chunk, { stream: true });
    let newline;
    while ((newline = pending.indexOf('\n')) !== -1) { line(pending.slice(0, newline)); pending = pending.slice(newline + 1); }
  }
  pending += decoder.decode();
  check(pending === '', 'unterminated observation record');
  const observations = accumulator.snapshot();
  check(observations.records === manifest.rows, 'stream row count mismatch');
  const decompressed = createHash('sha256');
  await pipeline(Readable.from(verified('candidate-observation.ndjson.gz')), createGunzip(), async source => {
    for await (const chunk of source) decompressed.update(chunk);
  });
  check(decompressed.digest('hex') === manifest.artifactSha256['candidate-observation.ndjson'], 'decompressed observation SHA mismatch');
  same(data['observation-counts.json'], observations, 'saved observation counts');
  same(data['observer-summary.json'], { rows: observations.records, callbackInvocations: observations.records, writeFailures: 0, observerFailures: 0, firstErrors: [] }, 'observer summary');
  return { artifactConsistencyVerified: true, manifestSha256, referenceVerified: true, projectionMatched: true, reportSummaryMatched: true,
    claimedProvenance: { sourceRevision: manifest.sourceRevision, toolRevision: manifest.toolRevision, node: manifest.node },
    externalChecksVerified: false, unevaluatedChecks: ['actual replay source/runtime/tool identity', 'instrumentation noninterference', 'priority terminal evidence', 'observation completeness'],
    observations, rows: observations.rows.map(row => ({ ...row, evidenceStage: row.records > 0 ? 'supplied replay records' : 'no entry-attributed records supplied' })),
    applicabilityAllowed: false, fullStateComparable: false, perTickComparable: false, originalRuntimeVerified: false, completeCausesVerified: false };
}
