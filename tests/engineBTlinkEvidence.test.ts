import test from 'node:test';
import assert from 'node:assert/strict';
import type { HistoryRecord } from '../src/engine/history.types';
import { readDecisionLedgerEvidence } from '../src/engine/decisionTraceEvidence';

const dues = { answerId: 'answer-dues', target: 'dues', key: 'payment_flow', entryId: 'ledger-1', tick: 1200,
  account: 'cash', category: 'stall_fee', amount: 12, sourceRefs: [{ type: 'policy', id: 'market_dues' }] };
const rent = { answerId: 'answer-rent', target: 'rent:estate:piece', key: 'suit_rent', entryId: 'ledger-2', tick: 1300,
  account: 'cash', category: 'rent', amount: 8, sourceRefs: [{ type: 'claim', id: 'suit-1', detail: 'rent' }] };
function record(rows: readonly unknown[] = [dues, rent]): HistoryRecord {
  return { id: 'season', tick: 2000, kind: 'ledger', template: 'ledger.season', subject: { type: 'town', id: 'town' }, severity: 0,
    params: { tracePeriodStart: 1000, tracePeriodEnd: 2000, traceLedgerEvidence: JSON.stringify(rows) },
    because: [{ decisionId: dues.answerId, key: dues.key, part: true }, { decisionId: rent.answerId, key: rent.key, part: true }] };
}

test('one season receipt preserves distinct answer/target/entry mappings without mixing causes', () => {
  assert.deepEqual(readDecisionLedgerEvidence(record(), dues.answerId), [dues]);
  assert.deepEqual(readDecisionLedgerEvidence(record(), rent.answerId), [rent]);
  assert.deepEqual(readDecisionLedgerEvidence(record(), 'unknown'), []);
});
test('wrong answer/key ownership and missing causes fail the whole evidence envelope closed', () => {
  for (const because of [[], [{ decisionId: 'other', key: dues.key }], [{ decisionId: dues.answerId, key: 'right_income' }]])
    assert.deepEqual(readDecisionLedgerEvidence({ ...record([dues]), because }, dues.answerId), []);
  assert.deepEqual(readDecisionLedgerEvidence(record([dues, { ...rent, answerId: 'other' }]), dues.answerId), []);
});
test('invalid JSON, row shapes, ledger categories and source references fail closed', () => {
  assert.deepEqual(readDecisionLedgerEvidence({ ...record(), params: { traceLedgerEvidence: '{' } }, dues.answerId), []);
  for (const row of [null, [], { ...dues, amount: 0 }, { ...dues, amount: 1.5 }, { ...dues, account: 'arrears' },
    { ...dues, category: 'opening_balance' }, { ...dues, category: 'invented' }, { ...dues, key: 'invented' },
    { ...dues, sourceRefs: [] }, { ...dues, sourceRefs: [{ type: 'invented', id: 'x' }] },
    { ...dues, sourceRefs: [{ type: 'policy', id: '' }] }, { ...dues, sourceRefs: [{ type: 'policy', id: 'x', detail: 3 }] }])
    assert.deepEqual(readDecisionLedgerEvidence(record([row]), dues.answerId), []);
});
test('invalid periods, out-of-period ticks and wrong receipt templates fail closed', () => {
  for (const tick of [999, 2001, -1, 1200.5])
    assert.deepEqual(readDecisionLedgerEvidence(record([{ ...dues, tick }]), dues.answerId), []);
  for (const bounds of [{ tracePeriodStart: 2000, tracePeriodEnd: 1000 }, { tracePeriodStart: 1000, tracePeriodEnd: 1999 },
    { tracePeriodStart: -1, tracePeriodEnd: 2000 }])
    assert.deepEqual(readDecisionLedgerEvidence({ ...record(), params: { ...record().params, ...bounds } }, dues.answerId), []);
  assert.deepEqual(readDecisionLedgerEvidence({ ...record(), template: 'consequence' }, dues.answerId), []);
  assert.deepEqual(readDecisionLedgerEvidence({ ...record(), kind: 'event' }, dues.answerId), []);
});
test('ambiguous duplicate targets and contradictory versions of the same posting reject the envelope', () => {
  for (const rows of [[dues, dues], [dues, { ...dues, entryId: 'another' }], [dues, { ...rent, entryId: dues.entryId }]])
    assert.deepEqual(readDecisionLedgerEvidence(record(rows), dues.answerId), []);
});
test('record-only reader accepts either cadence endpoint and does not mutate the stored record', () => {
  for (const tick of [1000, 2000]) {
    const input = record([{ ...dues, tick }]), before = JSON.stringify(input);
    assert.equal(readDecisionLedgerEvidence(input, dues.answerId)[0]?.tick, tick);
    assert.equal(JSON.stringify(input), before);
  }
});

test('the same posting can support distinct answer targets when its actual posting fields agree', () => {
  const other = { ...dues, answerId: rent.answerId, target: 'flow:stall_fee' };
  const input = { ...record([dues, other]), because: [
    { decisionId: dues.answerId, key: dues.key }, { decisionId: other.answerId, key: other.key },
  ] };
  assert.deepEqual(readDecisionLedgerEvidence(input, other.answerId), [other]);
});
