import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceStewardship } from '../src/engine/stewardship';
import { hashSeed } from '../src/engine/prng';
import { PRESSURE_BALANCE } from '../src/content/balanceConfig';
import { MICHAELMAS_IN_YEAR } from '../src/content/stewardshipConfig';
import { gameReducer } from '../src/state/gameStore';
import { advanceHistory } from '../src/engine/history';
import { linkRuleAnswerReceipts } from '../src/engine/decisionTraceAnswerReceipts';
import { advanceTrace } from '../src/engine/decisionTrace';
import { answer, contribution, delegated, enforcing, linked, transition } from './helpers/engineBTlinkFixtures';

for (const [id, choice] of [['ck_evt_061', 'b'], ['ck_evt_077', 'a'], ['ck_evt_130', 'a']]) {
  test(`${id} records immediate rules and links an actual later rights petition routing`, () => {
    const seed = Array.from({ length: 100 }, (_, i) => i + 1).find(value => hashSeed(value, 'estate-petition', 0, 2000) % 6 === 4);
    assert.ok(seed);
    const original = { ...delegated(), seed };
    const result = answer(original, id!, choice!);
    assert.equal(result.after.stewardship?.rules.rights, true);
    assert.ok(contribution(result.after, result.ownId).targets.includes('rules:rights'));
    assert.ok(linked(result.after, result.ownId, 'decision_effect').some(row => row.template === 'stewardship.rules' && row.tick === result.after.tick && row.params?.rights === 1));
    assert.equal(linked(result.after, result.ownId, 'petition_routed').length, 0);
    const tick = Array.from({ length: 10 }, (_, i) => (i + 2) * PRESSURE_BALANCE.seasonTicks)
      .find(value => [3, 4].includes(hashSeed(original.seed, 'estate-petition', 0, value) % 6));
    assert.ok(tick);
    const routed = transition(result.after, tick, advanceStewardship);
    const petition = routed.actual.stewardship?.petitions.find(row => !result.after.stewardship?.petitions.some(old => old.id === row.id) && row.estateId === 'delegated-estate');
    assert.ok(petition?.rights && petition.status === 'open');
    assert.ok(linked(routed.after, result.ownId, 'petition_routed').length > 0);
    const repeat = transition(routed.after, tick + 1, advanceStewardship);
    assert.equal(linked(repeat.after, result.ownId, 'petition_routed').length, linked(routed.after, result.ownId, 'petition_routed').length);
  });
}

for (const [hold, success] of [[0, true], [100, false]] as const) {
  test(`ck_evt_038 real enforcement ${success ? 'success' : 'failure'} records actual possession and expense`, () => {
    const result = answer(enforcing(hold), 'ck_evt_038', 'enforce');
    const suit = result.after.estates?.suits.find(row => row.id === 'suit');
    assert.equal(suit?.enforcements, 1);
    assert.equal(suit?.enforced, success);
    assert.ok(linked(result.after, result.ownId, 'decision_effect').some(row => row.template === 'estate.possession_enforced' && row.params?.succeeded === Number(success) && row.params?.attempt === 1));
    assert.equal(result.after.estates?.estates[0]?.possessor, success ? 'lord' : 'neighbour_1');
    assert.ok(result.after.treasuryCoin < result.before.treasuryCoin);
    assert.ok(contribution(result.after, result.ownId).targets.includes('suit:suit'));
    assert.equal(linked(result.after, result.ownId, 'suit_rent').length, 0);
    const future = transition(result.after, 2000, advanceStewardship);
    assert.equal(linked(future.after, result.ownId, 'suit_rent').length > 0, success);
  });
}

