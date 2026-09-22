import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_GAME_STATE } from '../src/state/gameStore';
import { urbanServiceAction } from '../src/engine/autoplayServices';
import { BUILDING_CONFIG_BY_KIND, type Building } from '../src/content/buildingConfig';

function fixture() {
  const b = (id: string, kind: Building['kind'], tx: number, ty: number): Building => ({ id, kind, tx, ty,
    workers: BUILDING_CONFIG_BY_KIND[kind].workersRequired, inventory: kind === 'storehouse' ? { timber: 200, stone: 200 } : {}, reserved: {}, stockReserved: {}, productionProgress: 0 });
  const buildings = [b('store', 'storehouse', 2, 13), b('home', 'house', 20, 11), b('market1', 'market', 1, 10), b('market2', 'market', 4, 10)];
  return { ...structuredClone(DEFAULT_GAME_STATE), width: 30, height: 26, era: 'stone_town' as const, palisade: null, buildings, constructionSites: [], walkers: [], population: 32, idleWorkers: 16,
    houses: [{ buildingId: 'home', level: 3, residents: 32, hasWater: true, breadStock: 9, lastServicedTick: 0, unmetRequirementTicks: 0 }],
    tiles: Array.from({ length: 780 }, (_, i) => { const tx = i % 30, ty = Math.floor(i / 30); return { tx, ty, terrain: 'grass' as const, hasRoad: ty === 12 && tx >= 1 && tx <= 25,
      buildingId: buildings.find(v => tx >= v.tx && tx < v.tx + BUILDING_CONFIG_BY_KIND[v.kind].width && ty >= v.ty && ty < v.ty + BUILDING_CONFIG_BY_KIND[v.kind].height)?.id ?? null }; }) };
}

test('Given two existing markets When one remote home lacks service Then no third market is built', () => {
  const action = urbanServiceAction(fixture());
  assert.notEqual(action.kind === 'place_building' && action.building, 'market');
});

import { rankServiceCandidates } from '../src/engine/autoplayServiceCandidates';
import { allocateHouseServices } from '../src/population/serviceAllocation';
import type { ServicePlanningCollector } from '../src/engine/autoplayServices';
import { createConstructionSite } from '../src/economy/construction';

function selectionFixture() {
  const state = fixture();
  const template = state.buildings.find(b => b.kind === 'house');
  assert.ok(template);
  const homes = [{ ...template, id: 'left', tx: 0, ty: 0 }, { ...template, id: 'right', tx: 10, ty: 0 }];
  const household = state.houses[0];
  assert.ok(household);
  const allocation = { buildings: homes, houses: homes.map(home => ({ ...household, buildingId: home.id })) };
  const well = (tx: number, distance: number) => ({ building: { ...template, id: 'candidate', kind: 'well' as const, tx, ty: 0, workers: 0 }, roadDistance: distance });
  return { allocation, current: allocateHouseServices(allocation), well };
}

test('Given one candidate covers two lots When selecting water Then gain outranks the shortest road', () => {
  const { well, ...input } = selectionFixture();
  const ranked = rankServiceCandidates({ ...input, service: 'water', candidates: [well(-1, 0), well(5, 20)] });
  assert.equal(ranked[0]?.building.tx, 5);
  assert.equal(ranked[0]?.gainedLots, 2);
});

test('Given equal gains When reachable candidates arrive reversed Then shorter road and stable coordinates win', () => {
  const { well, ...input } = selectionFixture();
  const candidates = [well(4, 9), well(5, 2), well(6, 2)];
  const choose = (positions: typeof candidates) => rankServiceCandidates({ ...input, service: 'water', candidates: positions });
  assert.deepEqual(choose(candidates), choose([...candidates].reverse()));
  assert.equal(choose(candidates)[0]?.building.tx, 5);
});

test('Given existing capacity serves all homes When selecting another well Then no candidate earns gain', () => {
  const { well, allocation } = selectionFixture();
  const input = { ...allocation, buildings: [...allocation.buildings, { ...well(5, 0).building, id: 'existing' }] };
  assert.deepEqual(rankServiceCandidates({ service: 'water', allocation: input, current: allocateHouseServices(input), candidates: [well(4, 1)] }), []);
});

test('Given market workers are already promised to construction When selecting services Then shortage is diagnosed', () => {
  const state = fixture();
  state.buildings = state.buildings.filter(b => b.id !== 'market2');
  const diagnostic: ServicePlanningCollector = {};
  const action = urbanServiceAction({ ...state, population: 12, idleWorkers: 12,
    constructionSites: [createConstructionSite({ ordinal: 99, kind: 'mill', tx: 25, ty: 13, startedTick: 0 })] }, diagnostic);
  assert.notEqual(action.kind === 'place_building' && action.building, 'market');
  assert.ok(diagnostic.services?.some(entry => entry.service === 'market' && entry.reason === 'worker_shortage'));
});

test('Given two lakeside groups outside a single church radius When choosing reachable providers Then two churches cover both groups', () => {
  const { allocation, well } = selectionFixture();
  const left = allocation.buildings[0], right = allocation.buildings[1];
  assert.ok(left && right);
  const input = { ...allocation, buildings: [left, { ...right, tx: 30 }], roadService: (home: Building, church: Building) => Math.abs(home.tx - church.tx) < 5 };
  const candidates = [0, 30].map(tx => ({ ...well(tx, 1), building: { ...well(tx, 1).building, kind: 'church' as const } }));
  const first = rankServiceCandidates({ service: 'church', allocation: input, current: allocateHouseServices(input), candidates })[0];
  assert.ok(first);
  const next = { ...input, buildings: [...input.buildings, { ...first.building, id: 'church-one' }] };
  const second = rankServiceCandidates({ service: 'church', allocation: next, current: allocateHouseServices(next), candidates })[0];
  assert.ok(second);
  assert.notEqual(first.building.tx, second.building.tx);
  const completed = allocateHouseServices({ ...next, buildings: [...next.buildings, { ...second.building, id: 'church-two' }] });
  assert.ok([...completed.houses.values()].every(home => home.church.kind === 'served'));
});

