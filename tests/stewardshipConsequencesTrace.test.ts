import assert from 'node:assert/strict';
import { MICHAELMAS_IN_YEAR } from '../src/content/stewardshipConfig';
import test from 'node:test';
import { gameReducer } from '../src/state/gameStore';
import { advanceStewardship } from '../src/engine/stewardship';
import { historySummary } from '../src/engine/history';
import { answer, contribution, delegated, linked, offered, transition } from './helpers/engineBTlinkFixtures';
import type { GameState } from '../src/engine/engine.types';

function saturated(): GameState {
  const state = delegated();
  assert.ok(state.stewardship);
  return { ...state, stewardship: { ...state.stewardship,
    oversight: state.stewardship.oversight.map(row => ({ ...row, merchants: -100 })) } };
}

function charter(state: GameState, id: string): GameState {
  assert.ok(state.stewardship);
  return { ...state, stewardship: { ...state.stewardship, petitions: [...state.stewardship.petitions,
    { id, estateId: 'delegated-estate', kind: 'charter_request', group: 'merchants', amount: 2,
      rights: true, marriage: false, tick: state.tick, deadline: state.tick + 1000, status: 'open', escalated: 'rights' }] } };
}
function refuse(state: GameState, id: string) {
  const after = gameReducer(charter(state, id), { type: 'answer_estate_petition', petitionId: id, grant: false });
  const own = after.trace?.answers?.at(-1);
  assert.ok(own);
  return { after, own };
}

test('charter refusal retains exact petition identity when same-kind answers share a source', () => {
  // Given two distinct charter petitions in the same estate.
  const first = refuse(delegated(), 'charter-a');
  // When the second petition is answered.
  const second = refuse(first.after, 'charter-b');
  // Then each own answer retains its exact domain identity.
  assert.ok(first.own.targets.includes('estate_petition:charter-a'));
  assert.ok(second.own.targets.includes('estate_petition:charter-b'));
  assert.ok(!second.own.targets.includes('estate_petition:charter-a'));
});

test('real charter loss annotates the existing season', () => {
  // Given a refused charter and a later unrelated setting.
  const result = refuse(saturated(), 'charter-a');
  const unrelated = gameReducer(result.after, { type: 'set_audit_mode', estateId: 'delegated-estate', mode: 'visit' });
  const unrelatedAnswer = unrelated.trace?.answers?.at(-1);
  assert.ok(unrelatedAnswer);
  // When the next actual season closes.
  const next = transition(unrelated, 2000, advanceStewardship).after;
  // Then only the refusal owns the realized market loss.
  const receipts = linked(next, result.own.id, 'decision_effect').filter(row => row.template === 'stewardship.season');
  assert.equal(receipts.length, 1);
  assert.ok(Number(receipts[0]?.params?.marketLoss) > 0);
  const receipt = receipts[0];
  assert.ok(receipt);
  assert.match(historySummary(receipt), /시장/);
  assert.equal(linked(next, unrelatedAnswer.id, 'decision_effect').filter(row => row.template === 'stewardship.season').length, 0);
});

function tolerate(state: GameState, id: string) {
  assert.ok(state.stewardship);
  const prepared: GameState = { ...state, stewardship: { ...state.stewardship, audits: [...state.stewardship.audits,
    { id, estateId: 'delegated-estate', stewardId: 'current', tick: state.tick, mode: 'accounts',
      revealedErrors: 8, revealedKept: 0, hidden: 0, status: 'pending', deadline: state.tick + 1000 }] } };
  const after = gameReducer(prepared, { type: 'answer_audit', auditId: id, choice: 'tolerate' });
  const own = after.trace?.answers?.at(-1);
  assert.ok(own);
  return { after, own };
}

test('a renewed tolerance policy supersedes the former answer for subsequent loss', () => {
  // Given two separately tolerated audits of the same steward.
  const first = tolerate(delegated(), 'audit-a');
  const second = tolerate(first.after, 'audit-b');
  // When his next season produces the actual continuing losses.
  const next = transition(second.after, 2000, advanceStewardship).after;
  // Then only the renewed policy owns subsequent loss.
  const receipts = [first.own, second.own].map(own => linked(next, own.id, 'decision_effect').filter(row => row.template === 'stewardship.season'));
  assert.equal(receipts[0]?.length, 0);
  assert.equal(receipts[1]?.length, 1);
  const summary = next.stewardship?.summaries.at(-1);
  assert.ok(summary?.toleratedLosses?.length === 1);
  assert.equal(receipts[1]?.[0]?.params?.toleratedError, summary.toleratedLosses.reduce((total, loss) => total + loss.amount, 0));
});

