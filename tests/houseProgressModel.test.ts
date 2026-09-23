import assert from 'node:assert/strict';
import test from 'node:test';
import type { Building } from '../src/content/buildingConfig';
import type { GameState } from '../src/engine/engine.types';
import { DEFAULT_GAME_STATE } from '../src/state/gameStore';
import { firstBlocker, houseProgressModel, buildingCauseSnapshot } from '../src/ui/houseProgressModel';

function building(id: string, kind: Building['kind'], tx: number, ty: number): Building {
  return { id, kind, tx, ty, workers: 5, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
}
function fixture(level = 3): GameState {
  const polygon = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }, { x: 0, y: 20 }, { x: 0, y: 0 }];
  return { ...DEFAULT_GAME_STATE, width: 22, height: 22, tick: 0,
    tiles: Array.from({ length: 484 }, (_, i) => ({ tx: i % 22, ty: Math.floor(i / 22), terrain: 'grass', buildingId: null, hasRoad: Math.floor(i / 22) === 5 })),
    houses: [{ buildingId: 'home', level, residents: 14, hasWater: false, breadStock: 5, lastServicedTick: 0, unmetRequirementTicks: 0 }],
    buildings: [building('home', 'house', 4, 4), building('well', 'well', 2, 4), building('market', 'market', 6, 4), building('church', 'church', 8, 3)],
    palisade: { id: 'wall', polygon, gate: { x: 0, y: 5 }, segments: [{ id: 'wall-0', edgePath: polygon, order: 0, tileCount: 80, completed: true, constructionSiteId: null }] },
  };
}
function model(state: GameState) { return houseProgressModel(state, 'home'); }