test('ck_evt_140 fifth audit-mode answer owns the actual audit without superseded settings', () => {
  let state = delegated();
  const ids: string[] = [];
  for (let index = 0; index < 4; index += 1) {
    state = gameReducer({ ...state, tick: 1000 + index }, { type: 'set_audit_mode', estateId: 'delegated-estate', mode: index % 2 === 0 ? 'visit' : 'accounts' });
    const id = state.trace?.answers?.at(-1)?.id;
    assert.ok(id);
    ids.push(id);
  }
  const result = answer({ ...state, tick: 1004 }, 'ck_evt_140', 'a');
  assert.equal(result.after.stewardship?.oversight[0]?.auditMode, 'visit');
  ids.push(result.ownId);
  assert.equal(new Set(ids).size, 5);
  const audited = transition(result.after, MICHAELMAS_IN_YEAR, advanceStewardship);
  assert.equal(audited.actual.stewardship?.audits.length, 1);
  const records = linked(audited.after, result.ownId, 'audit');
  assert.ok(records.length > 0);
  for (const id of ids.slice(0, -1)) assert.equal(linked(audited.after, id, 'audit').length, 0, `superseded audit mode ${id}`);
  assert.ok(linked(result.after, result.ownId, 'decision_effect').some(row => row.template === 'stewardship.audit_mode'));
  const repeated = advanceTrace(audited.after, audited.after);
  assert.equal(linked(repeated, result.ownId, 'audit').length, records.length);
});

test('ck_evt_140:b fifth direct-oversight answer and current audit mode jointly own the real next audit', () => {
  let state = delegated();
  const priorIds: string[] = [];
  for (let index = 0; index < 4; index += 1) {
    state = gameReducer({ ...state, tick: 1000 + index }, { type: 'set_audit_mode', estateId: 'delegated-estate', mode: index % 2 === 0 ? 'visit' : 'accounts' });
    const id = state.trace?.answers?.at(-1)?.id;
    assert.ok(id);
    priorIds.push(id);
  }
  const rules = state.stewardship?.rules;
  const result = answer({ ...state, tick: 1004 }, 'ck_evt_140', 'b');
  assert.equal(new Set([...priorIds, result.ownId]).size, 5);
  assert.equal(result.after.trace?.answers?.at(-1)?.id, result.ownId);
  assert.equal(result.after.stewardship?.oversight[0]?.mode, 'direct');
  assert.equal(result.after.stewardship?.oversight[0]?.auditMode, 'accounts');
  assert.deepEqual(result.after.stewardship?.rules, rules);
  assert.ok(contribution(result.after, result.ownId).targets.includes('oversight:delegated-estate'));
  assert.ok(!contribution(result.after, result.ownId).targets.includes('audit_mode:delegated-estate'));
  const immediate = linked(result.after, result.ownId, 'decision_effect');
  assert.ok(immediate.some(row => row.template === 'stewardship.oversight'));
  assert.equal(result.after.history?.records.filter(row => row.id === result.ownId).length, 1);
  assert.equal(linked(result.after, result.ownId, 'audit').length, 0);

  const season = transition(result.after, 2 * PRESSURE_BALANCE.seasonTicks, advanceStewardship);
  const summary = season.actual.stewardship?.summaries.find(row => row.estateId === 'delegated-estate' && row.tick === season.actual.tick);
  assert.equal(summary?.mode, 'direct');
  const petition = season.actual.stewardship?.petitions.find(row => row.estateId === 'delegated-estate' && row.tick === season.actual.tick);
  assert.equal(petition?.escalated, 'direct');
  const routing = linked(season.after, result.ownId, 'petition_routed');
  assert.equal(routing.length, 1);
  assert.equal(routing[0]?.template, 'stewardship.brought');
  assert.equal(routing[0]?.params?.tracePetition, petition?.id);
  assert.equal(routing[0]?.params?.traceEstate, 'delegated-estate');
  assert.deepEqual(season.actual.stewardship?.rules, rules);
  assert.equal(season.actual.stewardship?.audits.length, 0);
  assert.equal(linked(season.after, result.ownId, 'audit').length, 0);

  const audited = transition(season.after, MICHAELMAS_IN_YEAR, advanceStewardship);
  const audit = audited.actual.stewardship?.audits.find(row => row.estateId === 'delegated-estate');
  assert.ok(audit);
  assert.equal(audit.tick, MICHAELMAS_IN_YEAR);
  assert.equal(audit.mode, 'accounts');
  assert.equal(audited.actual.stewardship?.nextAudit, (season.after.stewardship?.nextAudit ?? 0) + 1);
  const receipts = linked(audited.after, result.ownId, 'audit');
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0]?.params?.target, 'estate:delegated-estate');
  const causeIds = receipts[0]?.because?.filter(cause => cause.key === 'audit').map(cause => cause.decisionId).sort();
  assert.deepEqual(causeIds, [priorIds[3], result.ownId].sort());
  for (const id of priorIds.slice(0, 3)) assert.equal(linked(audited.after, id, 'audit').length, 0);
  const repeated = advanceTrace(audited.after, audited.after);
  assert.deepEqual(repeated.history?.records.map(row => row.id), audited.after.history?.records.map(row => row.id));
});

