import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { aggregateAnswerReplays } from '../scripts/engineBAnswerReplayReport.mjs';
const revision = '2485af40046793f1856829fa1161dc4431942aa7';
const sha = value => createHash('sha256').update(value).digest('hex');
function row(ordinal, tick, extra = {}) {
  return { ordinal, tick, command: 'answer_registry_offer', historyId: `h-${ordinal}`, status: 'classified', reason: null,
    source: 'registry:ck_evt_092:a', kind: 'registry', weights: ['rights'], cameHeavyToLord: true, ...extra };
}
function manifest(seed, rows = []) {
  return { valid: true, browserEligible: true, sourceRevision: revision, seed,
    source: { platform: 'linux', node: 'v24.21.0', revision, status: '', lock: 'a'.repeat(64), expectedLock: 'a'.repeat(64) },
    toolHashes: { 'engineBAnswerReplay.ts': 'b'.repeat(64), 'engineBAnswerEvidence.ts': 'c'.repeat(64), 'engineBWeightAuditRun.ts': 'd'.repeat(64) },
    raw: { sha256: String(seed).repeat(64), provenance: { sourceRevision: revision, dirtyPaths: '', node: 'v24.21.0' } },
    manifestSha256: 'e'.repeat(64), contextSha256: 'f'.repeat(64), commandStreamSha256: '1'.repeat(64), commandCount: 100,
    checkpoints: [], final: { phase: 'final', tick: 500000, hit: true },
    registrySidecarSha256: '3'.repeat(64), registryAnswerSetVerified: rows.filter(row => row.status === 'classified' && row.command === 'answer_registry_offer').length,
    finalComparison: { expectedSha256: '2'.repeat(64), actualSha256: '2'.repeat(64), expectedChecksum: 'checksum', actualChecksum: 'checksum' },
    classification: { rows, ...Object.fromEntries(['classified', 'unclassified', 'excluded', 'unresolved'].map(status => [status, rows.filter(row => row.status === status)])) } };
}
function input(m) {
  const manifestBytes = JSON.stringify(m);
  return { manifestBytes, validityBytes: JSON.stringify({ valid: true, browserEligible: true, manifestSha256: sha(manifestBytes) }) };
}
const pack = first => [input(first), input(manifest(2)), input(manifest(3))];

test('actual own-tick counts preserve silent years, scope categories and B11 without root conflation', () => {
  const rows = [row(1, 3999), row(2, 4000), row(3, 4001, { source: 'registry:ck_evt_209:d' }),
    row(4, 4002, { command: 'answer_audit', source: 'audit:tolerate:a', kind: 'audit', weights: ['land'] }),
    row(5, 4003, { command: 'confirm_market_town', status: 'unclassified', source: null, kind: null, weights: null, cameHeavyToLord: null }),
    row(6, 4004, { command: 'order_timber', status: 'excluded', historyId: null, source: null, kind: null, weights: null, cameHeavyToLord: null })];
  const r = aggregateAnswerReplays(pack(manifest(1, rows)));
  assert.equal(r.pooled.whole.total, 4); assert.equal(r.pooled.whole.countedYears, 375);
  assert.equal(r.pooled.whole.zeroYears, 373); assert.equal(r.perSeed[0].annual[0].whole, 1);
  assert.equal(r.perSeed[0].annual[1].whole, 3); assert.equal(r.pooled.registry.total, 3); assert.equal(r.pooled.priorB11.total, 2);
  assert.deepEqual(r.perSeed[0].unclassifiedByCommand, { confirm_market_town: 1 });
  assert.deepEqual(r.perSeed[0].excludedByReason, { '(unspecified)': 1 });
  assert.equal(r.categories.unclassified, 1); assert.equal(r.categories.excluded, 1);
});

test('actual input-byte hash, source, validity, three unique seeds and matching tools are mandatory', () => {
  const good = pack(manifest(1)); good[0].manifestBytes += ' ';
  assert.throws(() => aggregateAnswerReplays(good), /manifest SHA/);
  for (const change of [m => { m.valid = false; }, m => { m.browserEligible = false; }, m => { m.seed = 2; },
    m => { m.sourceRevision = '0'.repeat(40); }, m => { m.source.status = ' M src/engine/tick.ts'; },
    m => { m.toolHashes['engineBAnswerEvidence.ts'] = '9'.repeat(64); }, m => { m.finalComparison.actualSha256 = '9'.repeat(64); }]) {
    const m = manifest(1); change(m); assert.throws(() => aggregateAnswerReplays(pack(m)));
  }
});

