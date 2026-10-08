import assert from 'node:assert/strict';
import test from 'node:test';
import { createRegistryDecisionObservation } from '../scripts/registryDecisionObservation';
import { compactHistory } from '../src/engine/history';
import { summarizeRegistryGp7 } from '../scripts/registryGp7Summary';
import { newGameState } from '../src/state/newGame';
import { LORD_SLICE_SCENARIO_ID } from '../src/content/lordSliceConfig';
import type { GameState } from '../src/engine/engine.types';
import type { TracedDecision } from '../src/engine/decisionTrace.types';
import type { HistoryRecord } from '../src/engine/history.types';

const initial = (() => { const created = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 1 }); assert.ok(created); return created; })();
const decision: TracedDecision = { id: 'h-1', tick: 1, by: 'lord', kind: 'registry', source: 'registry:case:a', weights: ['rights'], targets: ['faction:church'] };
const record: HistoryRecord = { id: 'h-2', tick: 1, kind: 'event', template: 'town.changed', subject: { type: 'town', id: 'town' }, severity: 0,
  params: { count: 3 }, because: [{ decisionId: 'h-1', key: 'community_built' }] };
function state(tick: number, decisions: readonly TracedDecision[] = [], records: readonly HistoryRecord[] = []): GameState {
  return { ...initial, tick, trace: { decisions, acts: [] }, history: { records, snapshots: [], nextOrdinal: 3, seasonDecisions: {}, milestones: [], pendingActuals: [] } };
}

test('archives pruned decisions and chronicle identities without mutating state or prior snapshots', () => {
  // Given: the same immutable records are observed repeatedly before retention removes them.
  const collector = createRegistryDecisionObservation();
  const input = state(1, [decision], [record]);
  const bytes = JSON.stringify(input);
  collector.observe(state(0));
  collector.observe(input);
  const before = collector.snapshot();
  // When: the decision gains targets and the same history ID is seen again, then both are pruned.
  collector.observe(state(1, [{ ...decision, targets: [...decision.targets, 'right:market'] }], [record]));
  collector.observe(state(2));
  const result = collector.snapshot();
  // Then: deduplicated latest evidence survives; prior snapshots and input do not change.
  assert.equal(JSON.stringify(input), bytes);
  assert.deepEqual(before.decisions[0]?.targets, ['faction:church']);
  assert.deepEqual(result.decisions[0]?.targets, ['faction:church', 'right:market']);
  assert.equal(result.chronicle[0]?.count, 1);
  assert.equal(result.coverage.maxGap, 1);
  assert.equal(result.coverage.observations, 4);
});

test('uses engine heavy predicate rather than treating proactive or steward decisions as lord arrivals', () => {
  // Given: heavy answers, proactive commands and steward answers all carry weights.
  const collector = createRegistryDecisionObservation();
  // When: the trace is observed, including a lapsed decision.
  collector.observe(state(1, [decision, { ...decision, id: 'h-3', source: 'file_suit:neighbor' },
    { ...decision, id: 'h-4', by: 'steward' }, { ...decision, id: 'h-5', lapsed: true }]));
  // Then: only the engine's cameHeavyToLord decisions count; lapse is preserved.
  assert.deepEqual(collector.snapshot().decisions.map(row => [row.id, row.cameHeavyToLord]), [['h-1', true], ['h-3', false], ['h-4', false], ['h-5', true]]);
});

test('records coverage gaps and reversals and groups rollups separately with one example', () => {
  // Given: partial observation and two distinct records using the same template.
  const collector = createRegistryDecisionObservation();
  collector.observe(state(4, [], [record, { ...record, id: 'h-3' }]));
  // When: observation jumps and then reverses time.
  collector.observe(state(8, [], [{ ...record, id: 'h-4', kind: 'ledger', template: 'ledger.rollup' }]));
  collector.observe(state(7));
  // Then: gaps cannot be mistaken for complete sampling; templates remain separate.
  const result = collector.snapshot();
  assert.equal(result.coverage.maxGap, 4);
  assert.equal(result.coverage.timeReversals, 1);
  assert.equal(result.chronicle.length, 2);
  assert.deepEqual(result.chronicle.map(row => row.count), [2, 1]);
});


test('snapshot consumers cannot mutate nested game evidence or subsequent snapshots', () => {
  // Given: nested parameters, actors, causes and target arrays in engine-owned records.
  const collector = createRegistryDecisionObservation();
  const input = state(1, [decision], [record]);
  collector.observe(input);
  const snapshot = collector.snapshot();
  const row = snapshot.chronicle[0]?.example;
  const targets = snapshot.decisions[0]?.targets;
  assert.ok(row?.params && row.because?.[0] && targets);
  // When: an untyped snapshot consumer mutates nested values.
  Reflect.set(row.params, 'count', 99);
  Reflect.set(row.subject, 'id', 'changed');
  Reflect.set(row.because[0], 'key', 'changed');
  Reflect.set(targets, 0, 'changed');
  // Then: neither game state nor the archive is affected.
  assert.deepEqual(collector.snapshot().chronicle[0]?.example, { id: record.id, tick: record.tick, kind: record.kind,
    template: record.template, subject: record.subject, params: record.params, because: record.because });
  assert.deepEqual(collector.snapshot().decisions[0]?.targets, decision.targets);
  assert.equal(record.params?.count, 3);
});


test('real history compaction retains originals and the same-ID rollup as separate representations', () => {
  // Given: two foldable records just before a year boundary; compaction reuses the first ID.
  const collector = createRegistryDecisionObservation();
  const original: HistoryRecord = { id: 'h-fold', tick: 3999, kind: 'event', template: 'town.changed',
    subject: { type: 'town', id: 'town' }, severity: 0 };
  const before = state(3999, [], [original, { ...original, id: 'h-fold-2' }]);
  assert.ok(before.history);
  collector.observe(before);
  const compacted = compactHistory(before.history, 12000);
  assert.equal(compacted.records[0]?.id, original.id);
  assert.equal(compacted.records[0]?.template, 'ledger.rollup');
  // When: the real same-ID replacement and unchanged records are repeatedly observed.
  collector.observe({ ...before, tick: 12000, history: compacted });
  collector.observe({ ...before, tick: 12000, history: { ...compacted, records: [...compacted.records] } });
  const observation = collector.snapshot();
  const report = summarizeRegistryGp7(observation, { startYear: 1300, endYearExclusive: 1303 });
  // Then: the originals remain counted once and the year-boundary rollup is separately retained.
  assert.deepEqual(observation.chronicle.map(row => [row.year, row.template, row.count, row.example.id, row.example.tick]),
    [[1300, 'town.changed', 2, 'h-fold', 3999], [1301, 'ledger.rollup', 1, 'h-fold', 4000]]);
  assert.equal(observation.chronicle[1]?.example.params?.count, 2);
  assert.equal(report.annual[0]?.chronicleRecords, 2);
  assert.equal(report.annual[1]?.rollupRecords, 1);
  assert.equal(report.annual[1]?.chronicleRecords, 0);
});
