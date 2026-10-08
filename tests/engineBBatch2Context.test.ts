import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { GameState } from '../src/engine/engine.types';
import { petitionContext } from '../src/engine/registryPetitionContext';
import { initialAgency } from '../src/engine/townAgency';
import { decodeSave, encodeSave } from '../src/save/saveCodec';
function town(): GameState {
  const state = decodeSave(new Uint8Array(readFileSync('fixtures/saves/v49/chapter-two-town.save.json'))).envelope.state;
  const house = state.houses.find(item => item.residents > 0);
  const person = state.persons?.people.find(item => item.alive);
  const market = state.buildings.find(item => item.kind === 'market');
  assert.ok(house && person && market);
  return { ...state, agency: { ...initialAgency(), duesPermille: 1200 }, persons: {
    people: [{ ...person, householdId: house.buildingId, birthYear: 1280, role: 'head', classBand: 'merchant' }], past: [], nextOrdinal: 2,
  } };
}
test('estate contexts require living bound parties and real petition, claim or account evidence', async () => {
  const { estatesOf } = await import('../src/engine/estates');
  const { EMPTY_STEWARDSHIP } = await import('../src/engine/stewardship');
  const base = town();
  const person = base.persons?.people[0];
  const original = estatesOf(base).estates[0];
  assert.ok(person && original);
  const estate = { ...original, id: 'first-estate', offMap: true, titleHolder: 'lord', possessor: 'lord' };
  const estateB = { ...estate, id: 'second-estate' };
  const current = { personId: 'current', estateId: estate.id, ability: 40, loyalty: 40, disposition: 'greedy' as const, connection: null, since: 0, kept: 0, errors: 0, status: 'serving' as const };
  const able = { ...current, personId: 'able', ability: 80, loyalty: 20, disposition: 'merchant' as const, status: 'candidate' as const };
  const loyal = { ...current, personId: 'loyal', ability: 20, loyalty: 80, disposition: 'peasant' as const, status: 'candidate' as const };
  const other = { ...current, personId: 'other', estateId: estateB.id };
  const oversight = { estateId: estate.id, mode: 'steward' as const, stewardId: current.personId, auditMode: 'accounts' as const, tenants: 0, merchants: 0, undetected: 0, since: 0 };
  const otherOversight = { ...oversight, estateId: estateB.id, stewardId: other.personId };
  const summary = { estateId: estate.id, tick: 10, mode: 'steward' as const, income: 20, reported: 20, kept: 0, error: 0, rentPermille: 1000, duesPermille: 1000, petitions: [], tenants: 0, merchants: 0, overloaded: false };
  const claim = { id: 'claim', claimant: 'lord', estateId: estate.id, basis: 'old_possession' as const, strength: 50, evidence: [], since: 0, status: 'suing' as const };
  const suit = { id: 'suit', claimId: claim.id, plaintiff: 'lord', defendant: 'neighbour_1', estateId: estate.id, stage: 'evidence' as const, stageSince: 10, patronSupport: 0, enforcements: 0, costs: 0 };
  const state: GameState = { ...base, persons: { people: [{ ...person, householdId: 'manor', role: 'steward' }], past: [], nextOrdinal: 2 }, estates: { ...estatesOf(base), estates: [estate, estateB], claims: [claim], suits: [suit], people: [current, able, loyal, other].map(item => ({ ...person, id: item.personId })) },
    stewardship: { ...EMPTY_STEWARDSHIP, stewards: [current, able, loyal, other], oversight: [oversight, otherOversight],
      summaries: [summary, { ...summary, estateId: estateB.id }], rules: { amountAtLeast: 100, rights: false, marriage: true },
      petitions: [{ id: 'small-right', estateId: estate.id, kind: 'common_dispute', group: 'tenants', amount: 10, rights: true, marriage: false, tick: 1, deadline: 20, status: 'granted', decidedBy: 'steward' }] },
  };
  const bound = { estate, estateB, currentSteward: current, able, loyal, merchant: able, peasant: loyal, suit, claim };
  for (const id of ['075', '076']) {
    const offered = petitionContext(state, `ck_evt_${id}`, bound);
    assert.ok(offered, id);
    assert.deepEqual(petitionContext(state, `ck_evt_${id}`, bound, offered), offered, `${id} pinned`);
  }
  const stewardship = state.stewardship;
  const estates = state.estates;
  assert.ok(stewardship && estates);
  for (const id of ['076']) {
    assert.equal(petitionContext({ ...state, estates: { ...estates, people: [] } }, `ck_evt_${id}`, bound), null, `${id} no dead or absent estate parties`);
  }
  assert.equal(petitionContext({ ...state, stewardship: { ...stewardship, summaries: [summary] } }, 'ck_evt_076', bound), null);
  assert.equal(petitionContext({ ...state, estates: { ...estates, claims: [{ ...claim, basis: 'purchase_deed' }] } }, 'ck_evt_075', bound), null);
  const accounts = petitionContext(state, 'ck_evt_076', bound);
  assert.ok(accounts);
  const laterAccounts = { ...state, stewardship: { ...stewardship, summaries: [...stewardship.summaries, { ...summary, tick: 20, reported: 25 }, { ...summary, estateId: estateB.id, tick: 20, reported: 25 }] } };
  assert.deepEqual(petitionContext(laterAccounts, 'ck_evt_076', bound, accounts), accounts, 'the offered account round remains bound after a later round');
});

