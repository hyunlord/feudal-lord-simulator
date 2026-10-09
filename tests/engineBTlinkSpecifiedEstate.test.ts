import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceStewardship } from '../src/engine/stewardship';
import { hashSeed } from '../src/engine/prng';
import { PRESSURE_BALANCE } from '../src/content/balanceConfig';
import { MICHAELMAS_IN_YEAR } from '../src/content/stewardshipConfig';
import { gameReducer } from '../src/state/gameStore';
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
