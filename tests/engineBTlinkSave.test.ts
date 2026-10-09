import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { GameState } from '../src/engine/engine.types';
import { initialAgency } from '../src/engine/townAgency';
import { gameReducer } from '../src/state/gameStore';
import { assertGameStateSnapshot, decodeSave, encodeSave } from '../src/save/saveCodec';
import { migrateV54ToV55 } from '../src/save/migrations/v54ToV55';
import { SAVE_SCHEMA_VERSION } from '../src/save/saveTypes';

function answered(): GameState {
  const state = decodeSave(new Uint8Array(readFileSync('fixtures/saves/v49/chapter-two-town.save.json'))).envelope.state;
  const after = gameReducer({ ...state, agency: initialAgency() }, { type: 'set_market_dues', permille: 1200 });
  assert.ok(after.trace?.answers?.length);
  return after;
}
const reload = (state: GameState) => decodeSave(encodeSave({ state, createdAt: '2026-10-10T00:00:00Z', savedAt: '2026-10-10T00:00:00Z' }).bytes).envelope.state;

test('v54 migration preserves unknown membership without deriving answers from aliases', () => {
  const state = { tick: 2, trace: { decisions: [{ id: 'h-1', also: ['registry:ck_evt_083:a'] }], acts: [] } };
  const before = structuredClone(state);
  assert.deepEqual(migrateV54ToV55({ schemaVersion: 54, state }), { schemaVersion: 55, state: before });
  assert.deepEqual(state, before);
  assert.throws(() => migrateV54ToV55({ schemaVersion: 54 }), /state/);
});
test('actual command own-answer state roundtrips without changes', () => {
  const state = answered();
  assert.equal(SAVE_SCHEMA_VERSION, 56, 'isolated provisional number; engine integration must renumber the GROW collision');
  assert.deepEqual(reload(state), state);
});
test('old saves and pruned roots do not require invented answer membership', () => {
  const state = answered();
  assert.ok(state.trace);
  const { answers: _answers, ...legacy } = state.trace;
  const restored = reload({ ...state, trace: legacy });
  assert.equal(Object.hasOwn(restored.trace ?? {}, 'answers'), false);
  assert.deepEqual(reload({ ...state, trace: { ...state.trace, decisions: [] } }).trace?.answers, state.trace.answers);
});
test('malformed own-answer data fails save validation', () => {
  const state = answered();
  const answer = state.trace?.answers?.[0]; assert.ok(answer);
  const invalid: readonly unknown[] = [null, {}, [null], [{ ...answer, id: '' }], [answer, answer],
    [{ ...answer, tick: -1 }], [{ ...answer, tick: state.tick + 1 }], [{ ...answer, threadId: 2 }],
    [{ ...answer, kind: 'invented' }], [{ ...answer, by: 'nobody' }], [{ ...answer, weights: ['invented'] }],
    [{ ...answer, targets: ['dues', 'dues'] }], [{ ...answer, source: '' }], [{ ...answer, memoryEvidence: null }],
    [{ ...answer, memoryEvidence: [{ factionId: 'f', recordId: 'h-x', tick: answer.tick, delta: NaN, reason: answer.source }] }],
    [{ ...answer, memoryEvidence: [{ factionId: 'f', recordId: 'h-x', tick: answer.tick + 1, delta: 1, reason: answer.source }] }],
  ];
  for (const answers of invalid) assert.throws(() => assertGameStateSnapshot({ ...state, trace: { ...state.trace, answers } }), /trace.answers/);
});
test('retained memory evidence is structurally validated without requiring still-live faction memory', () => {
  const state = answered(); const answer = state.trace?.answers?.[0]; assert.ok(answer && state.trace);
  const memory = { factionId: 'removed-faction', recordId: 'h-retained', tick: answer.tick, delta: -2, reason: answer.source };
  const preserved = { ...state, trace: { ...state.trace, answers: [{ ...answer, memoryEvidence: [memory] }] } };
  assert.deepEqual(reload(preserved).trace?.answers, preserved.trace.answers);
  assert.throws(() => assertGameStateSnapshot({ ...preserved, trace: { ...preserved.trace, answers: [{ ...answer, memoryEvidence: [memory, memory] }] } }), /trace.answers/);
});

test('v54 envelope decoding leaves legacy membership absent', () => {
  const state = answered(); assert.ok(state.trace);
  const { answers: _answers, ...trace } = state.trace;
  const bytes = encodeSave({ state: { ...state, trace }, createdAt: '2026-10-10T00:00:00Z', savedAt: '2026-10-10T00:00:00Z' }).bytes;
  const envelope: unknown = JSON.parse(new TextDecoder().decode(bytes));
  assert.ok(typeof envelope === 'object' && envelope !== null);
  const decoded = decodeSave(new TextEncoder().encode(JSON.stringify({ ...envelope, schemaVersion: 54 })));
  assert.equal(decoded.migratedFrom, 54);
  assert.equal(Object.hasOwn(decoded.envelope.state.trace ?? {}, 'answers'), false);
});
test('prepared fingerprint fixture contains real own answers and nested memory evidence', () => {
  const state = decodeSave(new Uint8Array(readFileSync('fixtures/saves/v55/eb-tlink-own-answer.save.json'))).envelope.state;
  assert.equal(state.trace?.answers?.length, 2);
  assert.ok(state.trace?.answers?.some(answer => answer.memoryEvidence.length > 0));
  assert.deepEqual(reload(state), state);
});
