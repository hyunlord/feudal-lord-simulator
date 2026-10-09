import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceTimberTrade } from '../src/engine/timberTrade';
import { settleMoneyPeriod } from '../src/engine/moneyRules';
import { LEDGER_PERIOD_TICKS } from '../src/ledger/ledger';
import { answer, contribution, linked, repairTown, transition } from './helpers/engineBTlinkFixtures';

const nextPeriod = (tick: number) => Math.ceil((tick + 1) / LEDGER_PERIOD_TICKS) * LEDGER_PERIOD_TICKS;

test('ck_evt_083 timber answer owns timber delivery without borrowing unselected dues target', () => {
  const { after, ownId } = answer(repairTown(), 'ck_evt_083', 'a');
  assert.equal(after.timberOrder, 16);
  assert.ok(contribution(after, ownId).targets.includes('timber'));
  assert.ok(!contribution(after, ownId).targets.includes('dues'));
  const delivered = transition(after, 1040, advanceTimberTrade);
  assert.ok(delivered.actual.treasuryTimber > delivered.before.treasuryTimber);
  assert.ok(linked(delivered.after, ownId, 'goods_delivered').length > 0);
  const paid = transition(delivered.after, nextPeriod(delivered.after.tick), settleMoneyPeriod);
  assert.equal(linked(paid.after, ownId, 'payment_flow').filter(row => row.params?.target === 'dues').length, 0);
});

test('ck_evt_046 cancel stops the real timber order and produces no later delivery receipt', () => {
  const { after, ownId } = answer({ ...repairTown(), timberOrder: 16, treasuryTimber: 10 }, 'ck_evt_046', 'cancel');
  assert.equal(after.timberOrder ?? 0, 0);
  const delivered = transition(after, 1040, advanceTimberTrade);
  assert.equal(delivered.actual, delivered.before);
  assert.equal(linked(delivered.after, ownId, 'goods_delivered').length, 0);
});

for (const id of ['ck_evt_092', 'ck_evt_211']) {
  test(`${id} real dues income belongs to its latest own answer, not the preceding dues root`, () => {
    const first = answer(repairTown(), 'ck_evt_211', 'a');
    const later = answer({ ...first.after, tick: 1001 }, id, id === 'ck_evt_092' ? 'b' : 'a');
    assert.notEqual(later.ownId, first.ownId);
    assert.ok(contribution(later.after, later.ownId).targets.includes('dues'));
    const paid = transition(later.after, nextPeriod(later.after.tick), settleMoneyPeriod);
    assert.ok(paid.actual.ledger?.entries.some(row => row.tick === paid.actual.tick && row.category === 'stall_fee' && row.amount > 0), 'real stall fee posted');
    assert.ok(linked(paid.after, later.ownId, 'payment_flow').some(row => row.params?.target === 'dues'));
    assert.equal(linked(paid.after, first.ownId, 'payment_flow').filter(row => row.params?.target === 'dues').length, 0);
  });
}

for (const choice of ['c', 'd']) {
  test(`ck_evt_209 ${choice === 'c' ? 'cancel' : 'hold'} has no invented future delivery`, () => {
    const { after, ownId } = answer({ ...repairTown(), timberOrder: choice === 'c' ? 10 : 0 }, 'ck_evt_209', choice);
    assert.equal(after.timberOrder ?? 0, 0);
    const delivered = transition(after, 1040, advanceTimberTrade);
    assert.equal(delivered.actual, delivered.before);
    assert.equal(linked(delivered.after, ownId, 'goods_delivered').length, 0);
    assert.ok(!contribution(after, ownId).targets.includes('dues'));
    if (choice === 'd') assert.ok(contribution(after, ownId).memoryEvidence.some(memory => memory.delta === -2 && memory.reason === 'registry:ck_evt_209:d'));
  });
}