test('a zero-income season creates no monetary consequence for either pressure', () => {
  // Given both pressures but an estate with no available income.
  const first = refuse(saturated(), 'charter-a');
  const second = tolerate(first.after, 'audit-a');
  assert.ok(second.after.estates);
  const empty = { ...second.after, estates: { ...second.after.estates,
    estates: second.after.estates.estates.map(estate => ({ ...estate, annualValue: 0 })) } };
  // When the season closes.
  const next = transition(empty, 2000, advanceStewardship).after;
  // Then neither answer acquires a fabricated monetary receipt.
  for (const own of [first.own, second.own]) {
    assert.equal(linked(next, own.id, 'decision_effect').filter(row => row.template === 'stewardship.season').length, 0);
  }
  const receipt = next.history?.records.find(row => row.template === 'stewardship.season' && row.tick === 2000);
  assert.ok(receipt);
  assert.equal(receipt.params?.marketLoss, undefined);
  assert.equal(receipt.params?.toleratedError, undefined);
});

test('missing exact petition ownership never backfills from a same-kind answer or estate root', () => {
  // Given an actual refusal whose exact answer identity is absent from an older save.
  const result = refuse(saturated(), 'charter-a');
  assert.ok(result.after.trace?.answers);
  const legacy = { ...result.after, trace: { ...result.after.trace, answers: result.after.trace.answers.map(answer => ({ ...answer,
    targets: answer.targets.filter(target => target !== 'estate_petition:charter-a') })) } };
  // When the estate incurs a real loss.
  const next = transition(legacy, 2000, advanceStewardship).after;
  // Then the loss remains observable without an invented exact answer association.
  assert.equal(linked(next, result.own.id, 'decision_effect').filter(row => row.template === 'stewardship.season').length, 0);
  assert.ok(next.history?.records.some(row => row.template === 'stewardship.season' && Number(row.params?.marketLoss) > 0));
});

function registryAudit(): GameState {
  const state = delegated();
  const stewardship = state.stewardship, estates = state.estates;
  const current = stewardship?.stewards[0], person = estates?.people[0];
  assert.ok(stewardship && estates && current && person);
  return { ...state, estates: { ...estates, people: [...estates.people, { ...person, id: 'successor' }] },
    stewardship: { ...stewardship, stewards: stewardship.stewards.map(row => ({ ...row, connection: "town" })).concat([
      { ...current, personId: 'successor', ability: 90, connection: 'town', status: 'candidate' }]),
    audits: [{ id: 'registry-audit', estateId: 'delegated-estate', stewardId: 'current', tick: state.tick,
      mode: 'accounts', revealedErrors: 8, revealedKept: 2, hidden: 0, status: 'pending', deadline: state.tick + 1000 }] } };
}

test('registry tolerance owns the exact settled audit and its later realized loss', () => {
  const result = answer(registryAudit(), 'ck_evt_013', 'b');
  const own = contribution(result.after, result.ownId);
  assert.ok(own.targets.includes('audit:tolerate:registry-audit'));
  const next = transition(result.after, 2000, advanceStewardship).after;
  const receipts = linked(next, own.id, 'decision_effect').filter(row => row.template === 'stewardship.season');
  assert.equal(receipts.length, 1);
  assert.ok(Number(receipts[0]?.params?.toleratedError) > 0);
  assert.match(historySummary(receipts[0]!), /눈감아 준 오류로 이번 철 수입 −/);
});

test('registry replacement never acquires the unchosen tolerance target or loss', () => {
  const result = answer(registryAudit(), 'ck_evt_013', 'c');
  const own = contribution(result.after, result.ownId);
  assert.ok(!own.targets.includes('audit:tolerate:registry-audit'));
  const next = transition(result.after, 2000, advanceStewardship).after;
  assert.equal(linked(next, own.id, 'decision_effect').filter(row => row.template === 'stewardship.season').length, 0);
});