test('unresolved, duplicate identities, invalid ordinals, endpoint and malformed categories fail closed', () => {
  for (const rows of [[row(1, 0), row(1, 1)], [row(1, 0), row(2, 1, { historyId: 'h-1' })], [row(0, 0)],
    [row(1, 500000)], [row(1, -1)], [row(1, 0, { status: 'unresolved' })], [row(1, 0, { cameHeavyToLord: null })]]) {
    assert.throws(() => aggregateAnswerReplays(pack(manifest(1, rows))));
  }
  const m = manifest(1, [row(1, 0)]); m.classification.classified = [];
  assert.throws(() => aggregateAnswerReplays(pack(m)), /category/);
});

test('over-four years measured from actual answers, including five distinct answers in one year', () => {
  const r = aggregateAnswerReplays(pack(manifest(1, Array.from({ length: 5 }, (_, i) => row(i + 1, i)))));
  assert.equal(r.pooled.whole.maximum, 5); assert.equal(r.pooled.whole.aboveFourYears, 1);
  assert.deepEqual(r.overFourYears.map(r => [r.seed, r.year]), [[1, 1300]]);
});


test('legacy registry answers remain registry while B11 remains a canonical subset', () => {
  const m = manifest(1, [row(1, 499999, { source: 'registry:home_petition_repair:grant' })]);
  m.source.status = '?? scripts/engineBAnswerEvidence.ts\n?? scripts/engineBAnswerReplay.ts';
  const result = aggregateAnswerReplays(pack(m));
  assert.equal(result.pooled.registry.total, 1); assert.equal(result.pooled.priorB11.total, 0);
  assert.equal(result.perSeed[0].annual[124].whole, 1);
});

test('missing validity, malformed category rows and non-safe ordinals fail closed', () => {
  for (const ordinal of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => aggregateAnswerReplays(pack(manifest(1, [row(ordinal, 0)]))));
  }
  const inputs = pack(manifest(1)); inputs[0].validityBytes = '{}';
  assert.throws(() => aggregateAnswerReplays(inputs));
  assert.throws(() => aggregateAnswerReplays([]));
  const m = manifest(1, [row(1, 0, { source: 'registry:broken' })]);
  assert.throws(() => aggregateAnswerReplays(pack(m)), /registry source/);
});


test('actual replay final is separate from nonfinal checkpoints and registry verification is exact', () => {
  for (const change of [m => { delete m.final; }, m => { m.final.hit = false; }, m => { m.final.tick = 499999; },
    m => { m.registryAnswerSetVerified = 0; }, m => { delete m.registrySidecarSha256; },
    m => { m.checkpoints = [{ phase: 'answer', hit: false }]; }]) {
    const m = manifest(1, [row(1, 0)]); change(m);
    assert.throws(() => aggregateAnswerReplays(pack(m)));
  }
});


test('CLI reads exact bytes and refuses to overwrite output or input evidence', () => {
  const directory = mkdtempSync(join(tmpdir(), 'answer-replay-report-'));
  try {
    const seeds = [1, 2, 3].map(seed => {
      const path = join(directory, String(seed)); mkdirSync(path);
      const bytes = input(manifest(seed));
      writeFileSync(join(path, 'manifest.json'), bytes.manifestBytes);
      writeFileSync(join(path, 'validity.json'), bytes.validityBytes);
      return path;
    });
    const output = join(directory, 'report.json');
    const script = new URL('../scripts/engineBAnswerReplayReport.mjs', import.meta.url);
    const run = destination => spawnSync(process.execPath, [script.pathname, ...seeds, destination], { encoding: 'utf8' });
    assert.equal(run(output).status, 0);
    assert.equal(JSON.parse(readFileSync(output, 'utf8')).pooled.whole.countedYears, 375);
    const before = readFileSync(output, 'utf8');
    assert.notEqual(run(output).status, 0); assert.equal(readFileSync(output, 'utf8'), before);
    const source = join(seeds[0], 'manifest.json'); const original = readFileSync(source, 'utf8');
    assert.notEqual(run(source).status, 0); assert.equal(readFileSync(source, 'utf8'), original);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
