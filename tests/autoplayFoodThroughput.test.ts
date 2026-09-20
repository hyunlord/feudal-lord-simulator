import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_GAME_STATE } from '../src/state/gameStore';
import type { Building, BuildingKind } from '../src/content/buildingConfig';
import type { GameState } from '../src/engine/engine.types';
import { foodAction } from '../src/engine/autoplayFood';
import { createConstructionSite } from '../src/economy/construction';
import { foodRecoveryKind } from '../src/engine/autoplayFoodThroughput';
import { lateFoodBuildSites } from '../src/engine/autoplayFoodPlacement';

function building(id: string, kind: BuildingKind, tx: number, ty: number, workers: number): Building {
  return { id, kind, tx, ty, workers, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
}
function stressedTown(): GameState {
  const buildings = [building('granary', 'granary', 1, 1, 2),
    ...Array.from({ length: 5 }, (_, n) => building(`mill${n}`, 'mill', 8 + n * 8, 2, 2)),
    ...Array.from({ length: 10 }, (_, n) => building(`farm${n}`, 'wheat_farm', 4 + n * 5, 4, 4)),
    ...Array.from({ length: 16 }, (_, n) => building(`home${n}`, 'house', 10 + n * 2, 0, 0))];
  return { ...structuredClone(DEFAULT_GAME_STATE), tick: 6000, width: 64, height: 8, era: 'palisade', palisade: null,
    buildings, constructionSites: [], walkers: [], population: 256, idleWorkers: 50,
    houses: buildings.filter(b => b.kind === 'house').map((b, n) => ({ buildingId: b.id, level: 3, builtLevel: 3,
      residents: 16, hasWater: true, breadStock: n === 15 ? 0 : 2, lastServicedTick: 0,
      emptyFoodTicks: n === 15 ? 401 : 0, unmetRequirementTicks: 0 })),
    tiles: Array.from({ length: 512 }, (_, n) => ({ tx: n % 64, ty: Math.floor(n / 64), terrain: 'grass',
      hasRoad: Math.floor(n / 64) === 3, buildingId: null })), pathCache: {},
  };
}
const request = (_state: GameState, kind: BuildingKind) => ({ kind: 'place_building', building: kind, tx: 0, ty: 0 } as const);

test('Given hungry homes and long food routes When nominal mill count is sufficient Then advisor expands actual supply', () => {
  const state = stressedTown();
  const action = foodAction(state, request);
  assert.equal(action.kind, 'place_building');
  assert.ok(action.kind === 'place_building' && ['wheat_farm', 'mill'].includes(action.building));
});
test('Given healthy homes with nominal food support When advisor checks food Then no recovery construction is requested', () => {
  const state = stressedTown();
  state.houses = state.houses.map(house => ({ ...house, breadStock: 6, emptyFoodTicks: 0 }));
  assert.deepEqual(foodAction(state, request), { kind: 'none' });
});
test('Given a palisade town When choosing food placement Then actual road haul lengths rank sites before stone era', () => {
  assert.notEqual(lateFoodBuildSites(stressedTown(), 'mill'), null);
});

for (const failure of ['unreachable', 'understaffed'] as const) test(`Given ${failure} food facilities When homes lack bread Then recovery does not duplicate broken capacity`, () => {
  const state = stressedTown();
  if (failure === 'unreachable') state.tiles = state.tiles.map(tile => ({ ...tile, hasRoad: false }));
  else state.buildings = state.buildings.map(b => b.kind === 'mill' ? { ...b, workers: 0 } : b);
  assert.equal(foodRecoveryKind(state, 48), null);
});
test('Given a pending food project When homes lack bread Then advisor waits for committed capacity', () => {
  const state = stressedTown();
  state.constructionSites = [createConstructionSite({ ordinal: 1, kind: 'mill', tx: 55, ty: 2, startedTick: state.tick })];
  assert.deepEqual(foodAction(state, request), { kind: 'none' });
});
test('Given temporary empty food or only missing civic services When advisor checks recovery Then existing starvation grace prevents construction spam', () => {
  const state = stressedTown();
  state.houses = state.houses.map(h => ({ ...h, emptyFoodTicks: 100, unmetRequirementTicks: 1000 }));
  assert.equal(foodRecoveryKind(state, 48), null);
});
test('Given enough road-adjusted supply When a home has a temporary deficit Then recovery remains bounded by meal demand', () => {
  assert.equal(foodRecoveryKind(stressedTown(), 1), null);
});
