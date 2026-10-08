import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import test from 'node:test';
import { validateHistoricalReference } from '../scripts/engineBHistoricalReference.mjs';
import { compareHistoricalProjection } from '../scripts/engineBHistoricalProjection.mjs';
import { createHistoricalObservations } from '../scripts/engineBHistoricalObservations.mjs';
import { validateHistoricalReplayArtifacts } from '../scripts/engineBHistoricalReplayReport.mjs';
const referenceBundle = Object.fromEntries(Object.entries({ runGzip: 'run-1', reportGzip: 'report-1', contextGzip: 'context' }).map(([key, name]) => [key, readFileSync(new URL(`../docs/verification/lm-e9c-final/distribution/${name}.json.gz`, import.meta.url))]));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => Buffer.from(JSON.stringify(value) + '\n');
function fixture() {
  const reference = validateHistoricalReference(referenceBundle), run = gunzipSync(referenceBundle.runGzip);
  const record = { scope: 'candidate', gate: 'chance', tick: 1000, entryId: reference.absentEntryIds[0], enabledChoices: null, enabledChoicesObserved: false, choiceEvaluationReached: false, note: 'synthetic 한글' };
  const raw = json(record), acc = createHistoricalObservations(reference.absentEntryIds); acc.observe(record);
  const artifacts = {
    'candidate-observation.ndjson': raw, 'candidate-observation.ndjson.gz': gzipSync(raw),
    'observation-counts.json': json(acc.snapshot()),
    'observer-summary.json': json({ rows: 1, callbackInvocations: 1, writeFailures: 0, observerFailures: 0, firstErrors: [] }),
    'projection-parity.json': json(compareHistoricalProjection(referenceBundle.runGzip, run)),
    'report-parity.json': json({ reportMatched: true, reportError: null, replayRunSha256: sha(run), originalProvenanceCompared: false }),
    'replay-distribution-summary.json': json(JSON.parse(gunzipSync(referenceBundle.reportGzip)).summary),
    'replay-run.json': run, 'reference-validation.json': json(reference),
    'tool-hashes.json': json({ toolRevision: 'a'.repeat(40), hashes: {} }),
    'instrumentation-manifest.json': json({ synthetic: true }), 'priority-prerequisites.json': json({ synthetic: true }),
  };
  const manifest = { valid: true, sourceRevision: reference.sourceRevision, toolRevision: 'a'.repeat(40), node: 'v24.21.0', seed: 1, years: 125, rows: 1, observerFailures: 0, projectionMatched: true, reportMatched: true, replayRunSha256: sha(run), applicabilityAllowed: false };
  function options() {
    const manifestBytes = json({ ...manifest, artifactSha256: Object.fromEntries(Object.entries(artifacts).map(([name, bytes]) => [name, sha(bytes)])) });
    return { referenceBundle, manifestBytes, manifestSha256: sha(manifestBytes), readArtifact: name => artifacts[name] };
  }
  return { artifacts, manifest, options };
}
function mutate(f, name, edit) { const value = JSON.parse(f.artifacts[name]); edit(value); f.artifacts[name] = json(value); }
test('clearly synthetic but internally consistent artifacts yield forty rows without applicability', async () => {
  const f = fixture(), result = await validateHistoricalReplayArtifacts(f.options());
  assert.equal(result.artifactConsistencyVerified, true); assert.equal(result.rows.length, 40);
  assert.equal(result.observations.records, 1); assert.equal(result.rows[0].gateCounts['candidate.chance'], 1);
  for (const key of ['applicabilityAllowed', 'fullStateComparable', 'perTickComparable', 'originalRuntimeVerified', 'completeCausesVerified']) assert.equal(result[key], false);
  assert.equal('valid' in result, false);
});
test('byte-chunk streaming preserves split UTF8 and identical aggregation', async () => {
  const f = fixture(), options = f.options();
  options.readArtifact = async function* (name) {
    if (!name.startsWith('candidate-observation.')) { yield f.artifacts[name]; return; }
    for (const byte of f.artifacts[name]) yield Buffer.from([byte]);
  };
  assert.deepEqual(await validateHistoricalReplayArtifacts(options), await validateHistoricalReplayArtifacts(f.options()));
});
test('external manifest pin, missing artifacts and changed bytes reject', async () => {
  const f = fixture(), options = f.options();
  await assert.rejects(validateHistoricalReplayArtifacts({ ...options, manifestSha256: '0'.repeat(64) }), /manifest SHA/);
  delete f.artifacts['observer-summary.json'];
  await assert.rejects(validateHistoricalReplayArtifacts(options));
  const g = fixture(), pinned = g.options(); g.artifacts['replay-run.json'] = Buffer.from('{}');
  await assert.rejects(validateHistoricalReplayArtifacts(pinned), /SHA/);
});
test('re-pinned projection, summary and saved-count tampering still reject', async () => {
  for (const [name, edit] of [
    ['replay-run.json', value => { value.seed = 2; }],
    ['replay-distribution-summary.json', value => { value.support.enabledCount = 55; }],
    ['observation-counts.json', value => { value.rows[0].records = 99; }],
    ['projection-parity.json', value => { value.projectionMatched = false; }],
    ['report-parity.json', value => { value.reportError = 'failure'; }],
  ]) { const f = fixture(); mutate(f, name, edit); await assert.rejects(validateHistoricalReplayArtifacts(f.options())); }
});
test('manifest identity and failure flags cannot manufacture acceptance', async () => {
  for (const [key, value] of [['node', 'v22.0.0'], ['seed', 2], ['years', 1], ['sourceRevision', 'b'.repeat(40)], ['rows', 2], ['observerFailures', 1], ['valid', false], ['applicabilityAllowed', true]]) {
    const f = fixture(); f.manifest[key] = value; await assert.rejects(validateHistoricalReplayArtifacts(f.options()));
  }
});
test('observer failure/write failure/count mismatch reject even with matching manifest', async () => {
  for (const [key, value] of [['observerFailures', 1], ['writeFailures', 1], ['callbackInvocations', 2], ['firstErrors', ['error']]]) {
    const f = fixture(); mutate(f, 'observer-summary.json', row => { row[key] = value; });
    await assert.rejects(validateHistoricalReplayArtifacts(f.options()));
  }
});
test('malformed, empty or divergent raw/gzip streams fail closed', async () => {
  for (const raw of [Buffer.from('{\n'), Buffer.alloc(0), Buffer.from('\n'), Buffer.from('{"tick":1}\n')]) {
    const f = fixture(); f.artifacts['candidate-observation.ndjson'] = raw; f.artifacts['candidate-observation.ndjson.gz'] = gzipSync(raw);
    await assert.rejects(validateHistoricalReplayArtifacts(f.options()));
  }
  const f = fixture(); f.artifacts['candidate-observation.ndjson.gz'] = gzipSync(Buffer.from('{}\n'));
  await assert.rejects(validateHistoricalReplayArtifacts(f.options()), /decompressed/);
});
test('decompression and accessor stream errors propagate without acceptance', async () => {
  const f = fixture(); f.artifacts['candidate-observation.ndjson.gz'] = Buffer.from('not gzip');
  await assert.rejects(validateHistoricalReplayArtifacts(f.options()));
  const g = fixture(), options = g.options();
  options.readArtifact = name => name.endsWith('.gz') ? (async function* () { yield g.artifacts[name].subarray(0, 8); throw new Error('stream failed'); })() : g.artifacts[name];
  await assert.rejects(validateHistoricalReplayArtifacts(options), /stream failed/);
});
test('manifest cannot request arbitrary paths or omit mandatory artifact hashes', async () => {
  for (const mode of ['extra', 'missing']) {
    const f = fixture(), options = f.options(), manifest = JSON.parse(options.manifestBytes);
    if (mode === 'extra') manifest.artifactSha256['../secret'] = sha(Buffer.from('secret'));
    else delete manifest.artifactSha256['priority-prerequisites.json'];
    options.manifestBytes = json(manifest); options.manifestSha256 = sha(options.manifestBytes);
    options.readArtifact = () => { assert.fail('Must reject names before requesting any artifact'); };
    await assert.rejects(validateHistoricalReplayArtifacts(options), /mandatory artifact names/);
  }
});
