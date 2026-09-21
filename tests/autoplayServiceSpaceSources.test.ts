import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_GAME_STATE } from '../src/state/gameStore';
import type { GameState } from '../src/engine/engine.types';
import { preservesAutoplayServiceSpace } from '../src/engine/autoplayServiceSpace';
import { potentialServiceRoads, serviceCandidate, serviceFootprint, serviceTileKey, serviceWitnessRoads } from '../src/engine/autoplayServiceSpaceRoutes';

function fixture(treasuryTimber: number, timber: number): GameState {
  const buildings = [serviceCandidate('house', { tx: 5, ty: 5 }, 'home'),
    { ...serviceCandidate('well', { tx: 2, ty: 5 }, 'generic-source'), inventory: { timber } }];
  const owners = new Map(buildings.flatMap(building => serviceFootprint(building).map(tile => [serviceTileKey(tile), building.id] as const)));
  return { ...structuredClone(DEFAULT_GAME_STATE), width: 20, height: 20, buildings, houses: [], constructionSites: [], palisade: null, treasuryTimber,
    tiles: Array.from({ length: 400 }, (_, index) => {
      const point = { tx: index % 20, ty: Math.floor(index / 20) };
      return { ...point, terrain: 'grass', buildingId: owners.get(serviceTileKey(point)) ?? null, hasRoad: point.ty === 6 };
    }) };
}
const action = { kind: 'place_building', building: 'house', tx: 5, ty: 8 } as const;
for (const source of ['treasury', 'generic-stock'] as const) {
  test(`Given ${source} eligibility changes When the same layout is queried Then source membership invalidates cached witnesses in both directions`, () => {
    const state = fixture(0, 0);
    const withSource = (amount: number): GameState => ({ ...state,
      treasuryTimber: source === 'treasury' ? amount : 0,
      buildings: state.buildings.map(building => building.id === 'generic-source'
        ? { ...building, inventory: { timber: source === 'generic-stock' ? amount : 0 } } : building) });
    assert.equal(preservesAutoplayServiceSpace(withSource(0), action), false);
    assert.equal(preservesAutoplayServiceSpace(withSource(1), action), true);
    assert.equal(preservesAutoplayServiceSpace(withSource(9), action), true);
    assert.equal(preservesAutoplayServiceSpace(withSource(0), action), false);
    assert.equal(preservesAutoplayServiceSpace(withSource(1), action), true);
  });
}

test('Given a stocked generic source across impassable water When service paths exist locally Then no supply route is fabricated', () => {
  const initial = fixture(0, 20);
  const state = { ...initial, tiles: initial.tiles.map(tile => tile.tx === 3 ? { ...tile, terrain: 'water' as const, hasRoad: false } : tile) };
  const home = state.buildings[0]; assert.ok(home);
  const providers = [serviceCandidate('market', { tx: 8, ty: 5 }, 'market'), serviceCandidate('church', { tx: 8, ty: 8 }, 'church')];
  const potential = potentialServiceRoads(state, [...state.buildings, ...providers]);
  assert.equal(serviceWitnessRoads(state, potential, home, providers), null);
});

test('Given treasury without a completed home When projecting its first house Then the new building cannot supply its own future facilities', () => {
  const initial = fixture(10, 0);
  const state = { ...initial, buildings: initial.buildings.filter(building => building.kind !== 'house'),
    tiles: initial.tiles.map(tile => tile.buildingId === 'home' ? { ...tile, buildingId: null } : tile) };
  assert.equal(preservesAutoplayServiceSpace(state, action), false);
});

test('Given an existing supply source without an adjacent road When dry future roads can connect it Then the concrete witness includes that source perimeter', () => {
  const initial = fixture(0, 20);
  const state = { ...initial, tiles: initial.tiles.map(tile => ({ ...tile, hasRoad: false })) };
  const home = state.buildings[0]; const source = state.buildings[1]; assert.ok(home && source);
  const providers = [serviceCandidate('market', { tx: 8, ty: 5 }, 'market'), serviceCandidate('church', { tx: 8, ty: 8 }, 'church')];
  const potential = potentialServiceRoads(state, [...state.buildings, ...providers]);
  const roads = serviceWitnessRoads(state, potential, home, providers);
  assert.ok(roads);
  assert.ok(['1,5', '2,4', '2,6', '3,5'].some(tile => roads.has(tile)));
});
