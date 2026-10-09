import assert from 'node:assert/strict';
import test from 'node:test';
import type { GameState } from '../src/engine/engine.types';
import { advanceTick } from '../src/engine/tick';
import { canonicalTlinkRuleState } from '../scripts/engineBTlinkParity';
import { answer, delegated, repairTown } from './helpers/engineBTlinkFixtures';

const observationalParams = new Set(['sourceEntryId', 'displayEntryId', 'traceLedgerEvidence', 'tracePeriodStart', 'tracePeriodEnd', 'tracePetition', 'traceEstate']);
function withoutAnswerAnnotations(state: GameState): GameState {
  assert.ok(state.history);
  return { ...state, history: { ...state.history, records: state.history.records.map(record => ({ ...record,
    ...(record.params === undefined ? {} : { params: Object.fromEntries(Object.entries(record.params).filter(([key]) => !observationalParams.has(key))) }),
    ...(record.because === undefined ? {} : { because: record.because.filter(cause => !['decision_effect', 'petition_routed'].includes(cause.key)) }),
  })) } };
}

for (const [eventId, choice, setup] of [
  ['ck_evt_083', 'a', repairTown], ['ck_evt_140', 'a', delegated], ['ck_evt_061', 'b', delegated],
] as const) {
  test(`${eventId} observational history annotations do not change subsequent rule outputs`, () => {
    const answered = answer(setup(), eventId, choice).after;
    assert.ok(answered.history);
    let annotated: GameState = { ...answered, history: { ...answered.history, records: answered.history.records.map(record =>
      record.kind === 'decision' ? { ...record, params: { ...record.params, sourceEntryId: eventId, displayEntryId: eventId } } : record) } };
    let plain = withoutAnswerAnnotations(annotated);
    assert.ok(annotated.history);
    assert.notDeepEqual(plain.history, annotated.history);
    assert.deepEqual(plain.history?.records.filter(record => record.template === 'faction.relation'),
      annotated.history.records.filter(record => record.template === 'faction.relation'),
      'Faction relation because IDs must remain intact as gameplay inputs');
    for (let tick = 0; tick < 4; tick++) {
      annotated = advanceTick(annotated);
      plain = advanceTick(plain);
      assert.equal(canonicalTlinkRuleState(annotated), canonicalTlinkRuleState(plain));
      assert.equal(annotated.history?.nextOrdinal, plain.history?.nextOrdinal);
    }
  });
}
