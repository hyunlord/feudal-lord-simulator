import assert from 'node:assert/strict';
import test from 'node:test';
import { LORD_SLICE_SCENARIO_ID } from '../src/content/lordSliceConfig';
import { newGameState } from '../src/state/newGame';
import { bindEntry, v4Candidates, v4Entry } from '../src/engine/registryV4';
import { createRegistryBindingDiagnostic, registerRegistryCandidateObserver, registryCandidateObserverFailures,
  type RegistryCandidateObservation } from '../src/engine/registryCandidateObservation';

test('observer sees actual gates without changing candidates or state and detaches', () => {
  const state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 1 });
  assert.ok(state);
  const before = JSON.stringify(state);
  const baseline = v4Candidates(state, []);
  const rows: RegistryCandidateObservation[] = [];
  const close = registerRegistryCandidateObserver(row => { rows.push(row); });
  try { assert.deepEqual(v4Candidates(state, []), baseline); } finally { close(); }
  assert.equal(JSON.stringify(state), before);
  assert.equal(rows.length, 56);
  assert.ok(rows.every(row => Object.isFrozen(row)));
  assert.deepEqual(rows.filter(row => row.gate === 'accepted').map(row => row.entryId), baseline.map(candidate => candidate.entry.id));
  assert.ok(rows.some(row => row.gate === 'accepted'));
  assert.equal(rows.find(row => row.entryId === 'ck_evt_080')?.gate, 'year');
  assert.equal(rows.find(row => row.entryId === 'ck_evt_174')?.gate, 'year');
  assert.equal(rows.find(row => row.entryId === 'ck_evt_002')?.gate, 'season');
  v4Candidates(state, []);
  assert.equal(rows.length, 56);
});

test('binder distinguishes missing targets from failed conditions', () => {
  const state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 1 });
  assert.ok(state);
  const target = v4Entry('ck_evt_002');
  assert.ok(target);
  const missing = createRegistryBindingDiagnostic();
  assert.equal(bindEntry(state, target, undefined, missing), null);
  assert.ok(missing.missingBindings.estate);
  const condition = createRegistryBindingDiagnostic();
  assert.equal(bindEntry(state, { ...target, bindings: {}, conditions: { literal: false } }, undefined, condition), null);
  assert.equal(condition.combinations, 1);
  assert.equal(condition.conditionFailures, 1);
});

test('observer failure is counted without changing candidates', () => {
  const state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 1 });
  assert.ok(state);
  const expected = v4Candidates(state, []);
  const failures = registryCandidateObserverFailures();
  const close = registerRegistryCandidateObserver(() => { throw new Error('observer only'); });
  try { assert.deepEqual(v4Candidates(state, []), expected); } finally { close(); }
  assert.equal(registryCandidateObserverFailures() - failures, 56);
});

test('actual traversal reports annual cap, cooldown and once-used before binding', () => {
  const initial = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 1 });
  assert.ok(initial);
  const rows: RegistryCandidateObservation[] = [];
  const close = registerRegistryCandidateObserver(row => { rows.push(row); });
  try {
    v4Candidates({ ...initial, tick: 1000 }, [{ entryId: 'ck_evt_002', offeredTick: 1000, status: 'answered' }]);
    v4Candidates({ ...initial, tick: 5000 }, [{ entryId: 'ck_evt_002', offeredTick: 1000, status: 'answered' }]);
    v4Candidates(initial, [{ entryId: 'ck_evt_024', offeredTick: 0, status: 'answered' }]);
  } finally { close(); }
  assert.equal(rows.find(row => row.tick === 1000 && row.entryId === 'ck_evt_002')?.gate, 'annual_cap');
  assert.equal(rows.find(row => row.tick === 5000 && row.entryId === 'ck_evt_002')?.gate, 'cooldown');
  assert.equal(rows.find(row => row.tick === 0 && row.entryId === 'ck_evt_024')?.gate, 'once_used');
});

test('binder counts real context rejection and combination cap without changing result', () => {
  const state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 1 });
  assert.ok(state);
  const contextual = v4Entry('ck_evt_083');
  assert.ok(contextual);
  const context = createRegistryBindingDiagnostic();
  assert.equal(bindEntry(state, contextual, undefined, context), bindEntry(state, contextual));
  assert.equal(context.contextFailures, 1);
  const entry = { ...contextual, id: 'diagnostic-fixture', conditions: { literal: false },
    bindings: { target: { from: { literal: Array.from({ length: 65 }, (_, id) => ({ id })) } } } };
  const diagnostic = createRegistryBindingDiagnostic();
  assert.equal(bindEntry(state, entry, undefined, diagnostic), bindEntry(state, entry));
  assert.equal(diagnostic.combinations, 64);
  assert.equal(diagnostic.conditionFailures, 64);
  assert.equal(diagnostic.truncated, true);
});
