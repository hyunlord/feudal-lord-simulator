import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { GameState } from '../src/engine/engine.types';
import { petitionContext, handlesPetitionContext } from '../src/engine/registryPetitionContext';
import { initialAgency } from '../src/engine/townAgency';
import { decodeSave } from '../src/save/saveCodec';
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
test('high dues context requires a real market and living merchant; snapshots omit incidental time', () => {
  const state = town();
  const context = petitionContext(state, 'ck_evt_092', {});
  assert.ok(context);
  assert.equal(Object.hasOwn(context, 'id'), false);
  assert.deepEqual(context, petitionContext({ ...state, tick: state.tick + 1 }, 'ck_evt_092', {}));
  assert.equal(petitionContext({ ...state, agency: { ...initialAgency(), duesPermille: 1000 } }, 'ck_evt_092', {}), null);
  assert.equal(petitionContext({ ...state, persons: { people: [], past: [], nextOrdinal: 1 } }, 'ck_evt_092', {}), null);
  assert.equal(petitionContext({ ...state, buildings: state.buildings.filter(item => item.kind !== 'market') }, 'ck_evt_092', {}), null);
});
test('fixed contexts retain observations while rejecting substituted parties, subjects and malformed snapshots', () => {
  const state = town();
  const offered = petitionContext(state, 'ck_evt_092', {});
  const person = state.persons?.people[0];
  assert.ok(offered && person);
  const changed = { ...state, agency: { ...initialAgency(), duesPermille: 1500 } };
  assert.deepEqual(petitionContext(changed, 'ck_evt_092', {}, offered), offered);
  assert.equal(petitionContext({ ...changed, persons: { people: [{ ...person, id: 'replacement' }], past: [], nextOrdinal: 2 } }, 'ck_evt_092', {}, offered), null);
  assert.equal(petitionContext({ ...changed, buildings: changed.buildings.map(item => item.kind === 'market' ? { ...item, id: 'replacement-market' } : item) }, 'ck_evt_092', {}, offered), null);
  for (const malformed of [{}, { ...offered, partyIds: [1] }, { ...offered, triggerEvidence: null }, { ...offered, subjectKey: 1 }]) {
    assert.equal(petitionContext(state, 'ck_evt_092', {}, malformed), null);
  }
  assert.equal(petitionContext({ ...state, persons: { people: [{ ...person, birthYear: 9999, occupation: 'child', role: 'child' }], past: [], nextOrdinal: 2 } }, 'ck_evt_092', {}), null);
  const earlier = { ...person, id: '000-earlier' };
  assert.deepEqual(petitionContext({ ...changed, persons: { people: [earlier, person], past: [], nextOrdinal: 3 } }, 'ck_evt_092', {}, offered), offered, 'an earlier new candidate does not replace the bound party');
});

test('only the first five contexts are configured and all require agency', () => {
  const { agency: _agency, ...state } = town();
  for (const id of ['061', '077', '083', '090', '092']) {
    assert.equal(handlesPetitionContext('ck_evt_' + id), true);
    assert.equal(petitionContext(state, 'ck_evt_' + id, {}), null);
  }
  assert.equal(handlesPetitionContext('ck_evt_062'), false);
});

test('town offers pin causal sites, revalidate before answering, and remain steward work', async () => {
  const { bindEntry, boundIdentities, v4Entry, v4EnabledChoices } = await import('../src/engine/registryV4');
  const { weighOffer } = await import('../src/engine/decisionLayer');
  const base = town();
  const person = base.persons?.people[0];
  assert.ok(person);
  const site = { id: 'repair-site', kind: 'house' as const, tx: 1, ty: 1, required: { timber: 20 }, delivered: {}, reserved: {},
    builderTicks: 0, requiredBuilderTicks: 100, assignedBuilders: 1, stall: 'awaiting_materials' as const, startedTick: 2, rebuildOf: person.householdId };
  const state: GameState = { ...base, ledger: { entries: [{ id: 'rent', tick: base.tick, account: 'cash', category: 'rent', amount: 10000, sourceRefs: [{ type: 'actor', id: 'estate' }] }], rollups: [], nextEntryOrdinal: 2 }, timberOrder: 0, constructionSites: [site], trades: {
    households: [{ houseId: person.householdId, tradeId: 'carpenter', sinceTick: 0, workshop: 'front_shop', productivityPermille: 1000,
      idleSeasons: 0, receipt: { tick: 0, reasons: [], score: 1, chancePermille: 1000, of: 1 } }],
    stock: {}, chains: {}, streets: [], haulage: { season: 0, last: 0 }, quits: [],
  } };
  for (const [id, held] of [['ck_evt_083', 'b'], ['ck_evt_090', 'b'], ['ck_evt_092', 'c']] as const) {
    const entry = v4Entry(id);
    assert.ok(entry);
    const bound = bindEntry(state, entry);
    assert.ok(bound, id);
    const fixed = boundIdentities(bound);
    assert.ok(bindEntry(state, entry, fixed), 'the original source remains answerable');
    assert.equal(bindEntry(state, entry, { ...fixed, authoredContext: '{' }), null);
    const withoutPremise = id === 'ck_evt_092' ? { ...state, agency: initialAgency() } : { ...state, constructionSites: [] };
    assert.equal(bindEntry(withoutPremise, entry, fixed), null, 'a vanished causal premise cannot be answered');
    if (id !== 'ck_evt_092') {
      const replacement = { ...state, constructionSites: [{ ...site, id: 'replacement-site' }] };
      assert.equal(bindEntry(replacement, entry, fixed), null, 'a new site cannot substitute for the offered one');
      const progressed = { ...state, constructionSites: [{ ...site, delivered: { timber: 1 } }] };
      assert.deepEqual(bindEntry(progressed, entry, fixed)?.authoredContext, bound.authoredContext, 'original observations remain pinned');
    }
    assert.equal(v4EnabledChoices(state, entry, bound).includes(held), false);
    const weighed = weighOffer(state, { id: 'offer:' + id, entryId: id, source: 'v4', boundId: '', bound: fixed,
      offeredTick: state.tick, deadline: state.tick + 1000, status: 'offered', receipt: { draw: 0, chancePermille: 1000, conditions: [] } });
    assert.ok(weighed && weighed.choices.length >= 2);
    assert.deepEqual(weighed.weights, [], id + ' is routine stewardship');
  }
});
