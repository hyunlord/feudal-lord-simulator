import { observedFoodTown, replayFoodObservation } from './foodEfficiencyObservationFixture';
import { measuredFoodDecision } from '../src/engine/autoplayFoodMeasuredDecision';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createConstructionSite } from '../src/economy/construction';
import { foodAction } from '../src/engine/autoplayFood';
import { foodRecoveryKind } from '../src/engine/autoplayFoodThroughput';
import { lateFoodBuildSites } from '../src/engine/autoplayFoodPlacement';
import { building, foodBuildRequest, routedStockTown, stressedTown } from './helpers/autoplayFoodFixtures';

test('Given hungry homes and long food routes When nominal mill count is sufficient Then advisor expands actual supply', () => {
  const state = observedFoodTown(20, 10);
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
  const state = observedFoodTown();
  if (failure === 'unreachable') state.tiles = state.tiles.map(tile => ({ ...tile, hasRoad: false }));
  else state.buildings = state.buildings.map(b => b.kind === 'mill' ? { ...b, workers: 0 } : b);
  assert.equal(foodRecoveryKind(state, 48), null);
  assert.equal(measuredFoodDecision(state).reason, failure === 'unreachable' ? 'food_route_blocked' : 'food_staff_shortage');
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
  'Given only unreachable granary bread When a house is hungry Then incomplete route evidence cannot authorize another facility',
  () => {
    const state = routedStockTown(false);
    state.buildings = state.buildings.map(building =>
      building.kind === 'granary' ? { ...building, inventory: { bread: 96 } } : building);
    const observed = replayFoodObservation(state, { wheat: 20, bread: 10, exports: 0 });
    assert.equal(foodRecoveryKind(observed, 24), null);
    assert.equal(measuredFoodDecision(observed).reason, 'food_route_blocked');
  },
);


test('Given two disjoint food districts with local suppliers When both have measured adequate food Then no cross-district road is required', () => {
  const base = stressedTown();
  const buildings = [
    ...[1, 35].flatMap((offset, index) => [
      { ...building('granary-' + index, 'granary', offset, 2, 2), inventory: { bread: 40, wheat: 40 } },
      { ...building('mill-' + index, 'mill', offset + 4, 2, 2), inventory: { wheat: 2 } },
      building('farm-' + index, 'wheat_farm', offset + 7, 2, 4),
      building('home-' + index, 'house', offset + 3, 0, 0),
    ]),
  ];
  const state = { ...base, buildings,
    houses: base.houses.slice(0, 2).map((house, index) => ({ ...house,
      buildingId: 'home-' + index, breadStock: 8, emptyFoodTicks: 0 })),
    tiles: base.tiles.map(tile => ({ ...tile, hasRoad: tile.ty === 1 && (tile.tx < 15 || tile.tx > 30) })),
    roadRevision: base.roadRevision + 1, pathCache: {} };
  const observed = replayFoodObservation(state, { wheat: 240, bread: 100, exports: 0 });
  assert.deepEqual(measuredFoodDecision(observed), { kind: null, reason: 'food_supply_sufficient' });
  assert.deepEqual(foodAction(observed, foodBuildRequest), { kind: 'none' });
});

test('Given a hamlet food chain When choosing its first mill Then real granary routes rank placement from the start', () => {
  const state = { ...stressedTown(), era: 'hamlet' as const };
  const sites = lateFoodBuildSites(state, 'mill');
  assert.ok(sites !== null && sites.length > 0);
});

test('Given grain currently in every mill When recent eligible time was raw-starved Then the advisor diagnoses transport before more milling', () => {
  const state = replayFoodObservation(observedFoodTown(), { wheat: 1000, bread: 40, exports: 0 }, 2400);
  assert.ok(state.buildings.filter(b => b.kind === 'mill').every(b => (b.inventory.wheat ?? 0) > 0));
  assert.deepEqual(measuredFoodDecision(state), { kind: null, reason: 'wheat_transport_blocked' });
});
