import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { BUILDING_CONFIG_BY_KIND, type Building } from '../src/content/buildingConfig';
import type { GameState } from '../src/engine/engine.types';
import { logisticsContext } from '../src/engine/registryLogisticsContext';
import { bindEntry, boundIdentities, registryV4Support, runCommands, v4Candidates, v4EnabledChoices, v4Entry } from '../src/engine/registryV4';
import { stateCalendar } from '../src/engine/scenarioState';
import { initialAgency } from '../src/engine/townAgency';
import { decodeSave } from '../src/save/saveCodec';

function fixture(): GameState {
  const state = decodeSave(new Uint8Array(readFileSync('fixtures/saves/v49/chapter-two-town.save.json'))).envelope.state;
  const house = state.houses.find(item => item.residents > 0);
  const person = state.persons?.people.find(item => item.alive);
  assert.ok(house && person);
  const barn: Building = { id: 'barn', kind: 'farmstead', tx: 5, ty: 5, workers: 0, inventory: { wheat: 20 },
    reserved: {}, stockReserved: {}, productionProgress: 0, stuckSinceTick: { wheat: 0 } };
  return { ...state, agency: initialAgency(), buildings: [barn, { ...barn, id: 'granary', kind: 'granary', tx: 20, ty: 20, inventory: {}, workers: 2 }],
    tiles: state.tiles.map(tile => ({ ...tile, hasRoad: true })), roadRevision: 99,
    persons: { people: [{ ...person, id: 'carter', householdId: house.buildingId, role: 'head', birthYear: stateCalendar(state).year - 30 }], past: [], nextOrdinal: 2 },
    houses: [house], trades: { households: [{ houseId: house.buildingId, tradeId: 'carter', sinceTick: 0,
      workshop: 'front_shop', productivityPermille: 1000, idleSeasons: 0,
      receipt: { tick: 0, reasons: [], score: 1, chancePermille: 1000, of: 1 } }],
      stock: {}, chains: {}, streets: [], haulage: { season: 0, last: 0 }, quits: [] } };
}

test('170 binds its real registry condition and preserves the cause after a partial grain movement', () => {
  const original = fixture();
  const { ledger: _ledger, ...funded } = original;
  const state: GameState = { ...funded, treasuryCoin: 500, timberOrder: 8,
    tick: original.tick + (1348 - stateCalendar(original).year) * 4000 };
  const entry = v4Entry('ck_evt_170');
  assert.ok(entry);
  const bound = bindEntry(state, entry);
  assert.ok(bound);
  const identity = boundIdentities(bound);
  assert.deepEqual(v4EnabledChoices(state, entry, bound), ['c']);
  const support = registryV4Support().find(item => item.id === entry.id);
  assert.equal(support?.runs, false);
  assert.ok(!v4Candidates(state, []).some(candidate => candidate.entry.id === entry.id));
  assert.match(support?.reason ?? '', /^held [(]DEC-TRACE[)]/);
  const moved: GameState = { ...state, buildings: state.buildings.map(building => building.id === 'barn'
    ? { ...building, inventory: { wheat: 19 } } : building) };
  assert.deepEqual(bindEntry(moved, entry, identity)?.authoredContext, bound.authoredContext);
  const choice = entry.choices.find(item => item.id === 'a');
  assert.ok(choice);
  const after = runCommands(moved, choice.commands, { state: moved, bound, vars: {} });
  assert.equal(after?.agency?.subsidies.find(item => item.kind === 'granary')?.amount, 32);
  const staffed: GameState = { ...state, buildings: state.buildings.map(building => building.id === 'barn'
    ? { ...building, workers: 4 } : building) };
  assert.equal(bindEntry(staffed, entry, identity), null);
});

test('170 binds a living carter household to an understaffed grain output with movable stock', () => {
  const state = fixture();
  const before = JSON.stringify(state);
  const context = logisticsContext(state);
  assert.ok(context);
  assert.equal(context.subjectKey, 'barn');
  assert.deepEqual(context.partyIds, ['carter']);
  assert.deepEqual(context, logisticsContext({ ...state, tick: state.tick + 1 }));
  assert.equal(JSON.stringify(state), before);
});

test('170 rejects stock congestion without a causal labour shortage and missing transport demand', () => {
  const state = fixture();
  const changeBarn = (overrides: Partial<Building>): GameState => ({ ...state,
    buildings: state.buildings.map(item => item.id === 'barn' ? { ...item, ...overrides } : item) });
  assert.equal(logisticsContext(changeBarn({ workers: 4, inventory: { wheat: 1000 } })), null);
  assert.equal(logisticsContext(changeBarn({ inventory: {} })), null);
  assert.equal(logisticsContext(changeBarn({ stockReserved: { wheat: 20 } })), null);
  assert.equal(logisticsContext({ ...state, buildings: state.buildings.filter(item => item.id !== 'granary') }), null);
  assert.equal(logisticsContext({ ...state, buildings: state.buildings.map(item => item.id === 'granary'
    ? { ...item, inventory: { wheat: BUILDING_CONFIG_BY_KIND.granary.storageCapacity } } : item) }), null);
  assert.equal(logisticsContext({ ...state, tiles: state.tiles.map(tile => ({ ...tile, hasRoad: false })), roadRevision: 100 }), null);
});

test('170 cannot invent a sender from an unrelated, dead, absent or child resident', () => {
  const state = fixture();
  assert.ok(state.persons && state.trades);
  assert.equal(logisticsContext({ ...state, trades: { ...state.trades, households: [] } }), null);
  for (const change of [{ alive: false }, { leftYear: stateCalendar(state).year }, { role: 'child' as const },
    { birthYear: stateCalendar(state).year - 10 }, { birthYear: stateCalendar(state).year - 15 }]) {
    assert.equal(logisticsContext({ ...state, persons: { ...state.persons, people: state.persons.people.map(item => ({ ...item, ...change })) } }), null);
  }
  assert.ok(logisticsContext({ ...state, persons: { ...state.persons,
    people: state.persons.people.map(item => ({ ...item, birthYear: stateCalendar(state).year - 16 })) } }));
  assert.equal(logisticsContext({ ...state, houses: [] }), null);
  const { agency: _agency, ...withoutAgency } = state;
  assert.equal(logisticsContext(withoutAgency), null);
});

test('170 fixed registry bindings reject a new stock episode, substituted building or carter', () => {
  const base = fixture();
  const state: GameState = { ...base, tick: base.tick + (1348 - stateCalendar(base).year) * 4000 };
  const entry = v4Entry('ck_evt_170');
  assert.ok(entry && state.persons);
  const bound = bindEntry(state, entry);
  assert.ok(bound);
  const identity = boundIdentities(bound);
  const changedEpisode = { ...state, buildings: state.buildings.map(item => item.id === 'barn'
    ? { ...item, stuckSinceTick: { wheat: 1 } } : item) };
  assert.equal(bindEntry(changedEpisode, entry, identity), null);
  const changedBuilding = { ...state, buildings: state.buildings.map(item => item.id === 'barn' ? { ...item, id: 'replacement-barn' } : item) };
  assert.equal(bindEntry(changedBuilding, entry, identity), null);
  const changedCarter = { ...state, persons: { ...state.persons, people: state.persons.people.map(item => ({ ...item, id: 'replacement-carter' })) } };
  assert.equal(bindEntry(changedCarter, entry, identity), null);
});
