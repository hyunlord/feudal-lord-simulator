import assert from 'node:assert/strict';
import test from 'node:test';
import { BALANCE } from '../src/content/balanceConfig';
import { LORD_SLICE_SCENARIO_ID } from '../src/content/lordSliceConfig';
import { newGameState } from '../src/state/newGame';
import { createWeightAuditCollector } from '../scripts/engineBWeightAuditCollector';
import type { RegistryOccurrence } from '../src/engine/registry.types';

test('report witnesses use real seasonal API boundaries; old-season settlements are not rescued by all-time queries', () => {
  const state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 1 });
  assert.ok(state);
  const season = BALANCE.TICKS_PER_YEAR / 4;
  const occurrence: RegistryOccurrence = { id: 'test-occ', entryId: 'ck_evt_058', boundId: '', offeredTick: 1,
    deadline: season * 3, status: 'answered', decidedBy: 'steward', receipt: { draw: 0, chancePermille: 1000, conditions: [] } };
  const collector = createWeightAuditCollector();
  collector.observe({ ...state, tick: season * 2, registry: { occurrences: [occurrence], terms: [], nextTerm: 1 } });
  assert.equal(collector.snapshot().reportLines.length, 0);
  const current = { ...occurrence, id: 'current-occ', offeredTick: season * 2 };
  collector.observe({ ...state, tick: season * 2, registry: { occurrences: [current], terms: [], nextTerm: 1 } });
  const line = collector.snapshot().reportLines[0];
  assert.equal(line?.reportFrom, season * 2);
  assert.equal(line?.reportTo, season * 2 + 1);
  assert.equal(line?.collectedAt, season * 2);
});

test('retention keeps seen occurrences and original decisions after later rollup representation', () => {
  const state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 1 });
  assert.ok(state);
  const collector = createWeightAuditCollector();
  const own = { id: 'h-test', tick: 0, kind: 'decision', template: 'decision.steward', severity: 1,
    subject: { type: 'town', id: 'town' }, params: { subjectId: 'occ-test' } } as const;
  collector.observe({ ...state, history: { records: [own], snapshots: [], nextOrdinal: 2, seasonDecisions: {}, milestones: [], pendingActuals: [] } });
  collector.observe({ ...state, tick: 1, history: { records: [{ ...own, kind: 'ledger', template: 'ledger.rollup' }], snapshots: [], nextOrdinal: 2, seasonDecisions: {}, milestones: [], pendingActuals: [] } });
  assert.equal(collector.snapshot().history[0]?.template, 'decision.steward');
  assert.equal(collector.snapshot().observation.maxGap, 1);
});
