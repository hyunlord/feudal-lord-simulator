import assert from 'node:assert/strict';
import test from 'node:test';
const { outcomeSha256 } = await import(new URL('../scripts/engineBOutcomeArchive.mjs', import.meta.url).href);
const { scoreTlinkOutcomeCategories } = await import(new URL('../scripts/engineBTlinkOutcomeCategories.mjs', import.meta.url).href);
const first = <T>(rows: T[]): T => { const row = rows[0]; assert.ok(row); return row; };

const pin = { path: 'src/engine/stewardship.ts', sha256: 'a'.repeat(64) };
const provenance = { sourceRevision: 'b'.repeat(40), sourceFiles: [pin] };
type Scenario = 'future' | 'immediate' | 'inert' | 'unknown' | 'condition' | 'censored';
function fixture(scenarios: Scenario[]) {
  const answers = scenarios.map((scenario, index) => ({ seed: index % 2 + 1, historyId: `h${index}`, ordinal: index + 1, tick: index,
    source: 'estate_petition:estate-1:charter_request:refused', command: 'answer_estate_petition', mature: scenario !== 'censored',
    status: scenario === 'future' ? 'direct' : scenario === 'censored' ? 'insufficient-observation' : 'unlinked',
    directReceipts: ['future', 'censored'].includes(scenario) ? [{ id: `r${index}`, tick: 1000 }] : [],
    conditionalExpectations: scenario === 'condition' ? [{ outcomeId: 'growth', condition: 'growth needed' }] : [] }));
  const original = { schemaVersion: 1, pass: false, answers, scope: { seeds: [1, 2] }, inputs: [{ sourceRevision: provenance.sourceRevision }],
    legacyDirectRatio: { numerator: scenarios.filter(value => value === 'future').length, denominator: answers.filter(answer => answer.mature).length, threshold: 0.8 } };
  const scoreBytes = Buffer.from(JSON.stringify(original));
  const rows = answers.map((answer, index) => ({ seed: answer.seed, historyId: answer.historyId, ordinal: answer.ordinal, tick: answer.tick, source: answer.source,
    proofComplete: scenarios[index] !== 'unknown', scope: { sourceFiles: [pin], relevantPaths: [['relations', 'merchants'], ['petition', 'status']] },
    effects: [{ path: ['relations', 'merchants'], kind: 'relation', beforePresent: true, before: -100, afterPresent: true, after: scenarios[index] === 'immediate' ? -90 : -100 },
      { path: ['petition', 'status'], kind: 'bookkeeping', beforePresent: true, before: 'open', afterPresent: true, after: 'refused' }],
    condition: scenarios[index] === 'condition' ? { outcomeId: 'growth', observed: false, expected: true, scope: 'entire_observation_window', evidence: [{ path: ['growth'], value: false }], sourceFiles: [pin] } : null }));
  return { scoreBytes, recomputedScore: original, evidence: { schemaVersion: 1, originalScoreSha256: outcomeSha256(scoreBytes), provenance, rows }, expectedProvenance: provenance };
}

test('preserves legacy score and denominator while distinguishing actual effects, bookkeeping, unknown and censored', () => {
  const input = fixture(['future', 'immediate', 'inert', 'unknown', 'condition', 'censored']);
  const snapshot = structuredClone(input.recomputedScore), report = scoreTlinkOutcomeCategories(input);
  assert.deepEqual(report.answers.map((row: { category: string }) => row.category), ['outcome-visible', 'outcome-visible', 'inert', 'explanation-incomplete', 'condition-unmet', 'insufficient-observation']);
  assert.deepEqual(report.originalScore, snapshot);
  assert.deepEqual(input.recomputedScore, snapshot);
  assert.equal(report.originalScoreSha256, outcomeSha256(input.scoreBytes));
  assert.equal(report.summary.matureAnswers, 5);
  assert.equal(report.summary.censoredAnswers, 1);
  assert.equal(report.answers[0].actualImmediateInert, true);
  assert.equal(report.answers[2].excludedBookkeepingChanges.length, 1);
  assert.equal(report.summary.prototypeGate.pass, false);
  assert.equal(report.bySeed.reduce((sum: number, row: { allAnswers: number }) => sum + row.allAnswers, 0), 6);
});

