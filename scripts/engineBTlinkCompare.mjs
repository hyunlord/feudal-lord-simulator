import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { isDeepStrictEqual } from 'node:util';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const parse = bytes => JSON.parse(bytes.toString());
function readRun(directory, seed) {
  const root = join(directory, `seed-${seed}`), manifestBytes = readFileSync(join(root, 'manifest.json'));
  const manifest = parse(manifestBytes), validity = parse(readFileSync(join(root, 'validity.json')));
  assert.equal(validity.manifestSha256, sha(manifestBytes), 'Manifest pin mismatch');
  assert.equal(validity.valid, true); assert.equal(manifest.valid, true); assert.equal(manifest.replayVerified, true);
  assert.match(manifest.sourceRevision, /^[a-f0-9]{40}$/);
  assert.ok(manifest.toolHashes && Object.keys(manifest.toolHashes).length > 0);
  for (const hash of Object.values(manifest.toolHashes)) assert.match(hash, /^[a-f0-9]{64}$/);
  for (const key of ['node', 'platform']) assert.ok(typeof manifest.source?.[key] === 'string' && manifest.source[key].length > 0);
  assert.match(manifest.source.lock, /^[a-f0-9]{64}$/);
  assert.match(manifest.commandStreamSha256, /^[a-f0-9]{64}$/);
  assert.match(manifest.final.stateSha, /^[a-f0-9]{64}$/);
  assert.ok(Number.isSafeInteger(manifest.commandCount) && manifest.commandCount >= 0);
  assert.equal(manifest.seed, seed); assert.equal(manifest.source.status, '');
  assert.equal(manifest.tlinkParity?.enabled, true, 'Parity evidence required');
  const artifact = name => {
    const bytes = readFileSync(join(root, name));
    assert.equal(sha(bytes), manifest.tlinkParity.artifacts[name], `Artifact pin mismatch: ${name}`); return bytes;
  };
  const collect = parse(artifact('collect-parity.json')), replay = parse(artifact('replay-parity.json'));
  assert.deepEqual(collect, replay, 'Same-revision parity mismatch');
  assert.equal(collect.schemaVersion, 1);
  assert.equal(collect.everyTickStateParity, false);
  assert.equal(collect.finalized, true); assert.equal(collect.commandCount, manifest.commandCount);
  assert.equal(collect.lastTick, manifest.final.tick); assert.ok(collect.checkpoints.length > 0);
  const finalBytes = gunzipSync(artifact('collect-rule-state.json.gz'));
  assert.deepEqual(finalBytes, gunzipSync(artifact('replay-rule-state.json.gz')));
  assert.equal(sha(finalBytes), collect.finalHash, 'Final projection hash mismatch');
  assert.equal(collect.checkpoints.at(-1).phase, 'final');
  assert.equal(collect.checkpoints.at(-1).hash, collect.finalHash);
  return { manifest, manifestSha256: sha(manifestBytes), parity: collect, final: parse(finalBytes) };
}
function preview(value) {
  if (value === undefined) return { missing: true };
  if (value !== null && typeof value === 'object') return { type: Array.isArray(value) ? 'array' : 'object', size: Object.keys(value).length };
  if (typeof value === 'string' && value.length > 512) return { prefix: value.slice(0, 512), length: value.length };
  return value;
}
function differences(a, b, path = '$', rows = [], limit = 30) {
  if (rows.length >= limit || isDeepStrictEqual(a, b)) return rows;
  if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object' && Array.isArray(a) === Array.isArray(b)) {
    for (const key of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
      if (rows.length >= limit) break;
      differences(a[key], b[key], `${path}[${JSON.stringify(key)}]`, rows, limit);
    }
  } else rows.push({ path, baseline: preview(a), prototype: preview(b) });
  return rows;
}
/** Compares supplied pinned evidence; does not independently authenticate the producing runner. */
export function compareTlinkRuns(baselineDirectory, prototypeDirectory) {
  const cohorts = new Map();
  const seeds = [1, 2, 3].map(seed => {
    const a = readRun(baselineDirectory, seed), b = readRun(prototypeDirectory, seed);
    for (const [side, run] of [['baseline', a], ['prototype', b]]) {
      const cohort = { sourceRevision: run.manifest.sourceRevision, source: run.manifest.source, toolHashes: run.manifest.toolHashes };
      if (cohorts.has(side)) assert.deepEqual(cohort, cohorts.get(side), 'Cross-seed provenance mismatch');
      else cohorts.set(side, cohort);
    }
    for (const key of ['toolHashes', 'years']) assert.deepEqual(a.manifest[key], b.manifest[key], `Paired ${key} mismatch`);
    for (const key of ['node', 'platform', 'lock']) assert.equal(a.manifest.source[key], b.manifest.source[key], `Paired ${key} mismatch`);
    assert.equal(a.manifest.years, 125, '125-year evidence required');
    for (const key of ['schemaVersion', 'exclusions', 'seasonLength', 'hashScope', 'everyTickStateParity'])
      assert.deepEqual(a.parity[key], b.parity[key], `Projection contract mismatch: ${key}`);
    const count = Math.max(a.parity.checkpoints.length, b.parity.checkpoints.length);
    let earliestMismatch = null;
    for (let index = 0; index < count; index++) {
      if (!isDeepStrictEqual(a.parity.checkpoints[index], b.parity.checkpoints[index])) {
        earliestMismatch = { index, baseline: a.parity.checkpoints[index] ?? null, prototype: b.parity.checkpoints[index] ?? null }; break;
      }
    }
    const commandStreamEqual = a.manifest.commandCount === b.manifest.commandCount && a.manifest.commandStreamSha256 === b.manifest.commandStreamSha256;
    const parityEqual = isDeepStrictEqual(a.parity, b.parity);
    return { seed, baselineRevision: a.manifest.sourceRevision, prototypeRevision: b.manifest.sourceRevision,
      baselineManifestSha256: a.manifestSha256, prototypeManifestSha256: b.manifestSha256,
      commandStreamEqual, parityEqual, earliestMismatch,
      fullFinalHashEqual: a.manifest.final.stateSha === b.manifest.final.stateSha,
      finalProjectionEqual: isDeepStrictEqual(a.final, b.final), finalDifferences: differences(a.final, b.final),
      differencesLimit: 30, passed: commandStreamEqual && parityEqual && isDeepStrictEqual(a.final, b.final) };
  });
  return { schemaVersion: 1, passed: seeds.every(row => row.passed), seeds,
    limits: ['Sampled state parity only; no every-tick state equality.', 'Native guardrail evidence must be verified separately.',
      'Full-state hash differences are diagnostic and are not excused or normalized.', 'No causal IDs are normalized.'] };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [baseline, prototype, output, ...extra] = process.argv.slice(2);
  assert.ok(baseline && prototype && output && extra.length === 0, 'Usage: engineBTlinkCompare.mjs BASELINE_DIR PROTOTYPE_DIR NEW_REPORT.json');
  const report = compareTlinkRuns(baseline, prototype);
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  if (!report.passed) process.exitCode = 1;
}
