import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createWriteStream, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { INERT_REVIEWED_EFFECT_SOURCES } from './engineBInertReviewedSources.mjs';
import { prepareOutcomeConfig, runOutcomeGate } from './engineBOutcomeRun.mjs';
import { outcomeSha256 as sha } from './engineBOutcomeArchive.mjs';
import { runTlinkOutcomeCategories } from './engineBTlinkOutcomeCategoriesRun.mjs';
import { summarizeInertAnnualHeavy, compareInertAnnualHeavy, evaluateInertGate } from './engineBInertMeasurement.mjs';

const self = fileURLToPath(import.meta.url);
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

export async function scoreInertCohort(root, contract, baselinePath, expectedBaselineSha) {
  const baselineBytes = readFileSync(baselinePath);
  assert.match(expectedBaselineSha, /^[a-f0-9]{64}$/);
  assert.equal(sha(baselineBytes), expectedBaselineSha, 'Baseline report SHA mismatch');
  const baseline = JSON.parse(baselinePath.endsWith('.gz') ? gunzipSync(baselineBytes) : baselineBytes);
  assert.equal(baseline.originalScoreUnmodified, true);
  assert.equal(baseline.summary.allAnswers, 836);
  assert.equal(baseline.summary.matureAnswers, 816);
  assert.equal(baseline.originalPrimaryMetric.numerator, 334);
  assert.deepEqual(baseline.summary.fourCategories, { a: 622, b: 194, c: 0,
    d: { total: 20, matureConditionUnmet: 0, outsideDenominatorInsufficientObservation: 20 } });
  const config = join(root, 'config.json'), score = join(root, 'legacy-score.json'), reportPath = join(root, 'categories.json');
  prepareOutcomeConfig(join(root, 'original'), contract, config);
  const legacy = runOutcomeGate(config, score);
  writeFileSync(join(root, 'legacy-scorer-exit-code'), `${legacy.pass ? 0 : 1}\n`, { flag: 'wx' });
  const helperSha = sha(readFileSync(new URL('engineBInertCapture.mjs', import.meta.url)));
  const report = await runTlinkOutcomeCategories({ configPath: config, scorePath: score,
    replayRoot: join(root, 'capture'), expectedHelperSha: helperSha, outputPath: reportPath });
  const baselineAnnual = summarizeInertAnnualHeavy(baseline.originalScore), annual = summarizeInertAnnualHeavy(legacy);
  assert.deepEqual(baselineAnnual.bySeed.map(({ total, median, max }) => [total, median, max]), [[245, 2, 5], [282, 2, 6], [309, 3, 6]]);
  const comparison = { schemaVersion: 1, baseline: { file: baselinePath, sha256: expectedBaselineSha,
    measuredSourceRevision: baseline.provenance.sourceRevision, requestedComparisonRevision: 'db750c16486a283e7f320ceaca70504589a00f93',
    limitation: 'The retained measurement is 23d; db750 differs in decision-card presentation. This is not a freshly executed db750 cohort.',
    summary: baseline.summary, legacy: baseline.originalPrimaryMetric }, current: { sourceRevision: report.provenance.sourceRevision,
    reportSha256: sha(readFileSync(reportPath)), legacyScoreSha256: sha(readFileSync(score)), summary: report.summary, legacy: report.originalPrimaryMetric },
    annualHeavy: compareInertAnnualHeavy(baselineAnnual, annual),
    limitations: ['Independent authentic cohorts; mature denominator and answer IDs may differ.',
      'Four-category and legacy results are separate; native guardrail and rendered UI acceptance remain separate evidence.'] };
  comparison.gate = evaluateInertGate(report, comparison.annualHeavy);
  writeFileSync(join(root, 'comparison.json'), json(comparison), { flag: 'wx' });
  writeFileSync(join(root, 'category-scorer-exit-code'), `${comparison.gate.pass ? 0 : 1}\n`, { flag: 'wx' });
  return comparison;
}