test('140:b routing annotates existing records only and repeated matching never duplicates causes', () => {
  const result = answer(delegated(), 'ck_evt_140', 'b');
  const before = { ...result.after, tick: 2000 };
  const actual = advanceStewardship(before);
  const recorded = advanceHistory(before, actual);
  const annotated = linkRuleAnswerReceipts(before, recorded);
  assert.equal(linked(annotated, result.ownId, 'petition_routed').length, 1);
  assert.equal(annotated.history?.nextOrdinal, recorded.history?.nextOrdinal);
  assert.deepEqual(annotated.history?.records.map(row => row.id), recorded.history?.records.map(row => row.id));
  const { history: oldHistory, ...oldState } = recorded;
  const { history: newHistory, ...newState } = annotated;
  assert.ok(oldHistory && newHistory);
  assert.deepEqual(newState, oldState);
  assert.deepEqual(linkRuleAnswerReceipts(before, annotated), annotated);
  assert.deepEqual(advanceTrace(annotated, annotated), annotated);
});

for (const sameTick of [false, true]) {
  test(`140:b replaced oversight uses only the latest owner; same-tick=${sameTick}`, () => {
    const result = answer(delegated(), 'ck_evt_140', 'b');
    const delegatedAgain = gameReducer({ ...result.after, tick: 1500 }, { type: 'set_estate_oversight', estateId: 'delegated-estate', mode: 'steward' });
    const current = gameReducer({ ...delegatedAgain, tick: sameTick ? 2000 : 1999 }, { type: 'set_estate_oversight', estateId: 'delegated-estate', mode: 'direct' });
    const owner = current.trace?.answers?.at(-1);
    assert.ok(owner);
    const next = transition(current, 2000, advanceStewardship);
    assert.equal(linked(next.after, result.ownId, 'petition_routed').length, 0);
    assert.equal(linked(next.after, owner.id, 'petition_routed').length, sameTick ? 0 : 1);
  });
}

