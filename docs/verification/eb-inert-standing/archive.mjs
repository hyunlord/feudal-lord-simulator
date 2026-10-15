import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

const RUN = 'engineB-standing4-125-239c823';
const REVISION = '239c8239880d063752d2713fad8902c3e8724c09';
const BASELINE = 'docs/verification/eb-tlink-four-categories/official-71bc336/report.json.gz';
const BASELINE_SHA = '5519e0d87775f5c48dd3629f36b676cdc49d7e4c35b32a1f5f4459bc03d14d33';
const [input, output, expectedRevision, ...extra] = process.argv.slice(2);
assert.ok(input && output && expectedRevision && extra.length === 0,
  'usage: node archive.mjs FETCHED_RUN/eb-inert-125 NEW_OUTPUT_DIR EXPECTED_REVISION');
assert.equal(expectedRevision, REVISION);
const root = resolve(input), official = dirname(root), out = resolve(output);
assert.equal(basename(root), 'eb-inert-125'); assert.equal(basename(official), RUN);
assert.ok(!existsSync(join(out, 'manifest.json')), 'Refusing to replace a verdict');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const members = [], originals = [], pinCache = new Map();
const encode = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
function add(file, bytes, source, rawSha256 = sha(bytes)) {
  members.push({ file, bytes, source, sha256: sha(bytes), rawSha256 });
}
function read(file, compact = true, compressed = false) {
  const path = join(root, file), bytes = readFileSync(path);
  originals.push({ file, bytes: bytes.length, sha256: sha(bytes), retained: compact });
  if (compact) add(`${file}${compressed ? '.gz' : ''}`, compressed ? gzipSync(bytes, { level: 9 }) : bytes, path, sha(bytes));
  return bytes;
}
const json = (file, compact = true, compressed = false) => JSON.parse(read(file, compact, compressed));
function pin(path, expected) {
  assert.match(expected, /^[a-f0-9]{64}$/); assert.ok(!path.startsWith('/') && !path.split('/').includes('..'));
  if (!pinCache.has(path)) pinCache.set(path, sha(execFileSync('git', ['show', `${REVISION}:${path}`], { maxBuffer: 64 * 1024 * 1024 })));
  assert.equal(pinCache.get(path), expected, `Source pin: ${path}`);
}
function tools(values) { for (const [file, expected] of Object.entries(values)) pin(`scripts/${file}`, expected); }
const comparison = json('comparison.json'), categories = json('categories.json', true, true), legacy = json('legacy-score.json', true, true);
const config = json('config.json'), producers = json('producer-status.json');
assert.equal(comparison.current.sourceRevision, REVISION); assert.equal(categories.provenance.sourceRevision, REVISION);
assert.equal(comparison.current.reportSha256, originals.find(row => row.file === 'categories.json').sha256);
assert.equal(comparison.current.legacyScoreSha256, originals.find(row => row.file === 'legacy-score.json').sha256);
assert.equal(categories.originalScoreSha256, comparison.current.legacyScoreSha256);
assert.equal(categories.originalScoreUnmodified, true); assert.deepEqual(categories.originalScore, legacy);
assert.deepEqual(comparison.current.summary, categories.summary);
assert.equal(comparison.baseline.sha256, BASELINE_SHA);
const baselineBytes = readFileSync(BASELINE); assert.equal(sha(baselineBytes), BASELINE_SHA);
const baseline = JSON.parse(gunzipSync(baselineBytes)); add('baseline-report.json.gz', baselineBytes, BASELINE);
assert.deepEqual(comparison.baseline.summary, baseline.summary);
assert.deepEqual(producers.map(row => row.seed), [1, 2, 3]);
assert.ok(producers.every(row => row.exitCode === 0 && row.signal === null), 'Incomplete producer cohort');
assert.deepEqual(legacy.scope.seeds, [1, 2, 3]); assert.equal(legacy.scope.yearsPerSeed, 125);
assert.equal(legacy.scope.endTick, 500000); assert.equal(legacy.scope.horizonTicks, 12000);
assert.deepEqual(categories.bySeed.map(row => row.seed), [1, 2, 3]);
assert.deepEqual(config.seeds, [1, 2, 3]); assert.equal(config.replayFormat, 'outcome-replay-v1');
assert.equal(config.horizonTicks, 12000); assert.equal(config.ticksPerSeason, 1000);
pin('docs/design/engine-B-outcomes.json', config.contractSha256);
for (const source of categories.provenance.sourceFiles) pin(source.path, source.sha256);
tools(categories.toolHashes);
for (const seed of [1, 2, 3]) {
  assert.equal(Number(read(`seed-${seed}.exit-code`)), 0);
  read(`seed-${seed}.log`, true, true);
  const dir = `original/seed-${seed}`, manifestBytes = read(`${dir}/manifest.json`), manifest = JSON.parse(manifestBytes);
  const parity = json(`${dir}/collect-parity.json`, true, true), capture = json(`capture/seed-${seed}/manifest.json`, true, true);
  assert.equal(manifest.sourceRevision, REVISION); assert.equal(manifest.source.revision, REVISION);
  assert.equal(manifest.source.status, ''); assert.equal(manifest.source.platform, 'linux'); assert.equal(manifest.source.node, 'v24.21.0');
  assert.equal(manifest.valid, true); assert.equal(manifest.replayVerified, true);
  assert.equal(manifest.seed, seed); assert.equal(manifest.years, 125); assert.equal(manifest.final.tick, 500000);
  const configPin = config.replayPins.find(row => row.seed === seed); assert.ok(configPin);
  assert.equal(configPin.manifestSha256, sha(manifestBytes));
  const raw = read(`original/seed-${seed}.json`, false);
  assert.equal(configPin.rawSha256, sha(raw)); assert.equal(manifest.raw.sha256, sha(raw));
  assert.equal(manifest.finalComparison.expectedSha256, manifest.finalComparison.actualSha256);
  assert.equal(parity.finalized, true); assert.equal(parity.lastTick, 500000);
  assert.equal(capture.sourceRevision, REVISION); assert.equal(capture.executionHead, REVISION);
  assert.equal(capture.originalManifestSha256, sha(manifestBytes)); assert.equal(capture.seed, seed);
  assert.equal(capture.tick, 500000); assert.equal(capture.years, 125); assert.ok(Number.isSafeInteger(capture.unclassified) && capture.unclassified >= 0);
  assert.equal(capture.status, 'verified_original_replay_observer_capture');
  assert.equal(capture.capturePhase, 'producer_replay'); assert.equal(capture.commandCount, manifest.commandCount);
  assert.equal(capture.files.length, capture.selectedHeavy + capture.unclassified);
  assert.equal(capture.selectedHeavy, categories.answers.filter(row => row.seed === seed).length);
  assert.equal(capture.node, manifest.source.node); assert.equal(capture.lockSha256, manifest.source.lock);
  assert.equal(capture.helperSha256, manifest.toolHashes['engineBInertCapture.mjs']);
  for (const field of ['commandStreamMatched', 'collectParityMatched', 'fullFinalStateMatched']) assert.equal(capture[field], true);
  assert.deepEqual(manifest.sourceFiles, categories.provenance.sourceFiles);
  assert.deepEqual(capture.sourceFiles, manifest.sourceFiles); tools(manifest.toolHashes); tools(capture.toolHashes);
  pin('package-lock.json', manifest.source.lock); assert.equal(manifest.source.lock, manifest.source.expectedLock);
  for (const [file, expected] of Object.entries(capture.inputHashes)) assert.equal(sha(read(`${dir}/${file}`, false)), expected);
  for (const file of capture.files) {
    const bytes = read(`capture/seed-${seed}/${file.file}`, false);
    assert.equal(sha(bytes), file.sha256); assert.equal(sha(gunzipSync(bytes)), file.rawSha256);
  }
  const final = read(`${dir}/original-final-state.json.gz`, false);
  assert.equal(sha(gunzipSync(final)), capture.originalFullFinalSha256);
}
const legacyExit = Number(read('legacy-scorer-exit-code')), categoryExit = Number(read('category-scorer-exit-code'));
assert.equal(legacyExit, legacy.pass ? 0 : 1); assert.equal(categoryExit, comparison.gate.pass ? 0 : 1);
for (const file of ['exit-code', 'timing.env', 'run.log']) {
  const bytes = readFileSync(join(official, file));
  add(`official/${file}${file === 'run.log' ? '.gz' : ''}`, file === 'run.log' ? gzipSync(bytes) : bytes, join(official, file), sha(bytes));
  if (file === 'exit-code') assert.equal(Number(bytes), categoryExit);
  if (file === 'run.log') assert.match(bytes.toString(), /== git: HEAD 239c823[0-9a-f]*,\s+0 path\(s\) differ from HEAD/);
}
const measurementSource = execFileSync('git', ['show', `${REVISION}:scripts/engineBInertMeasurement.mjs`]);
const measurement = await import(`data:text/javascript;base64,${measurementSource.toString('base64')}`);
const recomputedAnnual = measurement.compareInertAnnualHeavy(measurement.summarizeInertAnnualHeavy(baseline.originalScore), measurement.summarizeInertAnnualHeavy(legacy));
assert.deepEqual(comparison.annualHeavy, recomputedAnnual);
assert.deepEqual(comparison.gate, measurement.evaluateInertGate(categories, recomputedAnnual));
const annual = comparison.annualHeavy;
assert.equal(annual.pooled.baseline.seedYears, 375); assert.equal(annual.pooled.current.seedYears, 375);
const years = annual.bySeed.flatMap(row => {
  assert.equal(row.baseline.counts.length, 125); assert.equal(row.current.counts.length, 125);
  assert.equal(row.baseline.startYear, row.current.startYear);
  return row.current.counts.map((count, index) => ({ seed: row.seed, year: row.current.startYear + index,
    before: row.baseline.counts[index], after: count, delta: count - row.baseline.counts[index] }));
});
function events(report) {
  const result = new Map();
  for (const answer of report.answers) {
    // Audit ids are instance provenance, not distinct event/choice kinds.
    const identity = answer.source.replace(/^(audit:(?:tolerate|replace):)[^:]+$/, '$1*').replace(/^(steward_punished:)[^:]+$/, '$1*');
    result.set(identity, (result.get(identity) ?? 0) + 1);
  }
  assert.equal([...result.values()].reduce((sum, count) => sum + count, 0), report.summary.allAnswers);
  return result;
}
const beforeEvents = events(baseline), afterEvents = events(categories);
const byEvent = [...new Set([...beforeEvents.keys(), ...afterEvents.keys()])].sort().map(source => ({ source,
  before: beforeEvents.get(source) ?? 0, after: afterEvents.get(source) ?? 0, delta: (afterEvents.get(source) ?? 0) - (beforeEvents.get(source) ?? 0) }));
