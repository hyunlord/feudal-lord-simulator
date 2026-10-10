import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceStewardship, answerAudit, pendingAudits, setStandingPolicy, stewardshipOf } from '../src/engine/stewardship';
import { delegated } from './helpers/engineBTlinkFixtures';
import { MICHAELMAS_IN_YEAR } from '../src/content/stewardshipConfig';

function fixture() {
  const state = delegated(), own = stewardshipOf(state);
  const current = own.stewards[0];
  assert.ok(current);
  return { ...state, tick: 1001, stewardship: { ...own,
    stewards: [...own.stewards, { ...current, personId: 'replacement', status: 'candidate' as const }].map(row => ({ ...row, loyalty: 100, ability: 100, errors: 0, kept: 0 })),
    audits: [{ id: 'tolerance', estateId: 'delegated-estate', stewardId: 'current', tick: 1000, deadline: 2000,
      mode: 'accounts' as const, revealedKept: 0, revealedErrors: 160, hidden: 0, status: 'pending' as const }] } };
}

test('explicit tolerance establishes a persistent person policy and repeated audit is a report', () => {
  const before = fixture();
  const accepted = answerAudit(before, 'tolerance', 'tolerate');
  assert.equal(stewardshipOf(accepted).standing?.['audit:delegated-estate:current'], 'lenient');
  const own = stewardshipOf(accepted);
  const after = advanceStewardship({ ...accepted, tick: MICHAELMAS_IN_YEAR + 4000,
    stewardship: { ...own, stewards: own.stewards.map(row => ({ ...row, errors: 160 })) } });
  const audit = stewardshipOf(after).audits.at(-1);
  assert.equal(audit?.status, 'tolerated');
  assert.equal(audit?.decidedBy, 'steward');
  assert.equal(pendingAudits(after).length, 0);
});

test('withdrawal makes the next zero-loss audit a decision even at loyalty ceiling', () => {
  const accepted = answerAudit(fixture(), 'tolerance', 'tolerate');
  const revoked = setStandingPolicy(accepted, 'audit:delegated-estate:current', 'lord');
  const after = advanceStewardship({ ...revoked, tick: MICHAELMAS_IN_YEAR + 4000 });
  assert.equal(pendingAudits(after).length, 1);
});

for (const [loss, loyalty, expected] of [[320, 100, 'tolerated'], [321, 100, 'pending'], [0, 99, 'pending']] as const) {
  test(`audit loss ${loss} loyalty ${loyalty} produces ${expected}`, () => {
    const accepted = answerAudit(fixture(), 'tolerance', 'tolerate'), own = stewardshipOf(accepted);
    const after = advanceStewardship({ ...accepted, tick: MICHAELMAS_IN_YEAR + 4000,
      stewardship: { ...own, stewards: own.stewards.map(row => ({ ...row, errors: loss, loyalty })) } });
    assert.equal(stewardshipOf(after).audits.at(-1)?.status, expected);
  });
}

test('persistent seasonal charge survives four seasons and clips to available revenue', async () => {
  const { toleratedSeasonLoss } = await import('../src/engine/stewardshipConsequences');
  const accepted = answerAudit(fixture(), 'tolerance', 'tolerate');
  const record = stewardshipOf(accepted).stewards.find(row => row.personId === 'current');
  assert.ok(record);
  for (let season = 0; season < 8; season++) {
    const result = toleratedSeasonLoss({ ...accepted, tick: 2000 + season * 1000 }, record, 3);
    assert.equal(result.loss, 3);
    assert.deepEqual(result.evidence, [{ auditId: 'tolerance', amount: 3 }]);
  }
  assert.equal(toleratedSeasonLoss(accepted, record, 100).loss, 10);
});

test('same-audit legacy pressure cannot double charge a standing policy', async () => {
  const { toleratedSeasonLoss } = await import('../src/engine/stewardshipConsequences');
  const accepted = answerAudit(fixture(), 'tolerance', 'tolerate');
  const record = stewardshipOf(accepted).stewards.find(row => row.personId === 'current');
  assert.ok(record);
  const result = toleratedSeasonLoss(accepted, { ...record,
    toleratedErrors: [{ auditId: 'tolerance', unrecovered: 160, perSeason: 10, remainingSeasons: 4 }] }, 100);
  assert.equal(result.loss, 10);
  assert.equal(result.record.toleratedErrors, undefined);
});

test('withdrawn policy cannot be reactivated without a fresh answer', () => {
  const accepted = answerAudit(fixture(), 'tolerance', 'tolerate');
  const revoked = setStandingPolicy(accepted, 'audit:delegated-estate:current', 'lord');
  assert.equal(setStandingPolicy(revoked, 'audit:delegated-estate:current', 'lenient'), revoked);
});

test('timeout never establishes a policy or new recurring pressure', () => {
  const expired = answerAudit({ ...fixture(), tick: 2001 }, 'tolerance', 'tolerate', true);
  assert.equal(stewardshipOf(expired).standing, undefined);
  assert.equal(stewardshipOf(expired).stewards[0]?.auditTolerance, undefined);
  assert.equal(stewardshipOf(expired).stewards[0]?.toleratedErrors, undefined);
});

