import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { advanceTrace, becauseOf, traceOf } from '../src/engine/decisionTrace';
import type { GameState } from '../src/engine/engine.types';
import { stewardshipOf } from '../src/engine/stewardship';
import { initialAgency } from '../src/engine/townAgency';
import { decodeSave } from '../src/save/saveCodec';
import { gameReducer } from '../src/state/gameStore';
import { postLedgerEntries } from '../src/ledger/ledger';
import { BALANCE } from '../src/content/balanceConfig';

function base(): GameState {
  const state = decodeSave(new Uint8Array(readFileSync('fixtures/saves/v49/chapter-two-town.save.json'))).envelope.state;
  return { ...state, tick: 100, agency: initialAgency(), stewardship: stewardshipOf(state), trace: { decisions: [], acts: [] } };
}
test('small own answers expire after ten years even when their retained thread is heavy', () => {
  const state = base();
  const root = { id: 'heavy-thread', tick: 100, by: 'lord' as const, kind: 'oversight' as const,
    source: 'set_estate_oversight', weights: ['rights' as const], targets: [] };
  const old = { ...root, id: 'small-answer', weights: [], threadId: root.id, memoryEvidence: [] };
  const heavy = { ...root, threadId: root.id, memoryEvidence: [] };
  const recent = { ...old, id: 'recent-answer', tick: 10 * BALANCE.TICKS_PER_YEAR };
  const before = { ...state, tick: 11 * BALANCE.TICKS_PER_YEAR,
    trace: { decisions: [root], acts: [], answers: [old, heavy, recent] } };
  const after = advanceTrace(before, before);
  assert.deepEqual(after.trace?.answers?.map(row => row.id), [root.id, recent.id]);
  assert.deepEqual(after.trace?.decisions, before.trace.decisions);
  assert.deepEqual(after.history, before.history);
});
test('given successive dues settings, only the current answer owns the next actual fee', () => {
  const first = gameReducer(base(), { type: 'set_market_dues', permille: 1200 });
  const second = gameReducer({ ...first, tick: 101 }, { type: 'set_market_dues', permille: 650 });
  const owner = [...(second.history?.records ?? [])].reverse().find(row => row.kind === 'decision'); assert.ok(owner);
  const posted = postLedgerEntries({ ...second, tick: 102 }, [{ account: 'cash', category: 'stall_fee', amount: 12, sourceRefs: [{ type: 'actor', id: 'fixture' }] }]);
  const after = advanceTrace(second, { ...second, tick: 102, ledger: posted.ledger, treasuryCoin: posted.treasuryCoin });
  const receipts = after.history?.records.filter(row => row.tick === 102 && row.params?.key === 'payment_flow') ?? [];
  assert.equal(receipts.length, 2, "legacy two-root receipt allocation is unchanged");
  assert.equal(after.history?.nextOrdinal, (second.history?.nextOrdinal ?? 0) + 2);
  assert.deepEqual(receipts.map(record => record.id), [0, 1].map(offset => `h-${String((second.history?.nextOrdinal ?? 0) + offset).padStart(6, "0")}`));
  assert.deepEqual(receipts.flatMap(row => row.because?.map(cause => cause.decisionId) ?? []), [owner.id]);
  const againPosted = postLedgerEntries({ ...after, tick: 103 }, [{ account: 'cash', category: 'stall_fee', amount: 9, sourceRefs: [{ type: 'actor', id: 'fixture' }] }]);
  const again = advanceTrace(after, { ...after, tick: 103, ledger: againPosted.ledger, treasuryCoin: againPosted.treasuryCoin });
  assert.equal(again.history?.nextOrdinal, after.history?.nextOrdinal, 'legacy first-flow dedup survives replacement of root because');
});
test('given five actual causes, the fifth cause is retained rather than silently cut', () => {
  assert.deepEqual(becauseOf(['a','b','c','d','e'], 'audit', true).map(row => row.decisionId), ['a','b','c','d','e']);
});
test('given a successful global rules change, own answer identity and rules target are retained', () => {
  const after = gameReducer(base(), { type: 'set_exception_rules', rules: { amountAtLeast: 80, rights: true, marriage: true, recurring: true } });
  const own = [...(after.history?.records ?? [])].reverse().find(row => row.kind === 'decision'); assert.ok(own);
  const answer = traceOf(after).answers?.find(row => row.id === own.id); assert.ok(answer);
  assert.ok(answer.targets.includes('rules'));
  assert.equal(answer.threadId, traceOf(after).decisions.at(-1)?.id);
});

test('given repeated real estate answers, membership keeps own IDs and does not mutate faction rule IDs', async () => {
  const { estatesOf } = await import('../src/engine/estates');
  const state = base(), estate = estatesOf(state).estates.find(row => row.id !== 'estate-home'); assert.ok(estate);
  const petition = { id: 'first', estateId: estate.id, kind: 'repair' as const, group: 'tenants' as const, amount: 20,
    rights: false, marriage: false, tick: 0, deadline: 1000, status: 'open' as const, escalated: 'rights' as const };
  const before = { ...state, stewardship: { ...stewardshipOf(state), oversight: [{ estateId: estate.id, mode: 'direct' as const, stewardId: 'fixture', auditMode: 'accounts' as const, tenants: 0, merchants: 0, undetected: 0, since: 0 }], petitions: [petition, { ...petition, id: 'second' }] } };
  const middle = gameReducer(before, { type: 'answer_estate_petition', petitionId: 'first', grant: false });
  const after = gameReducer(middle, { type: 'answer_estate_petition', petitionId: 'second', grant: false });
  assert.equal(after.trace?.decisions.length, 1);
  assert.equal(after.trace?.answers?.length, 2);
  assert.notEqual(after.trace?.answers?.[0]?.id, after.trace?.answers?.[1]?.id);
  assert.equal(after.trace?.answers?.[1]?.threadId, after.trace?.decisions[0]?.id);
  assert.deepEqual(after.trace?.acts, before.trace?.acts);
});

test('known allocation limit: an already emitted root flow does not manufacture a later member receipt', async () => {
  const { retainAnswer } = await import('../src/engine/decisionTraceAnswers');
  const first = gameReducer(base(), { type: 'set_market_dues', permille: 1200 });
  const root = first.trace?.decisions.at(-1); assert.ok(root);
  const post = (state: GameState, tick: number) => {
    const posted = postLedgerEntries({ ...state, tick }, [{ account: 'cash', category: 'stall_fee', amount: 12, sourceRefs: [{ type: 'actor', id: 'fixture' }] }]);
    return advanceTrace(state, { ...state, tick, ledger: posted.ledger, treasuryCoin: posted.treasuryCoin });
  };
  const emitted = post(first, 101);
  // Attribution fixture only: a later membership with the same genuine flow target, not a claim dues commands merge naturally.
  const joined = retainAnswer(emitted, { ...emitted, tick: 102 }, { ...root, id: 'later-member', tick: 102 }, root.id);
  const later = post(joined, 103);
  assert.equal(later.history?.nextOrdinal, emitted.history?.nextOrdinal);
  assert.equal(later.history?.records.some(record => record.tick > 102 && record.because?.some(cause => cause.decisionId === 'later-member')), false);
  assert.ok(later.ledger?.entries.some(entry => entry.tick === 103 && entry.category === 'stall_fee'));
});