add('frequency-detail.json', encode({ years, byEvent, pooled: annual.pooled }), 'derived:comparison.json and authenticated category answers');
const text = `# EB-INERT standing policy cohort\n\nRun: ${RUN}\nSource: ${REVISION}\n\nMeasured gate: **${comparison.gate.pass ? 'PASS' : 'FAIL'}**. Native hashes and render acceptance are separate.\n\n| Metric | Before | After |\n| --- | ---: | ---: |\n${['total', 'median', 'max', 'yearsAboveFour'].map(key => `| ${key} | ${annual.pooled.baseline[key]} | ${annual.pooled.current[key]} |`).join('\n')}\n\nAll 375 calendar rows and event/choice source counts are in frequency-detail.json. Raw observer files remain in the kept official run; manifest.json preserves original byte sizes and hashes. Both pass and fail are archived. No missing result is interpreted as a verdict.\n`;
add('README.md', Buffer.from(text), 'derived:comparison.json');
add('archive.mjs', readFileSync(new URL(import.meta.url)), 'self');
// Finish every verification before writing any output artifact.
for (const member of members) if (existsSync(join(out, member.file))) assert.deepEqual(readFileSync(join(out, member.file)), member.bytes, 'No overwrites');
add('manifest.json', encode({ schemaVersion: 1, runId: RUN, sourceRevision: REVISION, baselineSha256: BASELINE_SHA,
  gate: comparison.gate, originalFiles: originals, verifiedPins: [...pinCache].map(([path, sha256]) => ({ path, sha256 })),
  files: members.map(({ bytes, ...row }) => ({ ...row, size: bytes.length })), limitations: ['No native-hash or render verdict is inferred from the lord cohort.'] }), 'derived');
add('SHA256SUMS', Buffer.from(members.map(row => `${row.sha256}  ${row.file}`).join('\n') + '\n'), 'derived');
for (const member of members) {
  const file = join(out, member.file); mkdirSync(dirname(file), { recursive: true });
  if (!existsSync(file)) writeFileSync(file, member.bytes, { flag: 'wx' });
}
console.log(JSON.stringify({ runId: RUN, archived: true, gatePass: comparison.gate.pass, manifestSha256: sha(readFileSync(join(out, 'manifest.json'))) }));
