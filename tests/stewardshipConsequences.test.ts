import assert from 'node:assert/strict';
import test from 'node:test';
import type { GameState } from '../src/engine/engine.types';
import { advanceStewardship, answerAudit, answerEstatePetition, pendingAudits, stewardshipOf } from '../src/engine/stewardship';
import { treasuryBalance } from '../src/ledger/ledger';
import { delegated } from './helpers/engineBTlinkFixtures';

function saturated(): GameState {
  const state = delegated(), own = stewardshipOf(state);
  assert.ok(state.estates);
  return { ...state, tick: 1001, estates: { ...state.estates, estates: state.estates.estates.map(row => ({ ...row, annualValue: 4000 })) },
    stewardship: { ...own, rules: { amountAtLeast: null, rights: true, marriage: true },
      oversight: own.oversight.map(row => ({ ...row, mode: 'direct', merchants: -100 })),
      stewards: own.stewards.map(row => ({ ...row, ability: 100, loyalty: 100, disposition: 'merchant' })),
      petitions: [{ id: 'charter-test', estateId: 'delegated-estate', kind: 'charter_request', group: 'merchants',
        amount: 100, rights: true, marriage: false, tick: 1000, deadline: 2000, status: 'open', escalated: 'direct' }],
      audits: [{ id: 'audit-test', estateId: 'delegated-estate', stewardId: 'current', tick: 1000, deadline: 2000,
        mode: 'accounts', revealedKept: 0, revealedErrors: 160, hidden: 0, status: 'pending' }] } };
}

test('saturated charter refusal reduces actual next-season revenue without a second petition', () => {
  // Given a solvent directly managed estate whose merchants cannot lose more relation.
  const before = saturated();
  // When the lord refuses and the next seasonal accounts are produced.
  const refused = answerEstatePetition(before, 'charter-test', false);
  const actual = advanceStewardship({ ...refused, tick: 2000 });
  const control = advanceStewardship({ ...before, tick: 2000 });
  // Then money, not only processing records, differs by a positive realized trade loss.
  assert.equal(treasuryBalance(refused), treasuryBalance(before), 'no invented immediate debit');
  const summary = stewardshipOf(actual).summaries.find(row => row.estateId === 'delegated-estate');
  const baseline = stewardshipOf(control).summaries.find(row => row.estateId === 'delegated-estate');
  assert.ok(summary && baseline);
  assert.ok(summary.reported < baseline.reported);
  assert.equal(stewardshipOf(refused).oversight[0]?.merchants, -100);
});

test('saturated audit tolerance retains unrecovered loss and causes new actual errors without double charging', () => {
  // Given already-lost audit errors and loyalty at its ceiling.
  const before = saturated();
  // When those errors are tolerated and another quarter is accounted for.
  const tolerated = answerAudit(before, 'audit-test', 'tolerate');
  const actual = advanceStewardship({ ...tolerated, tick: 2000 });
  const control = advanceStewardship({ ...before, tick: 2000 });
  // Then next-season loss grows while the answer itself does not debit old losses again.
  assert.equal(treasuryBalance(tolerated), treasuryBalance(before));
  const summary = stewardshipOf(actual).summaries.find(row => row.estateId === 'delegated-estate');
  const baseline = stewardshipOf(control).summaries.find(row => row.estateId === 'delegated-estate');
  assert.ok(summary && baseline);
  assert.ok(summary.error > baseline.error);
  assert.ok(summary.reported < baseline.reported);
});

test('zero-loss saturated audit is not a heavy pending choice', () => {
  // Given an old pending row that has no revealed loss and cannot improve loyalty.
  const before = saturated(), own = stewardshipOf(before);
  const clean = { ...before, stewardship: { ...own, audits: own.audits.map(row => ({ ...row, revealedErrors: 0 })) } };
  // When the pending lord decisions are read, then this is report-only.
  assert.equal(pendingAudits(clean).length, 0);
});