test('sandbox tolerance retains its prior behavior with no policy metadata', () => {
  const { agency: _agency, ...before } = fixture();
  const after = answerAudit(before, 'tolerance', 'tolerate');
  assert.equal(stewardshipOf(after).standing, undefined);
  assert.equal(stewardshipOf(after).stewards[0]?.auditTolerance, undefined);
  assert.equal(stewardshipOf(after).audits[0]?.decidedBy, undefined);
});

test('changing receiver invalidates tolerance even if the original returns at the same tick', async () => {
  const { setEstateOversight } = await import('../src/engine/stewardship');
  const accepted = answerAudit(fixture(), 'tolerance', 'tolerate');
  const candidate = stewardshipOf(accepted).stewards.find(row => row.personId !== 'current');
  assert.ok(candidate);
  const changed = setEstateOversight(accepted, 'delegated-estate', 'steward', candidate.personId);
  const returned = setEstateOversight(changed, 'delegated-estate', 'steward', 'current');
  const after = advanceStewardship({ ...returned, tick: MICHAELMAS_IN_YEAR + 4000 });
  assert.equal(pendingAudits(after).length, 1);
});

test('new receiver after a tolerance history requires review once, even for zero losses', async () => {
  const { setEstateOversight } = await import('../src/engine/stewardship');
  const accepted = answerAudit(fixture(), 'tolerance', 'tolerate');
  const candidate = stewardshipOf(accepted).stewards.find(row => row.personId !== 'current');
  assert.ok(candidate);
  const changed = setEstateOversight(accepted, 'delegated-estate', 'steward', candidate.personId);
  const after = advanceStewardship({ ...changed, tick: MICHAELMAS_IN_YEAR + 4000 });
  assert.equal(pendingAudits(after).length, 1);
});

test('zero baseline accepts zero but escalates every positive disclosed loss', () => {
  const before = fixture(), own = stewardshipOf(before);
  const accepted = answerAudit({ ...before, stewardship: { ...own,
    audits: own.audits.map(row => ({ ...row, revealedErrors: 0 })),
    stewards: own.stewards.map(row => ({ ...row, loyalty: 50 })) } }, 'tolerance', 'tolerate');
  const records = stewardshipOf(accepted);
  const after = advanceStewardship({ ...accepted, tick: MICHAELMAS_IN_YEAR + 4000,
    stewardship: { ...records, stewards: records.stewards.map(row => ({ ...row, errors: 1 })) } });
  assert.equal(pendingAudits(after).length, 1);
});

test('a receiver without any prior policy history does not acquire a forced clean audit', () => {
  const before = fixture(), own = stewardshipOf(before);
  const after = advanceStewardship({ ...before, tick: MICHAELMAS_IN_YEAR + 4000,
    stewardship: { ...own, audits: [] } });
  assert.equal(stewardshipOf(after).audits.at(-1)?.status, 'clean');
  assert.equal(pendingAudits(after).length, 0);
});

test('dead receiver cannot continue charging policy losses', async () => {
  const { toleratedSeasonLoss } = await import('../src/engine/stewardshipConsequences');
  const accepted = answerAudit(fixture(), 'tolerance', 'tolerate');
  const record = stewardshipOf(accepted).stewards.find(row => row.personId === 'current');
  assert.ok(record && accepted.estates);
  const afterDeath = { ...accepted, estates: { ...accepted.estates,
    people: accepted.estates.people.map(row => ({ ...row, alive: false })) } };
  assert.equal(toleratedSeasonLoss(afterDeath, record, 100).loss, 0);
});

test('replaced receiver pending audit stays in records but has no actionable lord answer', async () => {
  const { setEstateOversight, auditAnswerEffect } = await import('../src/engine/stewardship');
  const before = fixture();
  const swapped = setEstateOversight(before, 'delegated-estate', 'steward', 'replacement');
  assert.equal(pendingAudits(swapped).length, 0);
  assert.equal(auditAnswerEffect(swapped, 'tolerance', 'tolerate'), null);
  assert.equal(answerAudit(swapped, 'tolerance', 'tolerate'), swapped);
  assert.equal(answerAudit(swapped, 'tolerance', 'tolerate', true), swapped);
  assert.deepEqual(stewardshipOf(swapped).audits, stewardshipOf(before).audits.map(row => ({ ...row, superseded: true })));
});

test('same-tick reducer swap away and back cannot resurrect a previous tenure audit', async () => {
  const { gameReducer } = await import('../src/state/gameStore');
  const { auditAnswerEffect } = await import('../src/engine/stewardship');
  const initial = fixture(), own = stewardshipOf(initial);
  const before = { ...initial, stewardship: { ...own, audits: own.audits.map(row => ({ ...row, tick: initial.tick })) } };
  const away = gameReducer(before, { type: 'set_estate_oversight', estateId: 'delegated-estate', mode: 'steward', stewardId: 'replacement' });
  const back = gameReducer(away, { type: 'set_estate_oversight', estateId: 'delegated-estate', mode: 'steward', stewardId: 'current' });
  assert.equal(back.tick, before.tick);
  assert.equal(pendingAudits(back).length, 0);
  assert.equal(auditAnswerEffect(back, 'tolerance', 'tolerate'), null);
  assert.equal(gameReducer(back, { type: 'answer_audit', auditId: 'tolerance', choice: 'tolerate' }), back);
  assert.equal(answerAudit(back, 'tolerance', 'tolerate', true), back);
  assert.equal(stewardshipOf(back).audits[0]?.status, 'pending');
});
