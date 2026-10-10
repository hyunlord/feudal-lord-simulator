import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { assertGameStateSnapshot, decodeSave, encodeSave } from '../src/save/saveCodec';
import { initialAgency } from '../src/engine/townAgency';
import { gameReducer } from '../src/state/gameStore';
import { answerEffects, retainAnswer } from '../src/engine/decisionTraceAnswers';
import { captureAnswerEffects } from '../src/engine/answerEffectCapture';
import type { GameState } from '../src/engine/engine.types';
import { migrateV56ToV57 } from '../src/save/migrations/v56ToV57';
const base = (): GameState => ({ ...decodeSave(new Uint8Array(readFileSync('fixtures/saves/v49/chapter-two-town.save.json'))).envelope.state,
  agency: initialAgency(), trace: { decisions: [], acts: [] } });
const roundTrip = (state: GameState) => decodeSave(encodeSave({ state, createdAt: '2026-10-10T00:00:00Z', savedAt: '2026-10-10T00:00:00Z' }).bytes).envelope.state;

test('market dues retain actual values and arithmetic difference, independent of later state', () => {
  const before = base();
  const after = gameReducer(before, { type: 'set_market_dues', permille: 1200 });
  const id = after.trace?.answers?.at(-1)?.id; assert.ok(id);
  const row = answerEffects(after, id)?.find(effect => effect.path.join('.') === 'agency.duesPermille');
  assert.deepEqual(row, { target: 'condition', path: ['agency', 'duesPermille'], before: 1000, after: 1200, beforePresent: true, afterPresent: true, delta: 200 });
  const later = gameReducer(after, { type: 'set_market_dues', permille: 800 });
  assert.deepEqual(answerEffects(later, id), answerEffects(after, id));
  assert.deepEqual(answerEffects(roundTrip(later), id), answerEffects(after, id));
});
test('unknown legacy absence is distinct from a recorded zero-effect answer', () => {
  const state = base();
  const after = retainAnswer(state, state, { id: 'h-test', tick: state.tick, by: 'lord', kind: 'audit', source: 'audit:tolerate:a', weights: [], targets: [] }, 'h-test');
  assert.deepEqual(answerEffects(after, 'h-test'), []);
  assert.equal(answerEffects(after, 'unknown'), undefined);
  const legacy = migrateV56ToV57({ schemaVersion: 56, state });
  assert.deepEqual(legacy, { schemaVersion: 57, state });
  assert.equal(answerEffects(state, 'h-test'), undefined);
});
test('snapshots copy scalars rather than retaining mutable domain values', () => {
  const before = base();
  const after = { ...before, diplomacy: { negotiations: [], promises: [], relations: { neighbour: 4 }, nextNegotiation: 1, nextPromise: 1 } };
  const effects = captureAnswerEffects(before, after);
  after.diplomacy.relations.neighbour = 90;
  const relation = effects.find(row => row.path.join('.') === 'diplomacy.relations.neighbour');
  assert.equal(relation?.before, 0); assert.equal(relation?.after, 4); assert.equal(relation?.delta, 4);
});
test('only bookkeeping changes cannot manufacture an effect', () => {
  const before = base();
  const after = { ...before, tick: before.tick + 1, nextConstructionOrdinal: before.nextConstructionOrdinal + 1 };
  assert.deepEqual(captureAnswerEffects(before, after), []);
});
test('changed booleans, missing numbers and removed entities preserve presence without invented arithmetic', () => {
  const before = base();
  const after = { ...before, agency: { ...initialAgency(), duesAgreement: { tick: 2, occurrenceId: 'o', permille: 750, faction: 'merchants' } } };
  const effects = captureAnswerEffects(before, after);
  const agreement = effects.find(row => row.path.join('.') === 'agency.duesAgreement.permille');
  assert.equal(agreement?.beforePresent, false); assert.equal(agreement?.after, 750); assert.equal(agreement?.delta, null);
  const reversed = captureAnswerEffects(after, before).find(row => row.path.join('.') === 'agency.duesAgreement.permille');
  assert.equal(reversed?.afterPresent, false); assert.equal(reversed?.before, 750);
});
test('malformed snapshots are rejected at the save boundary', () => {
  const state = gameReducer(base(), { type: 'set_market_dues', permille: 1200 });
  const answer = state.trace?.answers?.at(-1); assert.ok(answer && state.trace);
  const effect = answer.effects?.[0]; assert.ok(effect);
  for (const effects of [null, [{}], [{ ...effect, delta: 9999 }], [{ ...effect, target: 'fake' }], [effect, effect],
    [{ ...effect, before: NaN }], [{ ...effect, beforePresent: false, before: 3 }], [{ ...effect, path: [] }]]) {
    assert.throws(() => assertGameStateSnapshot({ ...state, trace: { ...state.trace, answers: [{ ...answer, effects }] } }), /effects/);
  }
});
test('nonlord commands never create answer snapshots and traced recording changes no reducer domain state', () => {
  const state = base(); const { agency: _agency, ...native } = state;
  const after = gameReducer(native, { type: 'set_market_dues', permille: 1200 });
  assert.equal(after.trace?.answers, undefined);
  const changed = { ...state, treasuryCoin: state.treasuryCoin + 1 };
  const recorded = retainAnswer(state, changed, { id: 'h-test', tick: state.tick, by: 'lord', kind: 'audit', source: 'audit', targets: [], weights: [] }, 'h-test');
  const { trace: _old, ...expected } = changed; const { trace: _new, ...actual } = recorded;
  assert.deepEqual(actual, expected);
});
test('famine relief records the live seasonal instruction, not its duplicate decision-log entry', () => {
  const state = base();
  const before: GameState = { ...state, events: { records: [{ id: 'famine-test', defId: 'great_famine', kind: 'dearth',
    season: 0, arrivalTick: state.tick, losses: { burntHouses: 0, departures: 0, harvestLost: 0 } }], burning: [] } };
  const after = gameReducer(before, { type: 'famine_response', choice: 'relief' });
  const answer = after.trace?.answers?.at(-1); assert.ok(answer);
  const effects = answerEffects(after, answer.id); assert.ok(effects);
  assert.equal(effects.find(row => row.path.join('.') === 'events.records.famine-test.response.choice')?.after, 'relief');
  assert.ok(effects.every(row => row.path[0] !== 'politics' || row.path[1] !== 'decisions'));
});
