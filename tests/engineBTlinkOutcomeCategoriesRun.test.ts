import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
const { outcomeSha256: sha } = await import(new URL('../scripts/engineBOutcomeArchive.mjs', import.meta.url).href);
const { runOutcomeGate } = await import(new URL('../scripts/engineBOutcomeRun.mjs', import.meta.url).href);
const { loadTlinkCategoryInputs, tlinkImmediateDifferences, runTlinkOutcomeCategories } = await import(new URL('../scripts/engineBTlinkOutcomeCategoriesRun.mjs', import.meta.url).href);
const { TLINK_REVIEWED_EFFECT_SOURCES } = await import(new URL('../scripts/engineBTlinkOutcomeEvidence.mjs', import.meta.url).href);
const encode = (value: unknown) => Buffer.from(JSON.stringify(value));
function fixture(reviewedSources = false, embedded = false) {
  const root = mkdtempSync(join(tmpdir(), 'tlink-loader-test-')), original = join(root, 'original'), replay = join(root, 'observer');
  mkdirSync(join(original, 'seed-1'), { recursive: true }); mkdirSync(join(replay, 'seed-1'), { recursive: true });
  const directory = join(original, 'seed-1'), observer = join(replay, 'seed-1');
  const sourceRevision = 'a'.repeat(40), helper = 'e'.repeat(64), sourceFiles = reviewedSources ? TLINK_REVIEWED_EFFECT_SOURCES : [{ path: 'src/engine/a.ts', sha256: 'b'.repeat(64) }];
  const toolHashes = { 'engineBOutcomeCollect.ts': 'c'.repeat(64), ...(embedded ? { 'engineBInertCapture.mjs': helper } : {}) }, source = { revision: sourceRevision, node: 'v24.21.0', platform: 'linux', lock: 'd'.repeat(64), expectedLock: 'd'.repeat(64), status: '' };
  const provenance = { sourceRevision, node: source.node, dirtyPaths: '', sourceFiles };
  const command = { type: 'answer_audit', auditId: 's1', choice: 'tolerate' };
  const decision = { id: 'h1', tick: 10, kind: 'decision', template: 'decision.card', params: { command: command.type } };
  const classified = { ordinal: 1, tick: 10, historyId: 'h1', command: command.type, source: 'audit:tolerate:s1', kind: 'audit', weights: ['rights'], cameHeavyToLord: true, status: 'classified' };
  const classification = { rows: [classified], classified: [classified], excluded: [], unclassified: [], unresolved: [] };
  const contexts = [{ ordinal: 1, tick: 10, command, history: decision }];
  const rawBytes = encode({ provenance, seed: 1, years: 125, startYear: 1300, endYearExclusive: 1425, endTick: 500000,
    observation: { firstTick: 0, lastTick: 500000, maxGap: 1, reversals: 0 }, history: [decision], decisions: [], occurrences: [] });
  const before = { seed: 1, tick: 10, treasuryCoin: 10 }, after = { seed: 1, tick: 10, treasuryCoin: 12 };
  const parity = { finalized: true, commandCount: 1, lastTick: 500000, exclusions: ['history', 'trace.decisions', 'trace.answers'], checkpoints: [{ phase: 'command', commandOrdinal: 1, tick: 10, hash: sha(JSON.stringify(after)) }] };
  const parityBytes = encode(parity), finalBytes = encode({ seed: 1, tick: 500000 }), contextsBytes = gzipSync(encode(contexts));
  const manifest = { sourceRevision, sourceFiles, source, toolHashes, seed: 1, years: 125, replayFormat: 'outcome-replay-v1', valid: true, replayVerified: true, browserEligible: false,
    raw: { sha256: sha(rawBytes), provenance }, classification, commandCount: 1, commandStreamSha256: sha(`${JSON.stringify({ ordinal: 1, tick: 10, command })}\n`), contextSha256: sha(contextsBytes), checkpoints: [],
    final: { hit: true, phase: 'final', tick: 500000, stateSha: sha(finalBytes) }, finalComparison: { expectedSha256: sha(finalBytes), actualSha256: sha(finalBytes), expectedChecksum: 'same', actualChecksum: 'same' },
    registryAnswerSetVerified: 0, tlinkParity: { enabled: true, artifacts: { 'collect-parity.json': sha(parityBytes) } } };
  const manifestBytes = encode(manifest);
  const originalFiles = { 'manifest.json': manifestBytes, 'preflight.json': encode({ sourceRevision, sourceFiles, toolHashes, source }), 'original-contexts.json.gz': contextsBytes,
    'answer-classification.json': encode(classification), 'collect-parity.json': parityBytes, 'original-final-state.json.gz': gzipSync(finalBytes) };
  for (const [name, bytes] of Object.entries(originalFiles)) writeFileSync(join(directory, name), bytes);
  writeFileSync(join(directory, 'validity.json'), encode({ valid: true, browserEligible: false, manifestSha256: sha(manifestBytes) })); writeFileSync(join(original, 'seed-1.json'), rawBytes);
  const contractBytes = encode({ schemaVersion: 1, provenance: { sourceRevision, sourceFiles }, events: [] }); writeFileSync(join(root, 'contract.json'), contractBytes);
  const config = { schemaVersion: 1, seeds: [1], replayFormat: 'outcome-replay-v1', replayDirectory: 'original', rawDirectory: 'original', contractFile: 'contract.json', contractSha256: sha(contractBytes), horizonTicks: 12000, ticksPerSeason: 1000,
    replayPins: [{ seed: 1, manifestSha256: sha(manifestBytes), rawSha256: sha(rawBytes) }] };
  const configPath = join(root, 'config.json'), scorePath = join(root, 'score.json'); writeFileSync(configPath, encode(config)); runOutcomeGate(configPath, scorePath);
  const row = { schemaVersion: 1, seed: 1, ordinal: 1, tick: 10, historyId: 'h1', command, classificationStatus: 'classified', cameHeavyToLord: true, mature: true,
    exclusions: parity.exclusions, rawBeforeSha256: 'f'.repeat(64), rawAfterSha256: '0'.repeat(64), beforeRuleSha256: sha(JSON.stringify(before)), afterRuleSha256: sha(JSON.stringify(after)),
    before, after, differences: tlinkImmediateDifferences(before, after), observerStateHashesStable: true, categoriesAssigned: false };
  const bytes = encode(row), compressed = gzipSync(bytes), file = { file: 'answer-000001.json.gz', ordinal: 1, historyId: 'h1', sha256: sha(compressed), rawSha256: sha(bytes) }; writeFileSync(join(observer, file.file), compressed);
  const observed = { schemaVersion: 1, status: 'verified_original_replay_observer_capture', sourceRevision, executionHead: sourceRevision, seed: 1, years: 125, tick: 500000, commandCount: 1,
    ...(embedded ? { capturePhase: 'producer_replay' } : {}), originalManifestSha256: sha(manifestBytes), inputHashes: Object.fromEntries(Object.entries(originalFiles).map(([name, data]) => [name, sha(data)])), sourceFiles, toolHashes, node: source.node, lockSha256: source.lock, helperSha256: helper,
    files: [file], selectedHeavy: 1, unclassified: 0, commandStreamMatched: true, collectParityMatched: true, fullFinalStateMatched: true, originalFullFinalSha256: sha(finalBytes), exclusions: parity.exclusions, categoriesAssigned: false };
  const save = () => writeFileSync(join(observer, 'manifest.json'), encode(observed)); save();
  return { root, observer, directory, observed, row, file, save, args: { configPath, scorePath, replayRoot: replay, expectedHelperSha: helper, outputPath: join(root, 'report.json') }, load: () => loadTlinkCategoryInputs(configPath, scorePath, replay, helper),
    rewriteRow: () => { const data = encode(row), zipped = gzipSync(data); file.sha256 = sha(zipped); file.rawSha256 = sha(data); writeFileSync(join(observer, file.file), zipped); save(); } };
}

