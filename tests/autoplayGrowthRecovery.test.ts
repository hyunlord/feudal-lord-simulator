import assert from 'node:assert/strict';
import test from 'node:test';
import { BUILDING_CONFIG_BY_KIND, type Building } from '../src/content/buildingConfig';
import { createConstructionSite } from '../src/economy/construction';
import { decideNextAction } from '../src/engine/autoplay';
import { urbanServiceAction } from '../src/engine/autoplayServices';
import { householdServices } from '../src/engine/householdServices';
import type { GameState } from '../src/engine/engine.types';
import { DEFAULT_GAME_STATE, gameReducer } from '../src/state/gameStore';
import { autoplayActionToGameAction } from '../src/engine/autoplayActions';
import { canPlaceBuilding } from '../src/world/placement';

function building(id: string, kind: Building['kind'], tx: number, ty: number): Building {
  return { id, kind, tx, ty, workers: BUILDING_CONFIG_BY_KIND[kind].workersRequired,
    inventory: kind === 'storehouse' ? { timber: 100, stone: 100 } : {},
    reserved: {}, stockReserved: {}, productionProgress: 0 };
}

function retile(state: GameState): GameState {
  return { ...state, tiles: Array.from({ length: 30 * 20 }, (_, i) => {
    const tx = i % 30, ty = Math.floor(i / 30);
    const owner = state.buildings.find(b => tx >= b.tx && tx < b.tx + BUILDING_CONFIG_BY_KIND[b.kind].width
      && ty >= b.ty && ty < b.ty + BUILDING_CONFIG_BY_KIND[b.kind].height);
    return { tx, ty, terrain: 'grass', buildingId: owner?.id ?? null,
      hasRoad: !owner && ((ty === 7 || ty === 11) && tx >= 3 && tx <= 25 || tx === 3 && ty >= 7 && ty <= 11) };
  }) };
}

function fixture(): GameState {
  const homes = Array.from({ length: 8 }, (_, i) => building(`home-${i}`, 'house', 6 + i, 10));
  return retile({ ...structuredClone(DEFAULT_GAME_STATE), width: 30, height: 20, era: 'stone_town',
    palisade: null, constructionSites: [], walkers: [], population: 176, idleWorkers: 20, treasuryTimber: 500,
    houses: homes.map(home => ({ buildingId: home.id, level: 3, residents: 22, breadStock: 20,
      hasWater: true, lastServicedTick: 0, unmetRequirementTicks: 0 })),
    buildings: [...homes, building('well', 'well', 9, 9), building('market', 'market', 10, 12),
      building('church', 'church', 15, 12), building('store', 'storehouse', 20, 12),
      building('granary-a', 'granary', 20, 8), building('granary-b', 'granary', 23, 8),
      ...Array.from({ length: 6 }, (_, i) => building(`farm-${i}`, 'wheat_farm', 5 + i * 3, 5)),
      ...Array.from({ length: 4 }, (_, i) => building(`mill-${i}`, 'mill', 5 + i * 3, 8))] });
}

for (const firstMarket of [false, true]) {
  test(`Palisade ${firstMarket ? 'first' : 'replacement'} market increases residential service`, () => {
    const base = fixture();
    const state = retile({ ...base, era: 'palisade', buildings: base.buildings.flatMap(b =>
      b.kind === 'church' ? [] : b.kind === 'market' ? firstMarket ? [] : [{ ...b, tx: 24, ty: 12 }] : [b]) });
    assert.equal([...householdServices(state).houses.values()].filter(h => h.market.kind === 'served').length, 0);
    const action = decideNextAction(state);
    assert.equal(action.kind, 'place_building');
    if (action.kind !== 'place_building') return;
    assert.equal(action.building, 'market');
    assert.deepEqual(canPlaceBuilding(state, action.building, action.tx, action.ty), { ok: true });
    const candidate = building('candidate', 'market', action.tx, action.ty);
    assert.ok([...householdServices({ ...state, buildings: [...state.buildings, candidate] }).houses.values()]
      .some(h => h.market.kind === 'served'));
    const command = autoplayActionToGameAction(action, state);
    assert.ok(command);
    assert.notEqual(gameReducer(state, command), state);
  });
}

