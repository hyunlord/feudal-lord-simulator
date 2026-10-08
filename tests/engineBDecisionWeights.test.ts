import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { weighOffer } from '../src/engine/decisionLayer';
import type { GameState } from '../src/engine/engine.types';
import { estatesOf } from '../src/engine/estates';
import { initialPolitics } from '../src/engine/politics';
import { prepareRegistryChapterPetition } from '../src/engine/registryChapterPetitions';
import type { RegistryOccurrence } from '../src/engine/registry.types';
import { bindEntry, boundIdentities, v4Entry } from '../src/engine/registryV4';
import { EMPTY_STEWARDSHIP } from '../src/engine/stewardship';
import { initialAgency } from '../src/engine/townAgency';
import { postLedgerEntries } from '../src/ledger/ledger';
import { decodeSave } from '../src/save/saveCodec';

function town(): GameState {
  const base = decodeSave(new Uint8Array(readFileSync('fixtures/saves/v49/chapter-two-town.save.json'))).envelope.state;
  return { ...base, tick: 328000, agency: initialAgency(), politics: initialPolitics(base),
    buildings: [{ id: 'market', workers: 4, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0, kind: 'market', tx: 10, ty: 10 },
      { id: 'chapel', workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0, kind: 'chapel', tx: 12, ty: 10 }] };
}
function offer(state: GameState, id: string): RegistryOccurrence {
  const entry = v4Entry(id);
  assert.ok(entry);
  const bound = bindEntry(state, entry);
  assert.ok(bound, `${id} binds actual context`);
  return { id: `weight:${id}`, entryId: id, source: 'v4', boundId: '', bound: boundIdentities(bound),
    offeredTick: state.tick, deadline: state.tick + 1000, status: 'offered', receipt: { draw: 0, chancePermille: 1000, conditions: [] } };
}
function delegated(): GameState {
  const base = town(), estates = estatesOf(base), original = estates.estates[0], person = base.persons?.people[0];
  assert.ok(original && person);
  const estate = { ...original, id: 'delegated-estate', offMap: true, titleHolder: 'lord', possessor: 'lord' };
  const current = { personId: 'current', estateId: estate.id, ability: 40, loyalty: 40, disposition: 'greedy' as const,
    connection: null, since: 0, kept: 0, errors: 0, status: 'serving' as const };
  return { ...base, estates: { ...estates, estates: [estate], people: [{ ...person, id: current.personId, birthYear: 1300, alive: true }] },
    stewardship: { ...EMPTY_STEWARDSHIP, stewards: [current],
      oversight: [{ estateId: estate.id, mode: 'steward', stewardId: current.personId, auditMode: 'accounts', tenants: 0, merchants: 0, undetected: 0, since: 0 }],
      rules: { amountAtLeast: 100, rights: false, marriage: false },
      petitions: [{ id: 'small-right', estateId: estate.id, kind: 'common_dispute', group: 'tenants', amount: 10,
        rights: true, marriage: false, tick: 1, deadline: 20, status: 'granted', decidedBy: 'steward' }] } };
}

test('chapter command overrides distinguish a market right from a small one-off payment', () => {
  // Given: genuine chapter petition bindings with enabled native responses.
  for (const [id, expected] of [['ck_evt_057', ['rights']], ['ck_evt_058', []]] as const) {
    const state = prepareRegistryChapterPetition(town(), id);
    assert.ok(state);
    // When: enabled choices are weighed by their actual handlers.
    const weighed = weighOffer(state, offer(state, id));
    // Then: the generic crisis classification is replaced only for these commands.
    assert.ok(weighed && weighed.choices.length >= 2);
    assert.deepEqual(weighed.weights, expected);
    for (const choice of weighed.choices) assert.deepEqual(choice.weights, expected);
  }
});

test('exception escalation is rights while unoverridden oversight retains generic land weight', () => {
  // Given: an actual small rights petition answered by a serving steward.
  const state = delegated();
  for (const id of ['ck_evt_061', 'ck_evt_077']) {
    // When: each enabled command is weighed.
    const weighed = weighOffer(state, offer(state, id));
    // Then: exceptions are rights, with the existing oversight fallback unchanged.
    assert.ok(weighed && weighed.choices.length >= 2);
    for (const choice of weighed.choices) {
      if (choice.commands.includes('set_exception_rules')) assert.deepEqual(choice.weights, ['rights']);
      if (choice.commands.includes('set_estate_oversight')) assert.deepEqual(choice.weights, ['land']);
    }
  }
});

test('unclassified offers retain dynamic large sum and faction rupture weights', () => {
  // Given: a live market, recorded stall income and a sender near rupture.
  const base = town();
  assert.ok(base.factions);
  const posted = postLedgerEntries(base, [{ account: 'cash', category: 'stall_fee', amount: 10000, sourceRefs: [{ type: 'actor', id: 'market' }] }]);
  const state: GameState = { ...base, ledger: posted.ledger, treasuryCoin: posted.treasuryCoin,
    factions: { ...base.factions, factions: base.factions.factions.map(faction => faction.id === 'merchant_house_1' ? { ...faction, relation: -59 } : faction) } };
  // When: an event outside the editorial table is weighed.
  const weighed = weighOffer(state, offer(state, 'ck_evt_211'));
  // Then: monetary and hold consequences still promote individual enabled choices.
  assert.ok(weighed);
  assert.ok(weighed.choices.find(choice => choice.id === 'a')?.weights.includes('large_sum'));
  assert.ok(weighed.choices.find(choice => choice.id === 'c')?.weights.includes('faction_rupture'));
});
