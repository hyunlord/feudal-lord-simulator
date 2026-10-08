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
  const carpentry: GameState = { ...state, trades: { households: [trade(house.buildingId, 'carpenter', 50)], stock: {}, chains: {}, streets: [], haulage: { season: 0, last: 0 }, quits: [] } };
  const baking: GameState = { ...state, trades: { households: [trade(house.buildingId, 'baker', 50)], stock: {}, chains: {}, streets: [], haulage: { season: 0, last: 0 }, quits: [] } };
  return { state, carpentry, baking, site };
}

test('062 065 068 085 bind real pinned facts but never become registry candidates', async () => {
  const { bindEntry, boundIdentities, registryV4Support, v4Candidates, v4Entry } = await import('../src/engine/registryV4');
  const { state, carpentry, baking } = premises();
  const examples: readonly { readonly id: string; readonly state: GameState; readonly missing: GameState }[] = [
    { id: 'ck_evt_062', state: carpentry, missing: { ...carpentry, constructionSites: [] } },
    { id: 'ck_evt_065', state, missing: { ...state, buildings: state.buildings.filter(item => item.kind !== 'farmstead') } },
    { id: 'ck_evt_068', state, missing: { ...state, agency: { ...initialAgency(), receipts: [] } } },
    { id: 'ck_evt_085', state: baking, missing: { ...baking, houses: baking.houses.map(item => ({ ...item, hasWater: true })) } },
  ];
  for (const example of examples) {
    // Given: actual premises satisfying the canonical entry, with exact source identities.
    const entry = v4Entry(example.id);
    assert.ok(entry);
    const bound = bindEntry(example.state, entry);
    assert.ok(bound, example.id);
    const fixed = boundIdentities(bound);
    // When: the same facts are rechecked, then their causal source disappears.
    assert.deepEqual(bindEntry(example.state, entry, fixed), bound);
    assert.equal(bindEntry(example.missing, entry, fixed), null);
    // Then: an available factual adapter never bypasses the decision hold.
    const support = registryV4Support().find(item => item.id === example.id);
    assert.equal(support?.runs, false);
    assert.match(support?.reason ?? '', /^held [(]DEC-TRACE[)]/);
    assert.ok(!v4Candidates(example.state, []).some(item => item.entry.id === example.id));
  }
});

test('held contexts reject replacement sources while retaining partial material movement', () => {
  const { state, carpentry, site } = premises();
  const logs = petitionContext(carpentry, 'ck_evt_062', {});
  const paid = petitionContext(state, 'ck_evt_068', {});
  assert.ok(logs && paid && state.agency);
  assert.deepEqual(petitionContext({ ...carpentry, constructionSites: [{ ...site, delivered: { timber: 1 } }] }, 'ck_evt_062', {}, logs), logs);
  assert.equal(petitionContext({ ...carpentry, constructionSites: [{ ...site, id: 'replacement' }] }, 'ck_evt_062', {}, logs), null);
  assert.equal(petitionContext({ ...state, agency: { ...state.agency, receipts: state.agency.receipts.map(item => ({ ...item, id: 'replacement' })) } }, 'ck_evt_068', {}, paid), null);
});

test('068 observes aggregate post-receipt cash without attributing unrelated expense to the subsidy', () => {
  const { state } = premises();
  assert.ok(state.ledger);
  const unrelated: GameState = { ...state, ledger: { ...state.ledger, entries: [{ id: 'unrelated', tick: 11,
    account: 'cash', category: 'upkeep', amount: -9, sourceRefs: [{ type: 'actor', id: 'other-business' }] }] } };
  const context = petitionContext(unrelated, 'ck_evt_068', {});
  assert.ok(context);
  assert.deepEqual(context.triggerEvidence, { receiptId: 'paid-project', subsidyId: 'farm-support', paid: 24,
    cashDelta: -9, cashMovementIds: ['unrelated'] });
  assert.ok(unrelated.ledger);
  const profitable: GameState = { ...unrelated, ledger: { ...unrelated.ledger, entries: [...unrelated.ledger.entries,
    { id: 'income', tick: 12, account: 'cash', category: 'rent', amount: 10, sourceRefs: [{ type: 'actor', id: 'other-business' }] }] } };
  assert.equal(petitionContext(profitable, 'ck_evt_068', {}), null);
  const compacted: GameState = { ...unrelated, ledger: { ...unrelated.ledger,
    rollups: [{ periodStart: 0, periodEnd: 20, account: 'cash', byCategory: { upkeep: -9 } }] } };
  assert.equal(petitionContext(compacted, 'ck_evt_068', {}), null);
});

test('065 and 085 retain offered demand only until its target is filled or current demand contradicts it', () => {
  const { state, baking } = premises();
  for (const [id, current, target] of [['ck_evt_065', state, 'granary'], ['ck_evt_085', baking, 'well']] as const) {
    const bound = petitionContext(current, id, {});
    assert.ok(bound && current.agency?.lastWalk);
    assert.deepEqual(petitionContext({ ...current, tick: current.tick + 1000 }, id, {}, bound), bound);
    const contrary = { ...current, agency: { ...current.agency, lastWalk: { ...current.agency.lastWalk, proposals: [] } } };
    assert.equal(petitionContext(contrary, id, {}, bound), null);
    const sample = current.buildings[0];
    assert.ok(sample);
    const complete = { ...current, buildings: [...current.buildings, { ...sample, id: 'completed-target', kind: target, tx: 1, ty: 1 }] };
    assert.equal(petitionContext(complete, id, {}, bound), null);
  }
});
