import test from 'node:test';
import assert from 'node:assert/strict';
import { compareReplayProjection, createReplayCheckpointSelector, passiveReplayObservation, replayIteration, replaySha, REPLAY_SOURCE, validateReplaySource, verifyRawBytes, verifyStateSerialization, verifyRegistryAnswerSet } from '../scripts/engineBAnswerReplay';
import { stateChecksum } from '../src/save/saveCodec';

test('source preflight accepts only exact engine/runtime/lock and two copied tools', () => {
  const source = { platform: 'linux', node: 'v24.21.0', revision: REPLAY_SOURCE, status: '?? scripts/engineBAnswerEvidence.ts\n?? scripts/engineBAnswerReplay.ts', lock: 'pinned', expectedLock: 'pinned' };
  assert.doesNotThrow(() => validateReplaySource(source));
  for (const change of [{ platform: 'darwin' }, { node: 'v24.20.0' }, { revision: 'other' }, { expectedLock: undefined }, { lock: 'other' }, { status: ' M src/engine/tick.ts' }, { status: '?? scripts/other.ts' }]) {
    assert.throws(() => validateReplaySource({ ...source, ...change }));
  }
});
test('archive integrity requires independent pin and preserves serialized state byte order', () => {
  const bytes = Buffer.from('{"seed":1}');
  assert.doesNotThrow(() => verifyRawBytes(bytes, replaySha(bytes)));
  assert.throws(() => verifyRawBytes(bytes, undefined));
  assert.throws(() => verifyRawBytes(Buffer.from('{"seed":2}'), replaySha(bytes)));
  const text = '{"tick":1,"seed":2}';
  assert.equal(verifyStateSerialization(text, { tick: 1, seed: 2 }, stateChecksum(text)), replaySha(text));
  assert.throws(() => verifyStateSerialization(text, { seed: 2, tick: 1 }, stateChecksum(text)), /normalized/);
  assert.throws(() => verifyStateSerialization(text, { tick: 1, seed: 2 }, 'bad'), /checksum/);
});
test('checkpoint selector waits for eligible trace even when history identity already exists', () => {
  const select = createReplayCheckpointSelector(['ck_evt_005']);
  const history = { records: [{ id: 'h-1', kind: 'decision', tick: 7, decision: { chosen: 'a' } }] };
  const state = { tick: 7, history } as unknown as import('../src/engine/engine.types').GameState;
  assert.deepEqual(select(state), []);
  const traced = { ...state, trace: { decisions: [{ id: 'h-1', kind: 'registry', by: 'lord', tick: 7, source: 'registry:ck_evt_005:a' }] } } as unknown as typeof state;
  assert.deepEqual(select(traced), [{ entryId: 'ck_evt_005', identity: 'h-1', phase: 'answer' }]);
  assert.deepEqual(select(traced), []);
  const later = { ...traced, tick: 8, history: { records: [...history.records,
    { id: 'receipt-b', kind: 'event', tick: 8, because: [{ decisionId: 'h-1' }] },
    { id: 'receipt-a', kind: 'event', tick: 8, because: [{ decisionId: 'h-1' }] }] } } as unknown as typeof state;
  assert.deepEqual(select(later), [{ entryId: 'ck_evt_005', identity: 'receipt-a', phase: 'consequence' }]);
  assert.deepEqual(select({ ...later, history: { ...later.history! } }), []);
});
test('deterministic collector comparison permits only unrelated raw envelope fields', () => {
  const actual = { decisions: [{ id: 'h-2' }], observation: { observations: 4 } };
  assert.doesNotThrow(() => compareReplayProjection(actual, { ...actual, seconds: 999 }));
  assert.throws(() => compareReplayProjection(actual, { decisions: [{ id: 'h-1' }], observation: actual.observation }), /decisions/);
  assert.throws(() => compareReplayProjection(actual, { decisions: actual.decisions, observation: { observations: 3 } }), /observation/);
});
test('collector comparison preserves JSON archive semantics for history fields and zero expense', () => {
  const actual = { history: [{ id: 'h-1', decision: { chosen: 'a', actual: undefined }, because: undefined }] };
  const archived = { history: [{ id: 'h-1', decision: { chosen: 'a' } }] };
  assert.doesNotThrow(() => compareReplayProjection(actual, archived));
  assert.throws(() => compareReplayProjection(actual, { history: [{ id: 'h-1', decision: { chosen: 'b' } }] }), /history/);
  assert.throws(() => compareReplayProjection(actual, { history: [{ id: 'h-1', decision: { chosen: 'a', actual: null } }] }), /history/);
  assert.throws(() => compareReplayProjection(actual, { history: [] }), /history/);
  assert.equal(Object.hasOwn(actual.history[0]!.decision, 'actual'), true);
  assert.doesNotThrow(() => compareReplayProjection({ history: [{ params: { income: 20, expense: -0 } }] }, { history: [{ params: { income: 20, expense: 0 } }] }));
  assert.throws(() => compareReplayProjection({ history: [{ params: { income: 20, expense: -0 } }] }, { history: [{ params: { income: 21, expense: 0 } }] }), /history/);
  assert.doesNotThrow(() => compareReplayProjection({ candidateObservation: { enabledChoices: undefined, count: 1 } }, { candidateObservation: { count: 1 } }));
  assert.throws(() => compareReplayProjection({ candidateObservation: { count: 1 } }, { candidateObservation: { count: 2 } }), /candidateObservation/);
});
test('passive recorder mutation guard checks both actual state objects', () => {
  const before = { tick: 7, data: { value: 1 } }, after = { tick: 7, data: { value: 2 } };
  assert.doesNotThrow(() => passiveReplayObservation(before, after, () => { structuredClone(before); structuredClone(after); }));
  assert.throws(() => passiveReplayObservation(before, after, () => { before.data.value = 9; }), /mutated/);
  assert.throws(() => passiveReplayObservation(before, after, () => { after.data.value = 9; }), /mutated/);
});