test('unsupported registry hold retains no petition target, while an actual refusal retains only its settled petition', () => {
  const state = delegated();
  assert.ok(state.stewardship);
  const prepared = { ...state, stewardship: { ...state.stewardship, petitions: [
    { id: 'repair-a', estateId: 'delegated-estate', kind: 'repair' as const, group: 'tenants' as const, amount: 2,
      rights: false, marriage: false, tick: state.tick, deadline: state.tick + 1000, status: 'open' as const, escalated: 'amount' as const },
    { id: 'repair-b', estateId: 'delegated-estate', kind: 'repair' as const, group: 'tenants' as const, amount: 2,
      rights: false, marriage: false, tick: state.tick, deadline: state.tick + 1000, status: 'open' as const, escalated: 'amount' as const }] } };
  const open = offered(prepared, 'ck_evt_003');
  const occurrence = open.registry?.occurrences.at(-1);
  assert.ok(occurrence);
  const held = gameReducer(open, { type: 'answer_registry_offer', occurrenceId: occurrence.id, choiceId: 'c' });
  assert.deepEqual(held.trace?.answers, open.trace?.answers);
  const refused = answer(prepared, 'ck_evt_003', 'b');
  const targets = contribution(refused.after, refused.ownId).targets;
  assert.ok(targets.includes('estate_petition:repair-a'));
  assert.ok(!targets.includes('estate_petition:repair-b'));
});

test('persistent tolerance loss keeps its answer after three years without changing answer-time effects', () => {
  // Given an enacted policy whose answer snapshot is already fixed.
  const result = tolerate(delegated(), 'durable-audit');
  const snapshot = result.own.effects;
  // When a real season runs after the ordinary trace window.
  const next = transition(result.after, 16000, advanceStewardship).after;
  // Then its actual loss keeps exact provenance and the original receipt stays immutable.
  const receipts = linked(next, result.own.id, 'decision_effect').filter(row => row.template === 'stewardship.season');
  assert.equal(receipts.length, 1);
  assert.ok(Number(receipts[0]?.params?.toleratedError) > 0);
  assert.deepEqual(next.trace?.answers?.find(row => row.id === result.own.id)?.effects, snapshot);
});

test('tolerance and withdrawal receipts record actual standing policy changes as oversight effects', () => {
  // Given an accepted tolerance policy.
  const result = tolerate(delegated(), 'policy-audit');
  const path = 'stewardship.standing.audit:delegated-estate:current';
  assert.ok(result.own.effects?.every(row => !['unrecovered', 'auditId', 'since'].includes(row.path.at(-1) ?? '')));
  const accepted = result.own.effects?.find(row => row.path.join('.') === path);
  assert.equal(accepted?.target, 'oversight');
  assert.equal(accepted?.after, 'lenient');
  // When the lord withdraws that policy.
  const next = gameReducer(result.after, { type: 'set_standing_policy', kind: 'audit:delegated-estate:current', setting: 'lord' });
  // Then the withdrawal's immutable receipt records the real policy transition.
  const revoked = next.trace?.answers?.at(-1)?.effects?.find(row => row.path.join('.') === path);
  assert.equal(revoked?.before, 'lenient');
  assert.equal(revoked?.after, 'lord');
  assert.equal(revoked?.delta, null);
});

test('automatic tolerance audit produces a report without a new lord answer', () => {
  // Given a high threshold policy and a loyal steward with modest newly found errors.
  const result = tolerate(delegated(), 'report-audit');
  assert.ok(result.after.stewardship);
  const prepared = { ...result.after, stewardship: { ...result.after.stewardship,
    stewards: result.after.stewardship.stewards.map(row => ({ ...row, errors: 1, kept: 0 })) } };
  // When Michaelmas closes the next audit.
  const next = transition(prepared, MICHAELMAS_IN_YEAR, advanceStewardship).after;
  // Then no new answer is fabricated and the discovered errors appear as a low-priority report.
  assert.deepEqual(next.trace?.answers, prepared.trace?.answers);
  const receipt = next.history?.records.find(row => row.template === 'stewardship.audit_found' && row.params?.standingTolerance === 1);
  assert.ok(receipt);
  assert.match(historySummary(receipt), /청지기 보고/);
});

test('legacy finite tolerated pressure retains its original causal receipt', () => {
  // Given a legacy pressure without a persistent policy field.
  const result = tolerate(delegated(), 'legacy-audit');
  assert.ok(result.after.stewardship);
  const legacy = { ...result.after, stewardship: { ...result.after.stewardship, standing: {},
    stewards: result.after.stewardship.stewards.map(row => {
      const { auditTolerance: _policy, ...rest } = row;
      return { ...rest, toleratedErrors: [{ auditId: 'legacy-audit', unrecovered: 8, perSeason: 1, remainingSeasons: 2 }] };
    }) } };
  // When its remaining consequence is realized.
  const next = transition(legacy, 2000, advanceStewardship).after;
  // Then the existing answer still owns the real loss.
  assert.equal(linked(next, result.own.id, 'decision_effect').filter(row => row.template === 'stewardship.season').length, 1);
});