for (const sameHouse of [false, true]) {
  test(`140:b never borrows another estate record; duplicate house name=${sameHouse}`, () => {
    const result = answer(delegated(), 'ck_evt_140', 'b');
    const estate = result.after.estates?.estates[0];
    const person = result.after.estates?.people[0];
    const stewardship = result.after.stewardship;
    const record = stewardship?.stewards[0], oversight = stewardship?.oversight[0];
    assert.ok(estate && person && stewardship && record && oversight && result.after.estates);
    const second = { ...estate, id: 'other-estate', name: sameHouse ? estate.name : 'different house' };
    const state = { ...result.after, estates: { ...result.after.estates, estates: [estate, second],
      people: [...result.after.estates.people, { ...person, id: 'other-steward' }] }, stewardship: { ...stewardship,
      stewards: [...stewardship.stewards, { ...record, estateId: second.id, personId: 'other-steward' }],
      oversight: [...stewardship.oversight, { ...oversight, estateId: second.id, stewardId: 'other-steward' }] } };
    const before = { ...state, tick: 2000 }, actual = advanceStewardship(before);
    const recorded = advanceHistory(before, actual);
    const brought = recorded.history?.records.filter(row => row.tick === 2000 && row.template === 'stewardship.brought');
    assert.equal(brought?.length, 2);
    const annotated = linkRuleAnswerReceipts(before, recorded);
    const links = linked(annotated, result.ownId, 'petition_routed');
    assert.equal(links.length, sameHouse ? 0 : 1);
    assert.ok(links.every(row => row.params?.traceEstate === estate.id && row.params?.house === estate.name));
    if (sameHouse) {
      assert.ok(recorded.history && brought?.[0]);
      const oneRecord = { ...recorded, history: { ...recorded.history, records: recorded.history.records.filter(row => row.id !== brought[0]?.id) } };
      assert.equal(linked(linkRuleAnswerReceipts(before, oneRecord), result.ownId, 'petition_routed').length, 0,
        'one retained record matching two fresh petitions is still ambiguous');
    }
  });
}

for (const choice of ['replace', 'punish'] as const) {
  test(`140:b mode ownership survives actual audit ${choice} without stealing routing`, () => {
    const base = delegated(), stewardship = base.stewardship, estates = base.estates;
    const serving = stewardship?.stewards[0], person = estates?.people[0];
    assert.ok(stewardship && estates && serving && person);
    const prepared = { ...base, estates: { ...estates, people: [...estates.people, { ...person, id: 'successor' }] },
      stewardship: { ...stewardship, stewards: [{ ...serving, errors: 1 },
        { ...serving, personId: 'successor', status: 'candidate' as const }] } };
    const result = answer(prepared, 'ck_evt_140', 'b');
    const audited = transition(result.after, MICHAELMAS_IN_YEAR, advanceStewardship);
    const audit = audited.after.stewardship?.audits.at(-1);
    assert.equal(audit?.status, 'pending');
    assert.ok(audit);
    const changed = gameReducer({ ...audited.after, tick: MICHAELMAS_IN_YEAR + 1 },
      { type: 'answer_audit', auditId: audit.id, choice, replacementId: 'successor' });
    assert.equal(changed.stewardship?.oversight[0]?.mode, 'direct');
    assert.equal(changed.stewardship?.oversight[0]?.stewardId, 'successor');
    assert.equal(changed.stewardship?.audits.at(-1)?.status, choice === 'replace' ? 'replaced' : 'punished');
    const replacement = changed.trace?.answers?.at(-1);
    assert.ok(replacement && replacement.id !== result.ownId);
    const next = transition(changed, 3 * PRESSURE_BALANCE.seasonTicks, advanceStewardship);
    assert.equal(linked(next.after, result.ownId, 'petition_routed').length, 1);
    assert.equal(linked(next.after, replacement.id, 'petition_routed').length, 0);
    assert.ok(replacement.targets.includes('oversight:delegated-estate'));
    assert.ok(!replacement.targets.includes('oversight_mode:delegated-estate'));
    assert.ok(contribution(changed, result.ownId).targets.includes('oversight_mode:delegated-estate'));
  });
}

test('140:b legacy broad oversight evidence does not backfill missing mode ownership', () => {
  const result = answer(delegated(), 'ck_evt_140', 'b');
  assert.ok(result.after.trace?.answers);
  const strip = (row: ReturnType<typeof contribution>) => ({ ...row, targets: row.targets.filter(target => !target.startsWith('oversight_mode:')) });
  const legacy = { ...result.after, trace: { ...result.after.trace,
    answers: result.after.trace.answers.map(strip) } };
  const next = transition(legacy, 2000, advanceStewardship);
  assert.equal(next.actual.stewardship?.petitions.at(-1)?.escalated, 'direct');
  assert.equal(linked(next.after, result.ownId, 'petition_routed').length, 0);
});