test('authenticates original score, source cohort and exhaustive actual differences without categories', () => {
  const f = fixture(); try {
    const result = f.load(); assert.equal(result.rows.length, 1); assert.equal(result.unclassified.length, 0);
    assert.deepEqual(result.rows[0].deltaPaths[0].path, ['treasuryCoin']); assert.equal(result.rows[0].categoriesAssigned, false);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('rejects tampered compressed artifact, duplicate rows and missing rows', () => {
  for (const variant of ['tamper', 'duplicate', 'missing']) {
    const f = fixture(); try {
      if (variant === 'tamper') writeFileSync(join(f.observer, f.file.file), 'bad');
      if (variant === 'duplicate') { f.observed.files.push(f.file); f.save(); }
      if (variant === 'missing') { f.observed.files = []; f.save(); }
      assert.throws(f.load, /hash mismatch|answer count mismatch/);
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  }
});

test('accepts official seed sidecars while rejecting an unexpected seed directory', () => {
  const f = fixture(); try {
    writeFileSync(join(f.args.replayRoot, 'seed-1.exit-code'), '0\n');
    writeFileSync(join(f.args.replayRoot, 'seed-1.log'), 'completed\n');
    assert.equal(f.load().rows.length, 1);
    mkdirSync(join(f.args.replayRoot, 'seed-2'));
    assert.throws(f.load, /observer seed set mismatch/);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('rejects rehashed omitted delta, state drift and traversal', () => {
  for (const variant of ['delta', 'state', 'checkpoint', 'traversal']) {
    const f = fixture(); try {
      if (variant === 'delta') { f.row.differences = []; f.rewriteRow(); }
      if (variant === 'state') { f.row.after.treasuryCoin = 99; f.rewriteRow(); }
      if (variant === 'checkpoint') { f.row.after.treasuryCoin = 99; f.row.afterRuleSha256 = sha(JSON.stringify(f.row.after)); f.row.differences = tlinkImmediateDifferences(f.row.before, f.row.after); f.rewriteRow(); }
      if (variant === 'traversal') { f.file.file = '../answer-000001.json.gz'; f.save(); }
      assert.throws(f.load, /differences incomplete|canonical state hash|invalid observer file|original checkpoint/);
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  }
});

test('rejects failed capture and original input replacement even with matching observer hash', () => {
  const f = fixture(); try {
    writeFileSync(join(f.observer, 'failure.json'), '{}'); assert.throws(f.load, /failed\/incomplete/);
    rmSync(join(f.observer, 'failure.json'));
    const replacement = Buffer.from('{}'); writeFileSync(join(f.directory, 'collect-parity.json'), replacement);
    f.observed.inputHashes['collect-parity.json'] = sha(replacement); f.save(); assert.throws(f.load, /original parity incomplete/);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('CLI runner never overwrites a report or emits partial output on invalid capture', async () => {
  const f = fixture(); try {
    writeFileSync(f.args.outputPath, 'preserve');
    await assert.rejects(runTlinkOutcomeCategories(f.args), /new report output required/);
    rmSync(f.args.outputPath);
    writeFileSync(join(f.observer, 'failure.json'), '{}');
    await assert.rejects(runTlinkOutcomeCategories(f.args), /failed\/incomplete/);
    assert.throws(() => readFileSync(f.args.outputPath), /ENOENT/);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('full CLI preserves original score and emits compact classification with correct exit for reviewed and unknown sources', () => {
  for (const reviewed of [true, false]) {
    const f = fixture(reviewed); try {
      const run = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/engineBTlinkOutcomeCategoriesRun.mjs', import.meta.url)),
        f.args.configPath, f.args.scorePath, f.args.replayRoot, f.args.expectedHelperSha, f.args.outputPath], { encoding: 'utf8' });
      assert.equal(run.status, reviewed ? 0 : 1, run.stderr);
      const report = JSON.parse(readFileSync(f.args.outputPath, 'utf8'));
      assert.deepEqual(report.originalScore, JSON.parse(readFileSync(f.args.scorePath, 'utf8')));
      assert.equal(report.originalScoreSha256, sha(readFileSync(f.args.scorePath)));
      assert.equal(report.answers[0].category, reviewed ? 'outcome-visible' : 'explanation-incomplete');
      assert.equal(report.summary.prototypeGate.pass, reviewed);
      assert.equal(report.capture.heavyAnswers, 1);
      assert.equal(report.capture.artifacts.length, 1);
      assert.equal(report.provenance.manifests.length, 1);
      assert.ok(report.semanticEvidence.rows.length === 1);
      assert.equal(Object.hasOwn(report.answers[0], 'before'), false);
      const printed = JSON.parse(run.stdout.trim());
      assert.deepEqual(printed.summary, report.summary);
      assert.equal(Object.hasOwn(printed, 'answers'), false);
      assert.ok(run.stdout.length < 5000);
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  }
});


test('embedded producer capture is authenticated against its original pinned helper and exact execution revision', () => {
  const f = fixture(true, true); try {
    assert.equal(f.load().rows.length, 1);
    f.observed.executionHead = 'f'.repeat(40); f.save();
    assert.throws(f.load, /embedded observer source/);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
  const legacy = fixture(); try {
    Object.assign(legacy.observed, { capturePhase: 'producer_replay' }); legacy.save();
    assert.throws(legacy.load, /embedded observer source/);
  } finally { rmSync(legacy.root, { recursive: true, force: true }); }
});