async function produce(seed, root, revision) {
  assert.match(revision, /^[a-f0-9]{40}$/);
  assert.equal(git('rev-parse', 'HEAD'), revision, 'Execution revision mismatch');
  assert.equal(git('status', '--porcelain'), '', 'Clean committed checkout required');
  assert.equal(process.platform, 'linux', 'Official Linux runner required');
  assert.equal(process.version, 'v24.21.0', 'Pinned measurement Node runtime required');
  for (const pin of INERT_REVIEWED_EFFECT_SOURCES)
    assert.equal(sha(readFileSync(pin.path)), pin.sha256, `Source changed after semantic review: ${pin.path}`);
  const { createInertCapture } = await import('./engineBInertCapture.mjs');
  const { produceOutcomeReplay } = await import('./engineBOutcomeProduce.ts');
  process.env.FLS_TLINK_PARITY = '1';
  produceOutcomeReplay(seed, join(root, 'original'), 125, createInertCapture(seed, join(root, 'capture', `seed-${seed}`)));
}

export async function runInertExperiment(root, revision, contract, baselinePath, baselineSha) {
  assert.equal(process.platform, 'linux', 'Official Linux runner required');
  assert.equal(process.env.DIRTY, '0', 'Official clean remote envelope required');
  assert.equal(process.env.FULL_SHA, revision, 'Official source envelope mismatch');
  mkdirSync(root); mkdirSync(join(root, 'capture'));
  const children = new Set();
  const terminate = () => { for (const child of children) child.kill('SIGTERM'); };
  process.once('SIGINT', terminate); process.once('SIGTERM', terminate);
  try {
    const results = await Promise.all([1, 2, 3].map(seed => new Promise((resolveSeed, reject) => {
      const log = createWriteStream(join(root, `seed-${seed}.log`), { flags: 'wx' });
      const child = spawn(process.execPath, ['--import', 'tsx', self, '--produce', String(seed), root, revision], { stdio: ['ignore', 'pipe', 'pipe'] });
      children.add(child); child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false });
      child.on('error', error => { log.end(); reject(error); });
      child.on('close', (code, signal) => {
        children.delete(child); log.end();
        writeFileSync(join(root, `seed-${seed}.exit-code`), `${code ?? 1}\n`, { flag: 'wx' });
        resolveSeed({ seed, exitCode: code ?? 1, signal });
      });
    })));
    writeFileSync(join(root, 'producer-status.json'), json(results), { flag: 'wx' });
    assert.ok(results.every(row => row.exitCode === 0), 'Incomplete seed capture; no cohort score');
    return await scoreInertCohort(root, contract, baselinePath, baselineSha);
  } finally { terminate(); process.removeListener('SIGINT', terminate); process.removeListener('SIGTERM', terminate); }
}

if (process.argv[1] && resolve(process.argv[1]) === self) {
  const [mode, ...args] = process.argv.slice(2);
  switch (mode) {
    case '--produce':
      assert.equal(args.length, 3, 'usage: --produce SEED ROOT REVISION');
      await produce(Number(args[0]), resolve(args[1]), args[2]); break;
    case '--score':
      assert.equal(args.length, 4, 'usage: --score ROOT CONTRACT BASELINE_REPORT EXPECTED_BASELINE_SHA');
      process.exitCode = (await scoreInertCohort(resolve(args[0]), resolve(args[1]), resolve(args[2]), args[3])).gate.pass ? 0 : 1; break;
    case '--experiment': {
      assert.equal(args.length, 5, 'usage: --experiment NEW_ROOT REVISION CONTRACT BASELINE_REPORT EXPECTED_BASELINE_SHA');
      const result = await runInertExperiment(resolve(args[0]), args[1], resolve(args[2]), resolve(args[3]), args[4]);
      console.log(json({ summary: result.current.summary, annualHeavy: result.annualHeavy }));
      process.exitCode = result.gate.pass ? 0 : 1; break;
    }
    default: throw new Error('usage: engineBInertRun.mjs --experiment|--score|--produce ...');
  }
}
