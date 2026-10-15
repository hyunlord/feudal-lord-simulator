import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { advanceTrace } from '../src/engine/decisionTrace';
import type { GameState } from '../src/engine/engine.types';
import { advanceHistory } from '../src/engine/history';
import { advanceSeasons } from '../src/engine/seasonPressure';
import { initialAgency } from '../src/engine/townAgency';
import { postLedgerEntries } from '../src/ledger/ledger';
import type { LedgerCategory } from '../src/ledger/ledger.types';
import { decodeSave } from '../src/save/saveCodec';
import { gameReducer } from '../src/state/gameStore';
function base(): GameState {
  const { seasons: _seasons, history: _history, ...state } = decodeSave(new Uint8Array(readFileSync('fixtures/saves/v49/chapter-two-town.save.json'))).envelope.state;
  return advanceSeasons({ ...state, tick: 100, agency: initialAgency(), trace: { decisions: [], acts: [] } });
}
function fee(state: GameState, tick: number, category: LedgerCategory = 'stall_fee'): GameState {
  const actual = postLedgerEntries({ ...state, tick }, [{ account: 'cash', category, amount: 12, sourceRefs: [{ type: 'actor', id: 'fixture' }] }]);
  return advanceTrace(state, { ...state, tick, ledger: actual.ledger, treasuryCoin: actual.treasuryCoin });
}
function close(state: GameState, endTick = 1000) {
  const written = advanceHistory(state, advanceSeasons({ ...state, tick: endTick }));
  const after = advanceTrace(state, written);
  assert.equal(after.history?.nextOrdinal, written.history?.nextOrdinal);
  assert.deepEqual(after.ledger, written.ledger);
  const record = after.history?.records.find(row => row.template === 'ledger.season' && row.tick === endTick); assert.ok(record);
  return record;
}
test('actual season receipt links a later own answer even after its shared root first flow was emitted', () => {
  const first = gameReducer(base(), { type: 'set_market_dues', permille: 1200 });
  const paid = fee(first, 110);
  const second = gameReducer({ ...paid, tick: 200 }, { type: 'set_market_dues', permille: 650 });
  const root = first.trace?.decisions[0], own = second.trace?.answers?.at(-1); assert.ok(root && own && second.trace?.answers);
  // Membership fixture: real commands and postings, explicit shared-root topology rather than claiming dues naturally merge.
  const joined = { ...second, trace: { ...second.trace, decisions: [root], answers: second.trace.answers.map(row => row.id === own.id ? { ...row, threadId: root.id } : row) } };
  const paidAgain = fee(joined, 210);
  assert.equal(paidAgain.history?.records.some(row => row.tick === 210 && row.because?.some(cause => cause.decisionId === own.id)), false);
  const record = close(paidAgain);
  assert.ok(record.because?.some(cause => cause.decisionId === own.id && cause.key === 'payment_flow'));
  assert.equal(typeof record.params?.traceLedgerEvidence, 'string');
});
test('no future payment, same-tick payment and wrong-category payment cannot justify season attribution', () => {
  for (const variant of ['none', 'same-tick', 'wrong-target'] as const) {
    const answered = gameReducer(base(), { type: 'set_market_dues', permille: 1200 });
    const own = answered.trace?.answers?.at(-1); assert.ok(own);
    const state = variant === 'none' ? answered : fee(answered, variant === 'same-tick' ? 100 : 110, variant === 'wrong-target' ? 'rent' : 'stall_fee');
    assert.ok(!close(state).because?.some(cause => cause.decisionId === own.id));
  }
});
test('season attribution uses posting-time ownership and never the superseded setting', () => {
  const first = gameReducer(base(), { type: 'set_market_dues', permille: 1200 });
  const firstId = first.trace?.answers?.at(-1)?.id; assert.ok(firstId);
  const second = gameReducer({ ...first, tick: 200 }, { type: 'set_market_dues', permille: 650 });
  const secondId = second.trace?.answers?.at(-1)?.id; assert.ok(secondId);
  const record = close(fee(second, 210));
  assert.ok(record.because?.some(cause => cause.decisionId === secondId));
  assert.ok(!record.because?.some(cause => cause.decisionId === firstId));
});

test('earlier posting still belongs to its then-owner, but missing retained entries cannot be inferred from history', () => {
  const first = gameReducer(base(), { type: 'set_market_dues', permille: 1200 });
  const firstId = first.trace?.answers?.at(-1)?.id; assert.ok(firstId);
  const paid = fee(first, 110);
  const second = gameReducer({ ...paid, tick: 200 }, { type: 'set_market_dues', permille: 650 });
  const secondId = second.trace?.answers?.at(-1)?.id; assert.ok(secondId && second.ledger);
  const record = close(second);
  assert.ok(record.because?.some(cause => cause.decisionId === firstId));
  assert.ok(!record.because?.some(cause => cause.decisionId === secondId));
  const missing = { ...second, ledger: { ...second.ledger, entries: second.ledger.entries.filter(entry => entry.category !== 'stall_fee') } };
  assert.ok(!close(missing).because?.some(cause => cause.decisionId === firstId));
});


test('lord season includes the opening boundary posting and excludes the closing boundary posting in both totals and attribution', () => {
  const first = gameReducer(base(), { type: 'set_market_dues', permille: 1200 });
  const opened = advanceHistory(first, advanceSeasons({ ...first, tick: 1000 }));
  const opening = fee(opened, 1000);
  const both = fee(opening, 2000);
  const record = close(both, 2000);
  assert.equal(record.params?.income, 12);
  const evidence: unknown = JSON.parse(String(record.params?.traceLedgerEvidence));
  assert.ok(Array.isArray(evidence));
  assert.deepEqual(evidence.map(row => row.tick), [1000]);
  const onlyClosing = close(fee(opened, 2000), 2000);
  assert.equal(onlyClosing.params?.income, 0);
  assert.equal(onlyClosing.params?.traceLedgerEvidence, undefined);
});
