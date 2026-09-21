import assert from 'node:assert/strict';
import test from 'node:test';
import { createConstructionSite } from '../src/economy/construction';
import { foodAction } from '../src/engine/autoplayFood';
import { foodRecoveryKind } from '../src/engine/autoplayFoodThroughput';
import { lateFoodBuildSites } from '../src/engine/autoplayFoodPlacement';
import { foodBuildRequest, routedStockTown, stressedTown, withMeasuredFood } from './helpers/autoplayFoodFixtures';

test('Given hungry homes and long food routes When nominal mill count is sufficient Then advisor expands actual supply', () => {
  const state = withMeasuredFood(stressedTown());
  const action = foodAction(state, foodBuildRequest);
  assert.equal(action.kind, 'place_building');
  assert.ok(action.kind === 'place_building' && ['wheat_farm', 'mill'].includes(action.building));
});

test('Given healthy homes with nominal food support When advisor checks food Then no recovery construction is requested', () => {
  const state = stressedTown();
  state.houses = state.houses.map(house => ({ ...house, breadStock: 6, emptyFoodTicks: 0 }));
  assert.deepEqual(foodAction(state, foodBuildRequest), { kind: 'none' });
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
  assert.deepEqual(foodAction(state, foodBuildRequest), { kind: 'none' });
});

test('Given temporary empty food or only missing civic services When advisor checks recovery Then existing starvation grace prevents construction spam', () => {
  const state = stressedTown();
  state.houses = state.houses.map(h => ({ ...h, emptyFoodTicks: 100, unmetRequirementTicks: 1000 }));
  assert.equal(foodRecoveryKind(state, 48), null);
});

test('Given enough road-adjusted supply When a home has a temporary deficit Then recovery remains bounded by meal demand', () => {
  assert.equal(foodRecoveryKind(stressedTown(), 1), null);
});

test(
  'Given only unreachable granary bread When a house is hungry Then recovery does not treat global stock as supply',
  () => {
    const state = routedStockTown(false);
    state.buildings = state.buildings.map(building =>
      building.kind === 'granary' ? { ...building, inventory: { bread: 96 } } : building);
    assert.notEqual(foodRecoveryKind(withMeasuredFood(state), 24), null);
  },
);