test('ready reflects highest eligible noncumulative level without a granary', () => {
  const state = fixture(2);
  assert.equal(model(state)?.status, 'ready');
  assert.equal(model(state)?.nextLevel, 4);
  const home = state.houses[0]; assert.ok(home);
  assert.equal(firstBlocker(home, state), null);
});
test('maintained L4 has no upgrade blocker or icon', () => {
  const state = fixture(4);
  assert.equal(model(state)?.status, 'normal');
  assert.equal(model(state)?.nextLevel, null);
});
test('live water allocation overrides stale house flags and outranks bread', () => {
  const state = fixture(4);
  state.buildings = state.buildings.filter(b => b.kind !== 'well');
  state.houses = state.houses.map(h => ({ ...h, hasWater: true, breadStock: 0 }));
  assert.equal(model(state)?.status, 'risk');
  assert.equal(model(state)?.blocker?.causeId, 'water');
  const home = state.houses[0]; assert.ok(home);
  assert.equal(firstBlocker(home, state), null);
});
test('market staffing retains market priority behind unreachable church delivery', () => {
  const state = fixture();
  state.buildings = [...state.buildings.map(b => b.kind === 'market' ? { ...b, workers: 0 } : b), building('granary', 'granary', 12, 4)];
  state.tiles = state.tiles.map(t => ({ ...t, hasRoad: false }));
  assert.equal(model(state)?.blocker?.causeId, 'delivery');
  assert.equal(model(state)?.blocker?.requirement, 'church');
});
test('market staffing uses workers glyph once preceding requirements are satisfied', () => {
  const state = fixture();
  state.buildings = [...state.buildings.map(b => b.kind === 'market' ? { ...b, workers: 0 } : b), building('granary', 'granary', 12, 4)];
  assert.equal(model(state)?.blocker?.causeId, 'workers');
  assert.equal(model(state)?.blocker?.requirement, 'market');
});
test('bread precedes disconnected service and remains precise', () => {
  const state = fixture(4);
  state.houses = state.houses.map(h => ({ ...h, breadStock: 0 }));
  state.tiles = state.tiles.map(t => ({ ...t, hasRoad: false }));
  assert.equal(model(state)?.blocker?.causeId, 'bread');
});
test('same-tick immutable edits refresh snapshot while unchanged state reuses it', () => {
  const state = fixture(4);
  const first = buildingCauseSnapshot(state);
  assert.equal(buildingCauseSnapshot(state), first);
  const cut = { ...state, tiles: state.tiles.map(t => ({ ...t, hasRoad: false })) };
  assert.equal(buildingCauseSnapshot(cut).get('home')?.status, 'risk');
  assert.notEqual(buildingCauseSnapshot(cut), first);
});
test('presentation does not consume bread or mutate a meal-boundary snapshot', () => {
  const state = fixture(); state.tick = 2400;
  const before = JSON.stringify(state);
  model(state);
  assert.equal(JSON.stringify(state), before);
});
test('L2 granary proximity has delivery glyph without inventing road prerequisite', () => {
  const state = fixture(2); state.palisade = null;
  assert.equal(model(state)?.blocker?.requirement, 'granary');
  assert.equal(model(state)?.blocker?.causeId, 'delivery');
  state.buildings = [...state.buildings, building('granary', 'granary', 8, 8)];
  const updated = { ...state };
  assert.equal(model(updated)?.status, 'ready');
  assert.equal(model(updated)?.nextLevel, 3);
});
test('wall outside cap blocks pre-L3 but does not demote established L3', () => {
  const state = fixture(2);
  state.buildings = [...state.buildings, building('granary', 'granary', 12, 4)];
  assert.ok(state.palisade);
  state.palisade = { ...state.palisade, polygon: [{ x: 18, y: 18 }, { x: 20, y: 18 }, { x: 20, y: 20 }, { x: 18, y: 18 }] };
  assert.equal(model(state)?.blocker?.causeId, 'wall');
  const established = { ...state, houses: state.houses.map(h => ({ ...h, level: 3 })) };
  assert.equal(model(established)?.status, 'blocked');
  assert.equal(model(established)?.blocker?.causeId, 'wall');
});
for (const kind of ['market', 'church'] as const) {
  test(`${kind} missing uses its own cause before wall`, () => {
    const state = fixture(); state.palisade = null;
    state.buildings = [...state.buildings.filter(b => b.kind !== kind), building('granary', 'granary', 12, 4)];
    assert.equal(model(state)?.blocker?.causeId, kind);
    assert.equal(model(state)?.blocker?.reason, 'missing');
  });
}
test('water capacity detail shows actual allocated 12/12 lots', () => {
  const state = fixture(1);
  const homes = Array.from({ length: 13 }, (_, i) => building(`home-${String(i).padStart(2, '0')}`, 'house', 2 + i % 3, 2 + Math.floor(i / 3)));
  state.buildings = [...homes, building('well', 'well', 6, 4)];
  state.houses = homes.map(h => ({ buildingId: h.id, level: 1, residents: 0, breadStock: 5, hasWater: true, lastServicedTick: 0, unmetRequirementTicks: 0 }));
  const result = houseProgressModel(state, 'home-12');
  assert.equal(result?.blocker?.reason, 'capacity');
  assert.equal(result?.blocker?.used, 12);
  assert.equal(result?.blocker?.capacity, 12);
  assert.equal(result?.blocker?.providerId, 'well');
});
test('production problems stay visible to problem-only mode', () => {
  const state = fixture();
  state.buildings = [...state.buildings, building('mill', 'mill', 12, 4)];
  const result = buildingCauseSnapshot(state).get('mill');
  assert.equal(result?.status, 'blocked');
  assert.equal(result?.blocker?.reason, 'no_input');
  assert.match(result?.blocker?.label ?? '', /밀/);
});
test('capacity detail selects reachable staffed provider instead of nearer disconnected facility', () => {
  const state = fixture(4);
  const homes = Array.from({ length: 25 }, (_, i) => building(`h${String(i).padStart(2, '0')}`, 'house', 4, 4));
  state.buildings = [...homes, building('well1', 'well', 2, 4), building('well2', 'well', 2, 3), building('well3', 'well', 2, 2),
    building('full-market', 'market', 8, 4), building('disconnected-market', 'market', 4, 2), building('church', 'church', 12, 3)];
  state.houses = homes.map(h => ({ buildingId: h.id, level: 4, residents: 0, breadStock: 5, hasWater: true, lastServicedTick: 0, unmetRequirementTicks: 0 }));
  const result = houseProgressModel(state, 'h24');
  assert.equal(result?.blocker?.reason, 'capacity');
  assert.equal(result?.blocker?.providerId, 'full-market');
  assert.equal(result?.blocker?.used, 24);
  assert.equal(result?.blocker?.capacity, 24);
  assert.equal(result?.blocker?.distance, 4);
});
test('stored bread and supplied services do not add an unrelated road requirement', () => {
  const state = fixture(1);
  state.tiles = state.tiles.map(t => ({ ...t, hasRoad: false }));
  assert.equal(model(state)?.status, 'ready');
  assert.equal(model(state)?.nextLevel, 2);
  assert.equal(model(state)?.blocker, null);
});
test('facility understaffing remains a worker problem', () => {
  const state = fixture();
  state.buildings = [...state.buildings, { ...building('mill', 'mill', 12, 4), workers: 0 }];
  const result = buildingCauseSnapshot(state).get('mill');
  assert.equal(result?.blocker?.causeId, 'workers');
  assert.equal(result?.blocker?.reason, 'understaffed');
});
test('ordinary nonmill input waiting does not expand existing facility alarm eligibility', () => {
  const state = fixture();
  state.buildings = [...state.buildings, building('sawmill', 'sawmill', 12, 4)];
  assert.equal(buildingCauseSnapshot(state).get('sawmill')?.blocker, null);
});
test('full production storage before existing visual cycle threshold is not a new alarm', () => {
  const state = fixture();
  state.buildings = [...state.buildings, { ...building('farm', 'wheat_farm', 12, 3), inventory: { wheat: 1000 }, productionProgress: 0 }];
  assert.equal(buildingCauseSnapshot(state).get('farm')?.blocker, null);
});