test('080 requires an unpaid expense and pins its identity while retaining its late calendar', async () => {
  // Given: a real market and merchant, a pending timber order, and an unpaid expense.
  const { bindEntry, v4Entry, v4EnabledChoices } = await import('../src/engine/registryV4');
  const base = town();
  const state: GameState = { ...base, timberOrder: 24,
    money: { crossings: {}, millWheat: {}, arrears: [{ tick: 20, amount: 5, facility: { type: 'building', id: 'market' } }] } };
  // When: the read adapter captures the expense and the registry checks the canonical calendar.
  const context = petitionContext(state, 'ck_evt_080', {});
  const entry = v4Entry('ck_evt_080');
  // Then: the facts are stable, replaced or settled expenses invalidate them, and early play cannot bind.
  assert.ok(context && entry);
  assert.deepEqual(petitionContext(state, 'ck_evt_080', {}, context), context);
  assert.equal(petitionContext({ ...state, timberOrder: 16 }, 'ck_evt_080', {}), null);
  assert.equal(petitionContext({ ...state, money: { crossings: {}, millWheat: {}, arrears: [] } }, 'ck_evt_080', {}), null);
  assert.equal(petitionContext({ ...state, money: { crossings: {}, millWheat: {}, arrears: [{ tick: 21, amount: 5, facility: { type: 'building', id: 'market' } }] } }, 'ck_evt_080', {}, context), null);
  assert.equal(entry.calendar.yearMinInclusive, 1430);
  assert.equal(entry.calendar.yearMaxInclusive, 1450);
  assert.equal(bindEntry(state, entry), null);
  // Synthetic calendar-boundary fixture; this is not a natural elapsed-play observation.
  const late = { ...state, tick: 130 * 4000 };
  const lateBound = bindEntry(late, entry);
  assert.ok(lateBound);
  assert.equal(v4EnabledChoices(late, entry, lateBound).length, 3);
  assert.equal(bindEntry({ ...late, tick: 151 * 4000 }, entry), null);
});

