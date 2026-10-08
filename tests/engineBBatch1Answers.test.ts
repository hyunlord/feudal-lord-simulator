import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { GameState } from '../src/engine/engine.types';
import { estatesOf } from '../src/engine/estates';
import { EMPTY_STEWARDSHIP } from '../src/engine/stewardship';
import { initialAgency } from '../src/engine/townAgency';
import { decodeSave } from '../src/save/saveCodec';
import { bindEntry, boundIdentities, v4Entry } from '../src/engine/registryV4';
import { answerRegistryOffer, initialRegistry, offerChoices, registryOf } from '../src/engine/registry';
import type { TradeId } from '../src/content/trades';
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

function repairTown(tradeId: TradeId = 'carpenter'): GameState {
  const base = town();
  const person = base.persons?.people[0];
  assert.ok(person);
  return { ...base, timberOrder: 0, constructionSites: [{ id: 'repair', kind: 'house', tx: 1, ty: 1,
    required: { timber: 20 }, delivered: {}, reserved: {}, builderTicks: 0, requiredBuilderTicks: 100,
    assignedBuilders: 1, stall: 'awaiting_materials', startedTick: 2, rebuildOf: person.householdId }],
    trades: { households: [{ houseId: person.householdId, tradeId, sinceTick: 0, workshop: 'front_shop',
      productivityPermille: 1000, idleSeasons: 0, receipt: { tick: 0, reasons: [], score: 1, chancePermille: 1000, of: 1 } }],
      stock: {}, chains: {}, streets: [], haulage: { season: 0, last: 0 }, quits: [] } };
}
function offered(state: GameState, id: string): GameState {
  const entry = v4Entry(id);
  assert.ok(entry);
  const bound = bindEntry(state, entry);
  assert.ok(bound, id);
  return { ...state, registry: { ...initialRegistry(), occurrences: [{ id: 'answer:' + id, entryId: id,
    source: 'v4', boundId: '', bound: boundIdentities(bound), offeredTick: state.tick, deadline: state.tick + 1000,
    status: 'offered', receipt: { draw: 0, chancePermille: 1000, conditions: [] } }] } };
}
for (const trade of ['cooper', 'wheelwright'] as const) {
  test(`090 rejects a ${trade} as the carpenter sender, including answer-time revalidation`, () => {
    // Given: a real carpenter offer, followed by the same household changing trade.
    const entry = v4Entry('ck_evt_090');
    assert.ok(entry);
    const original = offered(repairTown(), entry.id);
    const trades = repairTown(trade).trades;
    assert.ok(trades);
    const changed: GameState = { ...original, trades };
    // When: fresh binding and the existing offer's answer are attempted.
    assert.equal(bindEntry(repairTown(trade), entry), null);
    const answer = answerRegistryOffer(changed, 'answer:' + entry.id, 'c');
    // Then: the non-carpenter cannot substantiate the sender or enact either command.
    assert.equal(registryOf(answer).occurrences[0]?.status, 'invalid');
    assert.equal(answer.timberOrder, changed.timberOrder);
    assert.deepEqual(answer.agency, changed.agency);
  });
}
const cases = [
  { id: 'ck_evt_061', choice: 'b', estate: true },
  { id: 'ck_evt_077', choice: 'a', estate: true },
  { id: 'ck_evt_083', choice: 'a', estate: false },
  { id: 'ck_evt_090', choice: 'c', estate: false },
  { id: 'ck_evt_092', choice: 'a', estate: false },
] as const;
for (const row of cases) {
  test(`${row.id} applies its actual registry answer and refuses a second answer`, () => {
    // Given: a factual, source-pinned offer with an enabled consequential choice.
    const state = offered(row.estate ? delegated() : repairTown(), row.id);
    const occurrence = registryOf(state).occurrences[0];
    assert.ok(occurrence);
    assert.ok(offerChoices(state, occurrence).includes(row.choice));
    // When: the real registry answer path runs.
    const after = answerRegistryOffer(state, occurrence.id, row.choice);
    // Then: the offer settles and its concrete commands change the expected settings.
    assert.equal(registryOf(after).occurrences[0]?.status, 'answered');
    assert.equal(registryOf(after).occurrences[0]?.choiceId, row.choice);
    if (row.estate) {
      assert.equal(after.stewardship?.rules.rights, true);
      assert.equal(after.stewardship?.rules.amountAtLeast, row.id === 'ck_evt_061' ? 40 : 80);
    } else if (row.id === 'ck_evt_092') assert.equal(after.agency?.duesPermille, 1000);
    else assert.equal(after.timberOrder, row.id === 'ck_evt_083' ? 16 : 6);
    if (row.id === 'ck_evt_090') assert.equal(after.agency?.subsidies.find(item => item.kind === 'sawmill')?.amount, 12);
    assert.equal(answerRegistryOffer(after, occurrence.id, row.choice), after);
  });
  test(`${row.id} invalidates when its causal source disappears immediately before answering`, () => {
    // Given: the originally offered petition, site or market no longer exists.
    const original = offered(row.estate ? delegated() : repairTown(), row.id);
    let state: GameState;
    if (row.estate) {
      assert.ok(original.stewardship);
      state = { ...original, stewardship: { ...original.stewardship, petitions: [] } };
    } else if (row.id === 'ck_evt_092') state = { ...original, buildings: original.buildings.filter(item => item.kind !== 'market') };
    else state = { ...original, constructionSites: [] };
    // When: the real answer path revalidates the saved binding.
    const after = answerRegistryOffer(state, 'answer:' + row.id, row.choice);
    // Then: no command effect is applied; only the occurrence becomes invalid.
    assert.equal(registryOf(after).occurrences[0]?.status, 'invalid');
    assert.equal(after.timberOrder, state.timberOrder);
    assert.deepEqual(after.agency, state.agency);
    assert.deepEqual(after.stewardship, state.stewardship);
    assert.equal(after.treasuryCoin, state.treasuryCoin);
  });
}

test('090 combined answer does not place a partial timber order when subsidy funding disappears', () => {
  // Given: an offered combined choice whose subsidy is unaffordable at answer time.
  const original = offered(repairTown(), 'ck_evt_090');
  const state: GameState = { ...original, treasuryCoin: 0, ledger: { entries: [], rollups: [], nextEntryOrdinal: 1 } };
  // When: the combined order/subsidy answer is attempted.
  const after = answerRegistryOffer(state, 'answer:ck_evt_090', 'c');
  // Then: neither half of the choice executes and the offer remains unanswered.
  assert.equal(after, state);
  assert.equal(after.timberOrder, 0);
  assert.equal(after.agency?.subsidies.length, 0);
  assert.equal(registryOf(after).occurrences[0]?.status, 'offered');
});

for (const [id, heldChoice] of [['ck_evt_083', 'b'], ['ck_evt_090', 'b'], ['ck_evt_092', 'c']] as const) {
  test(`${id} refuses its held choice through the real answer path`, () => {
    // Given: a factual offer whose indirect choice remains held.
    const state = offered(repairTown(), id);
    // When: the held choice is submitted directly.
    const after = answerRegistryOffer(state, 'answer:' + id, heldChoice);
    // Then: bypassing the UI cannot apply the held policy or subsidy.
    assert.equal(after, state);
  });
}