// Bounded helper checks protect the mode and lifecycle boundary independently of petition draws.
test('charter resistance ends after four quarters and retry suppression has a recovery escape', async () => {
  const { charterPetitionSuppressed, charterSeasonLoss } = await import('../src/engine/stewardshipConsequences');
  const state = answerEstatePetition(saturated(), 'charter-test', false);
  let oversight = stewardshipOf(state).oversight[0];
  assert.ok(oversight);
  for (let quarter = 0; quarter < 4; quarter++) {
    const result = charterSeasonLoss(state, oversight, 100, 200);
    assert.equal(result.loss, 25);
    oversight = result.oversight;
  }
  assert.equal(charterSeasonLoss(state, oversight, 100, 200).loss, 0);
  assert.equal(charterPetitionSuppressed({ ...state, tick: 5000 }, oversight), true);
  assert.equal(charterPetitionSuppressed({ ...state, tick: 5000 }, { ...oversight, merchants: -79 }), false);
  assert.equal(charterPetitionSuppressed({ ...state, tick: 13001 }, oversight), false);
});

test('audit recurrence exhausts four quarters and clips losses to actual available income', async () => {
  const { toleratedSeasonLoss } = await import('../src/engine/stewardshipConsequences');
  const state = answerAudit(saturated(), 'audit-test', 'tolerate');
  let record = stewardshipOf(state).stewards.find(row => row.personId === 'current');
  assert.ok(record);
  assert.equal(record.toleratedErrors?.[0]?.unrecovered, 160);
  assert.equal(stewardshipOf(state).audits[0]?.unrecovered, 160);
  for (let quarter = 0; quarter < 4; quarter++) {
    const result = toleratedSeasonLoss(state, record, 3);
    assert.equal(result.loss, 3);
    assert.equal(result.evidence[0]?.amount, 3);
    record = result.record;
  }
  assert.equal(record.toleratedErrors, undefined);
  assert.equal(toleratedSeasonLoss(state, record, 100).loss, 0);
});

test('non-lord commands create no new pressure fields and ignore loaded lord-only pressure', async () => {
  const { charterSeasonLoss, toleratedSeasonLoss, charterPetitionSuppressed } = await import('../src/engine/stewardshipConsequences');
  const { agency: _agency, ...state } = saturated();
  const refused = answerEstatePetition(state, 'charter-test', false);
  const tolerated = answerAudit(state, 'audit-test', 'tolerate');
  assert.equal(stewardshipOf(refused).oversight[0]?.charterResistance, undefined);
  assert.equal(stewardshipOf(tolerated).stewards[0]?.toleratedErrors, undefined);
  assert.equal(stewardshipOf(tolerated).audits[0]?.unrecovered, undefined);
  const lord = answerAudit(answerEstatePetition(saturated(), 'charter-test', false), 'audit-test', 'tolerate');
  const oversight = stewardshipOf(lord).oversight[0], record = stewardshipOf(lord).stewards[0];
  assert.ok(oversight && record);
  assert.deepEqual(charterSeasonLoss(state, oversight, 100, 200), { oversight, loss: 0 });
  assert.deepEqual(toleratedSeasonLoss(state, record, 100), { record, loss: 0, evidence: [] });
  assert.equal(charterPetitionSuppressed(state, oversight), false);
});

test('already queued charter cannot overwrite a live refusal or become a second heavy answer', () => {
  const before = saturated(), own = stewardshipOf(before), petition = own.petitions[0];
  assert.ok(petition);
  const queued = { ...before, stewardship: { ...own, petitions: [...own.petitions, { ...petition, id: 'charter-backlog' }] } };
  const first = answerEstatePetition(queued, 'charter-test', false);
  assert.equal(answerEstatePetition(first, 'charter-backlog', false), first);
  assert.equal(stewardshipOf(first).oversight[0]?.charterResistance?.petitionId, 'charter-test');
});

test('a stale direct audit command cannot answer a report-only audit', () => {
  const before = saturated(), own = stewardshipOf(before);
  const clean = { ...before, stewardship: { ...own, audits: own.audits.map(row => ({ ...row, revealedErrors: 0 })) } };
  assert.equal(answerAudit(clean, 'audit-test', 'tolerate'), clean);
});
