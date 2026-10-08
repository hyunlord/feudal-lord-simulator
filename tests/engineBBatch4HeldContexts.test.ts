import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { GameState } from '../src/engine/engine.types';
import { petitionContext } from '../src/engine/registryPetitionContext';
import { walkKey } from '../src/engine/townAgency';
import type { TradeId } from '../src/content/trades';
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

function premises() {
  const base = town();
  const resident = base.persons?.people[0];
  const house = base.houses.find(item => item.buildingId === resident?.householdId);
  const building = base.buildings[0];
  assert.ok(resident && house && building);
  const trade = (houseId: string, tradeId: TradeId, sinceTick: number) => ({ houseId, tradeId, sinceTick,
    workshop: 'front_shop' as const, productivityPermille: 1000, idleSeasons: 0,
    receipt: { tick: sinceTick, reasons: [], score: 1, chancePermille: 1000, of: 1 } });
  const artisan = { ...resident, id: 'artisan', classBand: 'artisan' as const, tags: ['reeve', 'manager:full-store'] };
  const secondHouse = { ...house, buildingId: 'second-house' };
  const second = { ...artisan, id: 'second-person', householdId: secondHouse.buildingId };
  const site = { id: 'repair-site', kind: 'house' as const, tx: 1, ty: 1, required: { timber: 20 }, delivered: {}, reserved: {},
    builderTicks: 0, requiredBuilderTicks: 100, assignedBuilders: 1, stall: 'awaiting_materials' as const, startedTick: 2, rebuildOf: house.buildingId };
  const receipt = { id: 'paid-project', tick: 10, actor: 'households' as const, what: 'farmstead', tx: 1, ty: 1, siteId: 'farm',
    planner: 'food', rank: 1, reasons: [], score: 1, cost: 30, subsidy: 24, loan: 0, decisionIds: [] };
  const world: GameState = { ...base, tick: 100, treasuryTimber: 0, treasuryCoin: 160,
    houses: [{ ...house, hasWater: false }, secondHouse],
    persons: { people: [resident, artisan, second, { ...resident, id: 'clerk', householdId: 'manor', role: 'steward' }], past: [], nextOrdinal: 4 },
    agency: { ...initialAgency(), duesPermille: 1200, subsidies: [{ id: 'farm-support', kind: 'farmstead', amount: 24 }, { id: 'market-support', kind: 'market', amount: 32 }], receipts: [receipt] },
    buildings: [...base.buildings.filter(item => item.kind === 'market'),
      { ...building, id: 'farm', kind: 'farmstead', inventory: { wheat: 10, barley: 10, logs: 10 } },
      { ...building, id: 'full-store', kind: 'storehouse', inventory: { logs: 200 } }],
    constructionSites: [site], timberOrder: 24,
    money: { crossings: {}, millWheat: {}, arrears: [{ tick: 20, amount: 5, facility: { type: 'building', id: 'farm' } }] },
    ledger: { entries: [{ id: 'expense', tick: 10, account: 'cash', category: 'project_subsidy', amount: -24, sourceRefs: [{ type: 'actor', id: 'households' }] }], rollups: [], nextEntryOrdinal: 2 },
    trades: { households: [trade(house.buildingId, 'brewer', 50), trade(secondHouse.buildingId, 'miller', 50)], stock: {}, chains: {}, streets: [], haulage: { season: 0, last: 0 }, quits: [{ houseId: 'old-shop', tradeId: 'merchant', tick: 40 }] },
    history: { records: [{ id: 'arrival', tick: 20, kind: 'person', template: 'person.move_in', subject: { type: 'person', id: artisan.id }, actors: [{ type: 'household', id: house.buildingId }], severity: 0 }], snapshots: [], nextOrdinal: 2, seasonDecisions: {}, milestones: [], pendingActuals: [] },
  };
  const kinds = ['farmstead', 'granary', 'mill', 'well', 'market', 'storehouse'] as const;
  const state: GameState = { ...world, agency: { ...(world.agency ?? initialAgency()), lastWalk: {
    tick: world.tick, key: walkKey(world), needs: [], requests: [], fundThreshold: null, idleWeeks: 1,
    proposals: kinds.map(kind => ({ actor: 'community', what: kind, planner: 'need', rank: 1, action: { kind: 'place_building', building: kind, tx: 1, ty: 1 }, tx: 1, ty: 1, reasons: [{ name: 'need', value: 10 }], score: 10, cost: 10, subsidy: 0 })),
  } } };
  return { state, resident, house };
}