test('iteration computes commands once and preserves command, preclose, tick observer order including no-ops', () => {
  const phases: string[] = []; let calls = 0;
  const final = replayIteration(1, value => { calls += 1; assert.equal(value, 1); return [2, 0, 3]; },
    (state, command) => state + command,
    (before, after, command) => { phases.push(`command:${before}:${command}:${after}`); },
    state => { phases.push(`preclose:${state}`); },
    state => { phases.push(`tick:${state}`); return state + 10; },
    (before, after) => { phases.push(`observed:${before}:${after}`); });
  assert.equal(calls, 1); assert.equal(final, 16);
  assert.deepEqual(phases, ['command:1:2:3', 'command:3:0:3', 'command:3:3:6', 'preclose:6', 'tick:6', 'observed:6:16']);
});

test('registry answers require exact identity, weights, complete set and no unresolved sidecar rows', () => {
  const row = { occurrenceId: 'occ-1', answerHistoryId: 'h-1', entryId: 'ck_evt_005', choiceId: 'a', settledTick: 17, by: 'lord', weights: ['rights'] };
  assert.doesNotThrow(() => verifyRegistryAnswerSet([row], { answers: [{ ...row, extra: 'ignored summary detail' }], unresolved: [] }));
  assert.throws(() => verifyRegistryAnswerSet([], { answers: [row], unresolved: [] }), /set mismatch/);
  assert.throws(() => verifyRegistryAnswerSet([{ ...row, answerHistoryId: 'h-2' }], { answers: [row], unresolved: [] }), /set mismatch/);
  assert.throws(() => verifyRegistryAnswerSet([{ ...row, weights: [] }], { answers: [row], unresolved: [] }), /set mismatch/);
  assert.throws(() => verifyRegistryAnswerSet([row, row], { answers: [row], unresolved: [] }), /Duplicate/);
  assert.throws(() => verifyRegistryAnswerSet([row], { answers: [row], unresolved: [{ reason: 'missing' }] }), /unresolved/);
});
test('one original consequence receipt may satisfy distinct entry pairs without ambiguity', () => {
  const select = createReplayCheckpointSelector(['ck_evt_005', 'ck_evt_009']);
  const state = { tick: 7, trace: { decisions: ['005', '009'].map((id, index) => ({ id: `h-${index}`, kind: 'registry', by: 'lord', tick: 7, source: `registry:ck_evt_${id}:a` })) },
    history: { records: [0, 1].map(index => ({ id: `h-${index}`, kind: 'decision', tick: 7, decision: { chosen: 'a' } })) } } as unknown as import('../src/engine/engine.types').GameState;
  assert.equal(select(state).length, 2);
  const later = { ...state, tick: 8, history: { records: [{ id: 'shared', kind: 'event', tick: 8, because: [{ decisionId: 'h-0' }, { decisionId: 'h-1' }] }] } } as unknown as typeof state;
  assert.deepEqual(select(later), [{ entryId: 'ck_evt_005', identity: 'shared', phase: 'consequence' }, { entryId: 'ck_evt_009', identity: 'shared', phase: 'consequence' }]);
});
test('consequence window excludes same-tick receipts and accepts exactly +12000 but not +12001', () => {
  for (const [offset, accepted] of [[0, false], [12000, true], [12001, false]] as const) {
    const select = createReplayCheckpointSelector(['ck_evt_005']);
    const initial = { tick: 7, trace: { decisions: [{ id: 'h-1', kind: 'registry', by: 'lord', tick: 7, source: 'registry:ck_evt_005:a' }] },
      history: { records: [{ id: 'h-1', kind: 'decision', tick: 7, decision: { chosen: 'a' } }] } } as unknown as import('../src/engine/engine.types').GameState;
    assert.equal(select(initial).length, 1);
    const receipt = { ...initial, tick: 7 + offset, history: { records: [{ id: 'receipt', kind: 'event', tick: 7 + offset, because: [{ decisionId: 'h-1' }] }] } } as unknown as typeof initial;
    assert.equal(select(receipt).length, Number(accepted), `offset ${offset}`);
  }
});
