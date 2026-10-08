import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregateWeightAudits, validateWeightAuditRuns } from '../scripts/engineBWeightAuditReport.mjs';

const ids = Array.from({ length: 56 }, (_, index) => `ck_evt_${String(index + 1).padStart(3, '0')}`);
function fixtures() {
  return [1, 2, 3].map(seed => ({ schemaVersion: 1, seed, years: 125, startYear: 1300, endYearExclusive: 1425, endTick: 500000,
    provenance: { sourceRevision: 'a'.repeat(40), dirtyPaths: '' },
    support: { enabledIds: ids, observedIds: [] }, occurrences: [], presentations: [],
    observation: { firstTick: 0, lastTick: 500000, maxGap: 1, reversals: 0, observations: 500001, cadence: 'initial_and_every_command_attempt_and_tick' },
    candidateObservation: { observerFailures: 0, observations: 0, groups: [] },
    summary: { decisions: [], annual: Array.from({ length: 125 }, (_, offset) => ({ year: 1300 + offset,
      wholeGameHeavyResolved: 0, registryHeavyResolved: 0, priorBatchB11HeavyResolved: 0 })) } }));
}
const inventory = { historicalSourceRevision: 'b'.repeat(40), entries: ids.slice(0, 40).map(id => ({ id, historicalObservedCount: 0,
  calendar: { yearMinInclusive: 1430, yearMaxInclusive: 1450 } })) };

test('offline report retains all silent years, supported IDs, and exact historical inventory identities', () => {
  const report = aggregateWeightAudits(fixtures(), inventory);
  assert.equal(report.pooled.wholeGame.countedYears, 375);
  assert.equal(report.pooled.wholeGame.zeroYears, 375);
  assert.equal(report.perEntry.length, 56);
  assert.deepEqual(report.historical40.ids, inventory.entries.map(row => row.id));
  assert.equal(report.unobservedIds.length, 56);
  assert.equal(report.perEntry[0].suggestedClassification.category, 'era_outside_window');
  assert.equal(report.perEntry[0].exactAcceptedButUnofferedCount, null);
});

test('cross-revision, dirty, partial, failed observer, duplicate seeds and endpoint decisions are rejected', () => {
  for (const mutate of [
    rows => { rows[1].provenance.sourceRevision = 'b'.repeat(40); },
    rows => { rows[1].provenance.dirtyPaths = ' M source.ts'; },
    rows => { rows[1].observation.lastTick = 499999; },
    rows => { rows[1].candidateObservation.observerFailures = 1; },
    rows => { rows[1].seed = 1; },
    rows => { rows[1].summary.decisions = [{ id: 'boundary', tick: 500000, futureConsequenceCount: 0, consequences: [] }]; },
  ]) {
    const rows = fixtures(); mutate(rows);
    assert.throws(() => validateWeightAuditRuns(rows), /Audit report rejected/);
  }
});

test('nonempty reports preserve denominators and distinguish accepted evaluations from offered events', () => {
  const runs = fixtures();
  const run = runs[0];
  run.occurrences = [{ id: 'occ-1', entryId: ids[0], offeredTick: 1, weights: ['rights'] }];
  run.support.observedIds = [ids[0]];
  run.summary.decisions = [{ id: 'h-1', tick: 1, year: 1300, kind: 'registry', source: `registry:${ids[0]}:yes`,
    by: 'lord', weights: ['rights'], heavyToLord: true, priorBatchB11: false, mature: true, futureConsequenceCount: 0,
    consequences: [], firstConsequence: null }];
  run.summary.annual[0].wholeGameHeavyResolved = 1;
  run.summary.annual[0].registryHeavyResolved = 1;
  run.candidateObservation.observations = 4;
  run.candidateObservation.groups = [{ entryId: ids[0], gate: 'accepted', count: 4, first: { tick: 1 }, last: { tick: 100 },
    combinations: 4, contextFailures: 0, conditionFailures: 0, truncatedCount: 0, enabledChoiceObservations: 4, enabledChoicesTotal: 12, missingBindings: {} }];
  const report = aggregateWeightAudits(runs, inventory);
  assert.equal(report.pooled.wholeGame.total, 1);
  assert.equal(report.pooled.matureLord.denominator, 1);
  assert.equal(report.pooled.matureLord.fraction, 0);
  assert.deepEqual(report.perEntry[0].matureLord.withoutOutcome, [{ seed: 1, decisionId: 'h-1' }]);
  assert.equal(report.perEntry[0].acceptedEvaluationsMinusOffers, 3);
  assert.equal(report.perEntry[0].suggestedClassification.category, 'observed');
});

test('per-seed metrics are recomputed when raw cached metrics are absent or corrupt', () => {
  const runs = fixtures();
  runs[0].summary.wholeGame = { median: 999, total: 999 };
  runs[0].summary.trace = { forged: true };
  runs[0].summary.steward = { witnessed: 999 };
  runs[0].registryHeavyArrivalDensity = { maximum: 999 };
  const result = aggregateWeightAudits(runs, inventory);
  for (const seed of result.perSeed) {
    assert.equal(seed.wholeGame.total, 0);
    assert.equal(seed.trace.matureLord.denominator, 0);
    assert.equal(seed.steward.witnessed, 0);
    assert.equal(seed.registryHeavyArrivalDensity.maximum, 0);
  }
});

test('unknown registry sources and forged B11 membership are rejected', () => {
  for (const [source, priorBatchB11] of [['registry:ck_evt_999:yes', false], ['registry:home:woodland:grant', false], ['registry:ck_evt_001:yes', true]]) {
    const runs = fixtures();
    runs[0].summary.decisions = [{ id: 'h-1', tick: 1, year: 1300, kind: 'registry', source,
      by: 'lord', weights: [], heavyToLord: false, priorBatchB11, mature: true, futureConsequenceCount: 0, consequences: [] }];
    assert.throws(() => aggregateWeightAudits(runs, inventory), /registry source|B11 predicate/);
  }
});