test('10% prototype and 80% final boundaries are independent and inclusive', () => {
  const pass = scoreTlinkOutcomeCategories(fixture(['future', 'immediate', 'immediate', 'immediate', 'immediate', 'immediate', 'immediate', 'immediate', 'inert', 'unknown']));
  assert.equal(pass.summary.prototypeGate.pass, true);
  assert.equal(pass.summary.finalGate.pass, true);
  const lowVisible = scoreTlinkOutcomeCategories(fixture(['inert', 'inert']));
  assert.equal(lowVisible.summary.prototypeGate.pass, true);
  assert.equal(lowVisible.summary.finalGate.pass, false);
  const noMature = scoreTlinkOutcomeCategories(fixture(['censored']));
  assert.equal(noMature.summary.prototypeGate.pass, false);
  assert.equal(noMature.summary.finalGate.pass, false);
});

test('rejects duplicate, missing, mislabeled, uncovered and altered-score evidence', () => {
  const duplicate = fixture(['inert', 'inert']); duplicate.evidence.rows[1] = first(duplicate.evidence.rows);
  assert.throws(() => scoreTlinkOutcomeCategories(duplicate), /duplicate proof/);
  const missing = fixture(['inert']); missing.evidence.rows.pop();
  assert.throws(() => scoreTlinkOutcomeCategories(missing), /answer\/seed count/);
  const label = fixture(['inert']); Object.assign(first(label.evidence.rows), { category: 'outcome-visible' });
  assert.throws(() => scoreTlinkOutcomeCategories(label), /identity\/category/);
  const uncovered = fixture(['inert']); first(uncovered.evidence.rows).effects.pop();
  assert.throws(() => scoreTlinkOutcomeCategories(uncovered), /uncovered paths/);
  const changedScore = fixture(['inert']); changedScore.recomputedScore.pass = true;
  assert.throws(() => scoreTlinkOutcomeCategories(changedScore), /differs from recomputed/);
});

test('rejects source mismatch and unsupported or partial-window condition claims', () => {
  const source = fixture(['inert']); first(source.evidence.rows).scope.sourceFiles = [{ ...pin, sha256: 'c'.repeat(64) }];
  assert.throws(() => scoreTlinkOutcomeCategories(source), /source mismatch/);
  const input = fixture(['condition']);
  const partialCondition = first(input.evidence.rows).condition; assert.ok(partialCondition);
  partialCondition.scope = 'answer_tick_only';
  assert.throws(() => scoreTlinkOutcomeCategories(input), /condition proof invalid/);
  const unknownCondition = fixture(['condition']);
  const inventedCondition = first(unknownCondition.evidence.rows).condition; assert.ok(inventedCondition);
  inventedCondition.outcomeId = 'invented';
  assert.throws(() => scoreTlinkOutcomeCategories(unknownCondition), /condition proof invalid/);
});

test('actual changes take priority over condition and missing proof does not become inert', () => {
  const input = fixture(['condition', 'unknown']); first(first(input.evidence.rows).effects).after = -80;
  const report = scoreTlinkOutcomeCategories(input);
  assert.equal(report.answers[0].category, 'outcome-visible');
  assert.equal(report.answers[1].reason, 'evidence_missing_not_proven_inert_or_conditional');
  assert.equal(report.answers[1].actualImmediateInert, false);
});

test('zero immediate effects do not settle an unproved future expectation', () => {
  const input = fixture(['condition']);
  first(input.evidence.rows).condition = null;
  const report = scoreTlinkOutcomeCategories(input);
  assert.equal(report.answers[0].actualImmediateInert, true);
  assert.equal(report.answers[0].category, 'explanation-incomplete');
  assert.equal(report.answers[0].reason, 'expected_future_unlinked');
});