test('087 088 093 095 100 bind and pin their sources but stay outside every candidate draw', async () => {
  const { bindEntry, boundIdentities, registryV4Support, v4Candidates, v4Entry } = await import('../src/engine/registryV4');
  const { state } = premises();
  assert.ok(state.trades && state.agency && state.history);
  const { ledger: _ledger, ...withoutLedger } = state;
  const budget: GameState = { ...withoutLedger, treasuryCoin: 200 };
  const examples: readonly { readonly id: string; readonly state: GameState; readonly missing: GameState; readonly replaced: GameState }[] = [
    { id: 'ck_evt_087', state, missing: { ...state, trades: { ...state.trades, quits: [] } },
      replaced: { ...state, trades: { ...state.trades, quits: state.trades.quits.map(item => ({ ...item, tick: 39 })) } } },
    { id: 'ck_evt_088', state, missing: { ...state, trades: { ...state.trades, households: [] } },
      replaced: { ...state, trades: { ...state.trades, households: state.trades.households.map(item => ({ ...item, houseId: 'replacement-house' })) } } },
    { id: 'ck_evt_093', state, missing: { ...state, history: { ...state.history, records: [] } },
      replaced: { ...state, history: { ...state.history, records: state.history.records.map(item => ({ ...item, id: 'replacement-arrival' })) } } },
    { id: 'ck_evt_095', state: budget, missing: { ...budget, treasuryCoin: 2000 },
      replaced: { ...budget, agency: { ...state.agency, subsidies: state.agency.subsidies.map(item => ({ ...item, id: 'replacement-support' })) } } },
    { id: 'ck_evt_100', state, missing: { ...state, buildings: state.buildings.filter(item => item.kind !== 'storehouse') },
      replaced: { ...state, buildings: state.buildings.map(item => item.kind === 'storehouse' ? { ...item, id: 'replacement-store' } : item) } },
  ];
  for (const example of examples) {
    // Given: real source identities satisfy the canonical factual adapter.
    const entry = v4Entry(example.id);
    assert.ok(entry);
    const bound = bindEntry(example.state, entry);
    assert.ok(bound, example.id);
    const fixed = boundIdentities(bound);
    // When: the original source is rechecked, removed, or replaced.
    assert.deepEqual(bindEntry(example.state, entry, fixed), bound);
    assert.equal(bindEntry(example.missing, entry, fixed), null, `${example.id}: missing`);
    assert.equal(bindEntry(example.replaced, entry, fixed), null, `${example.id}: replacement`);
    // Then: even a valid factual context cannot bypass the whole-event hold.
    const support = registryV4Support().find(item => item.id === example.id);
    assert.equal(support?.runs, false);
    assert.match(support?.reason ?? '', /^held [(]DEC-TRACE[)]/);
    assert.ok(!v4Candidates(example.state, []).some(item => item.entry.id === example.id));
  }
});

test('087 proves temporal coexistence and 095 proves budget pressure without stronger causal claims', () => {
  const { state, house } = premises();
  const opening = petitionContext(state, 'ck_evt_087', {});
  assert.ok(opening);
  assert.deepEqual(opening.triggerEvidence, { closed: { houseId: 'old-shop', tradeId: 'merchant', tick: 40 },
    opened: { houseId: house.buildingId, tradeId: 'brewer', sinceTick: 50 } });
  assert.ok(state.agency);
  const receipt = state.agency.receipts[0];
  assert.ok(receipt);
  const { ledger: _ledger, ...withoutLedger } = state;
  const budget: GameState = { ...withoutLedger, treasuryCoin: 200,
    agency: { ...state.agency, receipts: [...state.agency.receipts, { ...receipt, id: 'previously-used-market', what: 'market', subsidy: 32 }] } };
  assert.ok(petitionContext(budget, 'ck_evt_095', {}), 'a previous market subsidy payment does not negate this budget-only predicate');
});

test('093 does not attribute an arriving relative to an established artisan', () => {
  const { state, resident, house } = premises();
  assert.ok(state.history);
  const unrelated: GameState = { ...state, history: { ...state.history, records: [{ id: 'kin-arrival', tick: 20,
    kind: 'person', template: 'person.arrived', subject: { type: 'person', id: resident.id },
    actors: [{ type: 'household', id: house.buildingId }], severity: 0 }] } };
  assert.equal(petitionContext(unrelated, 'ck_evt_093', {}), null);
});

test('100 rejects completed demand targets and a current contrary proposal set', () => {
  const { state } = premises();
  const context = petitionContext(state, 'ck_evt_100', {});
  assert.ok(context && state.agency?.lastWalk);
  assert.deepEqual(petitionContext({ ...state, tick: state.tick + 1000 }, 'ck_evt_100', {}, context), context);
  const contrary = { ...state, agency: { ...state.agency, lastWalk: { ...state.agency.lastWalk, proposals: [] } } };
  assert.equal(petitionContext(contrary, 'ck_evt_100', {}, context), null);
  const sample = state.buildings[0];
  assert.ok(sample);
  const complete = { ...state, buildings: [...state.buildings, { ...sample, id: 'completed-store', kind: 'storehouse' as const, tx: 1, ty: 1 }] };
  assert.equal(petitionContext(complete, 'ck_evt_100', {}, context), null);
});