test('Given geometric coverage across a disconnected road component When scoring market sites Then inaccessible homes earn no gain', () => {
  const { allocation, well } = selectionFixture();
  const input = { ...allocation, roadService: () => false };
  const candidate = { ...well(5, 1), building: { ...well(5, 1).building, kind: 'market' as const, workers: 3 } };
  assert.deepEqual(rankServiceCandidates({ service: 'market', allocation: input, current: allocateHouseServices(input), candidates: [candidate] }), []);
});

test('Given thirteen waterless lots When scoring a single well Then its gain respects twelve-lot capacity', () => {
  const { allocation, well } = selectionFixture();
  const template = allocation.buildings[0], house = allocation.houses[0];
  assert.ok(template && house);
  const buildings = Array.from({ length: 13 }, (_, index) => ({ ...template, id: `home-${index}`, tx: index % 4, ty: Math.floor(index / 4) }));
  const input = { buildings, houses: buildings.map(home => ({ ...house, buildingId: home.id })) };
  const ranked = rankServiceCandidates({ service: 'water', allocation: input, current: allocateHouseServices(input), candidates: [well(2, 1)] });
  assert.equal(ranked[0]?.gainedLots, 12);
});

import { findAutoplayServiceWitness } from '../src/engine/autoplayServiceSpaceWitness';

test('Given exhausted market slots When a remote home has a hypothetical third pad Then no budget-valid service witness exists', () => {
  const state = fixture();
  const home = state.buildings.find(building => building.kind === 'house');
  assert.ok(home);
  assert.equal(findAutoplayServiceWitness(state, home), null);
  const spare = { ...state, buildings: state.buildings.filter(building => building.id !== 'market2'),
    tiles: state.tiles.map(tile => tile.buildingId === 'market2' ? { ...tile, buildingId: null } : tile) };
  assert.ok(findAutoplayServiceWitness(spare, home), 'an unused slot must still permit reachable future service');
});

test('Given the second market is under construction When a remote home needs another provider Then the planned slot counts against its witness', () => {
  const state = fixture();
  const home = state.buildings.find(building => building.kind === 'house');
  assert.ok(home);
  const pending = { ...state, buildings: state.buildings.filter(building => building.id !== 'market2'),
    constructionSites: [createConstructionSite({ ordinal: 998, kind: 'market', tx: 4, ty: 10, startedTick: state.tick })] };
  assert.equal(findAutoplayServiceWitness(pending, home), null);
});

import { hasBudgetedServicePlan } from '../src/engine/autoplayServiceBudget';

test('Given three distant housing groups When each has a local service pad Then a two-market joint budget still rejects the layout', () => {
  const base = fixture();
  const template = base.buildings.find(building => building.kind === 'house');
  const household = base.houses[0];
  assert.ok(template && household);
  const homes = [{ ...template, id: 'a', tx: 1, ty: 1 }, { ...template, id: 'b', tx: 28, ty: 1 }, { ...template, id: 'c', tx: 14, ty: 24 }];
  const buildings = [...base.buildings.filter(building => building.kind === 'storehouse'), ...homes];
  const state = { ...base, buildings, houses: homes.map(home => ({ ...household, buildingId: home.id })),
    tiles: base.tiles.map(tile => ({ ...tile, buildingId: buildings.find(building => serviceFootprint(building).some(point => point.tx === tile.tx && point.ty === tile.ty))?.id ?? null })) };
  assert.ok(homes.every(home => findAutoplayServiceWitness(state, home) !== null));
  assert.equal(hasBudgetedServicePlan(state), false);
  const compact = { ...state, buildings: buildings.filter(building => building.id !== 'c'), houses: state.houses.filter(home => home.buildingId !== 'c'),
    tiles: state.tiles.map(tile => tile.buildingId === 'c' ? { ...tile, buildingId: null } : tile) };
  assert.equal(hasBudgetedServicePlan(compact), true);
  const isolated = { kind: 'place_building', building: 'house', tx: 14, ty: 24 } as const;
  assert.equal(preservesAutoplayServiceSpace(compact, isolated), false, 'new housing cannot rely on three different imaginary markets');
  const wastedSlot = { kind: 'place_building', building: 'market', tx: 14, ty: 20 } as const;
  assert.equal(preservesAutoplayServiceSpace(compact, wastedSlot), false, 'the first facility must leave a feasible shared remaining slot');
  const servedSide = { kind: 'place_building', building: 'market', tx: 2, ty: 3 } as const;
  assert.equal(preservesAutoplayServiceSpace(compact, servedSide), true);
  assert.equal(preservesAutoplayServiceSpace({ ...compact, buildings: [...compact.buildings].reverse(), houses: [...compact.houses].reverse() }, isolated), false);
  assert.equal(preservesAutoplayServiceSpace(compact, servedSide), true, 'a cached rejection must not poison another geometry');
});

import { serviceFootprint } from '../src/engine/autoplayServiceSpaceRoutes';

import { preservesAutoplayServiceSpace } from '../src/engine/autoplayServiceSpace';