test('075 and 076 bind original facts, answer every choice after reload, and reject vanished sources', async () => {
  const { estatesOf } = await import('../src/engine/estates');
  const { EMPTY_STEWARDSHIP } = await import('../src/engine/stewardship');
  const base = town();
  const person = base.persons?.people[0];
  const original = estatesOf(base).estates[0];
  assert.ok(person && original);
  const estate = { ...original, id: 'first-estate', offMap: true, titleHolder: 'lord', possessor: 'lord' };
  const estateB = { ...estate, id: 'second-estate' };
  const current = { personId: 'current', estateId: estate.id, ability: 40, loyalty: 40, disposition: 'greedy' as const, connection: null, since: 0, kept: 0, errors: 0, status: 'serving' as const };
  const able = { ...current, personId: 'able', ability: 80, loyalty: 20, disposition: 'merchant' as const, status: 'candidate' as const };
  const loyal = { ...current, personId: 'loyal', ability: 20, loyalty: 80, disposition: 'peasant' as const, status: 'candidate' as const };
  const other = { ...current, personId: 'other', estateId: estateB.id };
  const oversight = { estateId: estate.id, mode: 'steward' as const, stewardId: current.personId, auditMode: 'accounts' as const, tenants: 0, merchants: 0, undetected: 0, since: 0 };
  const otherOversight = { ...oversight, estateId: estateB.id, stewardId: other.personId };
  const summary = { estateId: estate.id, tick: 10, mode: 'steward' as const, income: 20, reported: 20, kept: 0, error: 0, rentPermille: 1000, duesPermille: 1000, petitions: [], tenants: 0, merchants: 0, overloaded: false };
  const claim = { id: 'claim', claimant: 'lord', estateId: estate.id, basis: 'old_possession' as const, strength: 50, evidence: [], since: 0, status: 'suing' as const };
  const suit = { id: 'suit', claimId: claim.id, plaintiff: 'lord', defendant: 'neighbour_1', estateId: estate.id, stage: 'evidence' as const, stageSince: 10, patronSupport: 0, enforcements: 0, costs: 0 };
  const state: GameState = { ...base, persons: { people: [{ ...person, householdId: 'manor', role: 'steward' }], past: [], nextOrdinal: 2 }, estates: { ...estatesOf(base), estates: [estate, estateB], claims: [claim], suits: [suit], people: [current, able, loyal, other].map(item => ({ ...person, id: item.personId })) },
    stewardship: { ...EMPTY_STEWARDSHIP, stewards: [current, able, loyal, other], oversight: [oversight, otherOversight],
      summaries: [summary, { ...summary, estateId: estateB.id }], rules: { amountAtLeast: 100, rights: false, marriage: true },
      petitions: [{ id: 'small-right', estateId: estate.id, kind: 'common_dispute', group: 'tenants', amount: 10, rights: true, marriage: false, tick: 1, deadline: 20, status: 'granted', decidedBy: 'steward' }] },
  };
  const { bindEntry, boundIdentities, v4Entry } = await import('../src/engine/registryV4');
  const { answerRegistryOffer, initialRegistry, offerChoices } = await import('../src/engine/registry');
  const { weighOffer } = await import('../src/engine/decisionLayer');
  // Given: the same concrete facts now enter through canonical binding, with 076's direct oversight condition.
  assert.ok(state.stewardship && state.estates);
  const { postLedgerEntries } = await import('../src/ledger/ledger');
  const funded = postLedgerEntries(state, [{ account: 'cash', category: 'rent', amount: 1000, sourceRefs: [{ type: 'actor', id: 'estate' }] }]);
  const ready: GameState = { ...state, treasuryCoin: funded.treasuryCoin, ledger: funded.ledger,
    stewardship: { ...state.stewardship, oversight: state.stewardship.oversight.map(item =>
      item.estateId === estate.id ? { ...item, mode: 'direct' } : item) } };
  for (const id of ['ck_evt_075', 'ck_evt_076']) {
    const entry = v4Entry(id);
    assert.ok(entry);
    const actual = bindEntry(ready, entry);
    assert.ok(actual, `${id} satisfies canonical bindings and conditions`);
    const occurrence = { id: `registry:${id}:facts`, entryId: id, source: 'v4' as const, boundId: estate.id,
      offeredTick: ready.tick, deadline: ready.tick + 1000, status: 'offered' as const,
      bound: boundIdentities(actual), receipt: { draw: 0, chancePermille: 1000, conditions: [] } };
    const offered: GameState = { ...ready, registry: { ...initialRegistry(), occurrences: [occurrence] } };
    const loaded = decodeSave(encodeSave({ state: offered, createdAt: '2026-10-08T00:00:00Z', savedAt: '2026-10-08T00:00:00Z' }).bytes).envelope.state;
    assert.deepEqual(offerChoices(loaded, occurrence), ['a', 'b', 'c']);
    const weighed = weighOffer(loaded, occurrence);
    assert.ok(weighed);
    assert.ok(weighed.weights.includes(id === 'ck_evt_075' ? 'rights' : 'land'), `${id} weighs the actual enabled commands`);
    // When: each real registry answer is applied independently to the reloaded offer.
    for (const choice of ['a', 'b', 'c']) {
      const answered = answerRegistryOffer(loaded, occurrence.id, choice);
      // Then: evidence or the specifically selected estate changes exactly once.
      assert.equal(answered.registry?.occurrences.find(item => item.id === occurrence.id)?.status, 'answered');
      if (id === 'ck_evt_075') {
        assert.deepEqual(answered.estates?.claims.find(item => item.id === claim.id)?.evidence.map(item => item.kind),
          [choice === 'a' ? 'possession_years' : choice === 'b' ? 'deed' : 'charter']);
        assert.equal(answered.treasuryCoin, loaded.treasuryCoin - (choice === 'a' ? 0 : choice === 'b' ? 30 : 40));
      } else {
        const first = answered.stewardship?.oversight.find(item => item.estateId === estate.id);
        const second = answered.stewardship?.oversight.find(item => item.estateId === estateB.id);
        assert.equal(first?.auditMode, choice === 'a' ? 'visit' : 'accounts');
        assert.equal(second?.auditMode, choice === 'b' ? 'visit' : 'accounts');
        assert.equal(first?.mode, choice === 'c' ? 'steward' : 'direct');
        assert.equal(first?.stewardId, choice === 'c' ? able.personId : current.personId);
      }
      assert.equal(answerRegistryOffer(answered, occurrence.id, choice), answered);
    }
    assert.ok(loaded.estates && loaded.stewardship);
    const missing: GameState = id === 'ck_evt_075'
      ? { ...loaded, estates: { ...loaded.estates, claims: [] } }
      : { ...loaded, stewardship: { ...loaded.stewardship, summaries: [] } };
    assert.deepEqual(offerChoices(missing, occurrence), []);
    const refused = answerRegistryOffer(missing, occurrence.id, 'a');
    assert.equal(refused.registry?.occurrences.find(item => item.id === occurrence.id)?.status, 'invalid');
    assert.deepEqual(refused.estates, missing.estates);
    assert.deepEqual(refused.stewardship, missing.stewardship);
    assert.equal(refused.treasuryCoin, missing.treasuryCoin);
  }
});