test('Stone-town growth preserves the default eight-lot cap but honors an eligible twenty-four-lot policy', () => {
  const state = fixture();
  assert.deepEqual(decideNextAction(state), { kind: 'none' });
  const action = decideNextAction(state, { maxHousingLots: 24 });
  assert.equal(action.kind === 'place_building' && action.building, 'house');
  const command = autoplayActionToGameAction(action, state);
  assert.ok(command);
  assert.notEqual(gameReducer(state, command), state);
  const belowCapacity = decideNextAction({ ...state, population: 175 }, { maxHousingLots: 24 });
  assert.notEqual(belowCapacity.kind === 'place_building' && belowCapacity.building, 'house');
});

test('Stone-town homes lacking water still receive a legal well before more housing', () => {
  const base = fixture();
  const state = retile({ ...base, buildings: base.buildings.filter(b => b.kind !== 'well') });
  const action = decideNextAction(state, { maxHousingLots: 24 });
  assert.equal(action.kind === 'place_building' && action.building, 'well');
});

test('Palisade services never request locked churches, duplicate understaffed markets or pending markets', () => {
  const base = fixture();
  const state = retile({ ...base, era: 'palisade', buildings: base.buildings.filter(b => b.kind !== 'church') });
  assert.deepEqual(urbanServiceAction(state), { kind: 'none' });
  assert.deepEqual(urbanServiceAction({ ...state, era: 'hamlet' }), { kind: 'none' });
  assert.deepEqual(urbanServiceAction({ ...state, buildings: state.buildings.map(b => b.kind === 'market' ? { ...b, workers: 0 } : b) }), { kind: 'none' });
  const missing = retile({ ...state, buildings: state.buildings.filter(b => b.kind !== 'market'),
    constructionSites: [createConstructionSite({ ordinal: 99, kind: 'market', tx: 10, ty: 12, startedTick: 0 })] });
  assert.deepEqual(urbanServiceAction(missing), { kind: 'none' });
});

test('Palisade service repair reconnects an existing nearby market instead of duplicating it', () => {
  const base = fixture();
  const state = retile({ ...base, era: 'palisade', buildings: base.buildings.filter(b => b.kind !== 'church')
    .map(b => b.kind === 'market' ? { ...b, tx: 10, ty: 14 } : b) });
  assert.equal(householdServices(state).houses.get('home-0')?.market.kind, 'unreachable');
  assert.equal(urbanServiceAction(state).kind, 'place_road');
});

test('Blocked civic plots return none rather than an invalid market', () => {
  const base = fixture();
  const state = { ...base, era: 'palisade' as const, buildings: base.buildings.filter(b => b.kind !== 'market'),
    tiles: base.tiles.map(tile => ({ ...tile, terrain: 'water' as const })) };
  assert.deepEqual(urbanServiceAction(state), { kind: 'none' });
});

test('An occupied best market plot falls back to another legal covering site', () => {
  const base = fixture();
  const state = retile({ ...base, era: 'palisade', buildings: base.buildings.filter(b => b.kind !== 'market') });
  const first = urbanServiceAction(state);
  assert.equal(first.kind, 'place_building');
  if (first.kind !== 'place_building') return;
  const blocked = retile({ ...state, buildings: [...state.buildings, building('occupied', 'granary', first.tx, first.ty)] });
  const next = urbanServiceAction(blocked);
  assert.equal(next.kind, 'place_building');
  if (next.kind !== 'place_building') return;
  assert.equal(next.building, 'market');
  assert.notDeepEqual([next.tx, next.ty], [first.tx, first.ty]);
  assert.deepEqual(canPlaceBuilding(blocked, next.building, next.tx, next.ty), { ok: true });
});

test('Post-era housing keeps labour, food and pending-construction guards', () => {
  const base = fixture();
  const cases = [
    { ...base, idleWorkers: 6 },
    { ...base, houses: base.houses.map(home => ({ ...home, breadStock: 0 })) },
    { ...base, constructionSites: [createConstructionSite({ ordinal: 99, kind: 'wheat_farm', tx: 23, ty: 5, startedTick: 0 })] },
  ];
  for (const state of cases) {
    const action = decideNextAction(state, { maxHousingLots: 24 });
    assert.notEqual(action.kind === 'place_building' && action.building, 'house');
  }
});
