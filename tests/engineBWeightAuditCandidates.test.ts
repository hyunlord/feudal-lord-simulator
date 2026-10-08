import assert from 'node:assert/strict';
import test from 'node:test';
import { CandidateAuditInputError, createCandidateAuditCollector } from '../scripts/engineBWeightAuditCandidates';
import { publishRegistryCandidateObservations, registerRegistryCandidateObserver, registryCandidateObserverFailures,
  type RegistryCandidateObservation } from '../src/engine/registryCandidateObservation';

const sample: RegistryCandidateObservation = { tick: 1, entryId: 'ck_evt_135', gate: 'binding', combinations: 2,
  contextFailures: 1, conditionFailures: 1, truncated: false, missingBindings: '{"suit":2}' };

test('candidate aggregation preserves first/last and totals without growing raw observation lists', () => {
  const collector = createCandidateAuditCollector();
  for (let tick = 1; tick <= 1000; tick += 1) collector.observe({ ...sample, tick, truncated: tick === 1000 });
  collector.observe({ ...sample, gate: 'accepted', tick: 1001, enabledChoices: 3 });
  const result = collector.snapshot();
  assert.equal(result.observations, 1001);
  assert.equal(result.groups.length, 2);
  const binding = result.groups.find(row => row.gate === 'binding');
  assert.equal(binding?.first.tick, 1);
  assert.equal(binding?.last.tick, 1000);
  assert.equal(binding?.count, 1000);
  assert.equal(binding?.combinations, 2000);
  assert.equal(binding?.contextFailures, 1000);
  assert.equal(binding?.conditionFailures, 1000);
  assert.equal(binding?.truncatedCount, 1);
  assert.equal(binding?.missingBindings.suit, 2000);
  assert.equal(result.groups.find(row => row.gate === 'accepted')?.enabledChoicesTotal, 3);
});

test('candidate observer lifecycle stops collecting after cleanup without failures', () => {
  const collector = createCandidateAuditCollector();
  const before = registryCandidateObserverFailures();
  const cleanup = registerRegistryCandidateObserver(collector.observe);
  try { publishRegistryCandidateObservations([sample]); } finally { cleanup(); }
  publishRegistryCandidateObservations([sample]);
  assert.equal(collector.snapshot().observations, 1);
  assert.equal(registryCandidateObserverFailures(), before);
});

test('invalid diagnostic counters are rejected instead of silently corrupting totals', () => {
  const collector = createCandidateAuditCollector();
  assert.throws(() => collector.observe({ ...sample, missingBindings: '{"suit":"2"}' }), CandidateAuditInputError);
  assert.equal(collector.snapshot().observations, 0);
});

test('candidate evaluation range includes start and excludes the final boundary', () => {
  const collector = createCandidateAuditCollector(4000);
  for (const tick of [-1, 0, 3999, 4000, 4001]) collector.observe({ ...sample, tick });
  assert.equal(collector.snapshot().observations, 2);
  assert.equal(collector.snapshot().groups[0]?.first.tick, 0);
  assert.equal(collector.snapshot().groups[0]?.last.tick, 3999);
});
