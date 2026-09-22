import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_GAME_STATE } from '../src/state/gameStore';
import type { GameState } from '../src/engine/engine.types';
import { building, foodBuildRequest } from './helpers/autoplayFoodFixtures';
import { replayFoodObservation } from './foodEfficiencyObservationFixture';
import { foodAction } from '../src/engine/autoplayFood';
import { resolveBuildingRoute } from '../src/engine/routing';
import { foodTransportGranaryAction } from '../src/engine/autoplayFoodTransport';
import { placeRoadLine } from '../src/engine/gameActions';
import { createConstructionSite } from '../src/economy/construction';

function transportTown(): GameState {
  const buildings = [
    { ...building('store', 'granary', 1, 1, 2), inventory: { wheat: 94 } },
    { ...building('materials', 'storehouse', 4, 1, 2), inventory: { stone: 1000, timber: 1000 } },
    building('mill', 'mill', 22, 4, 2), building('farm', 'wheat_farm', 25, 4, 4),
    ...[20, 22, 24].map((tx, i) => building('home' + i, 'house', tx, 2, 0)),
  ];
  const state: GameState = { ...structuredClone(DEFAULT_GAME_STATE), tick: 6000, width: 32, height: 12,
    era: 'stone_town', palisade: null, buildings, population: 96, idleWorkers: 30, treasuryTimber: 1000,
    constructionSites: [], walkers: [], pathCache: {}, houses: buildings.filter(b => b.kind === 'house').map(b => ({
      buildingId: b.id, level: 4, builtLevel: 4, residents: 32, hasWater: true, breadStock: 0,
      lastServicedTick: 0, emptyFoodTicks: 600, unmetRequirementTicks: 0 })),
    tiles: Array.from({ length: 384 }, (_, n) => { const tx = n % 32, ty = Math.floor(n / 32);
      return { tx, ty, terrain: 'grass', hasRoad: ty === 3, buildingId: buildings.find(b => tx >= b.tx && tx < b.tx + (b.kind === 'house' ? 1 : 2)
        && ty >= b.ty && ty < b.ty + (b.kind === 'house' ? 1 : 2))?.id ?? null }; }),
  };
  return replayFoodObservation(state, { wheat: 1000, bread: 10, exports: 0 }, 1200);
}

test('measured raw hauling loss places a capped local grain store before another mill', () => {
  let state = transportTown();
  let action = foodAction(state, foodBuildRequest);
  for (let step = 0; step < 8 && action.kind === 'place_road'; step += 1) {
    state = placeRoadLine(state, action.from, action.to);
    action = foodAction(state, foodBuildRequest);
  }
  assert.ok(action.kind === 'place_building' && action.building === 'granary', JSON.stringify(action));
  const mill = state.buildings.find(b => b.kind === 'mill');
  const store = state.buildings.find(b => b.kind === 'granary');
  assert.ok(mill && store);
  const farm = state.buildings.find(b => b.kind === 'wheat_farm');
  assert.ok(farm);
  const candidate = building('candidate', 'granary', action.tx, action.ty, 2);
  const before = resolveBuildingRoute(state, mill, store).path;
  const after = resolveBuildingRoute(state, mill, candidate).path;
  assert.ok(before && after && after.length < before.length);
  const farmBefore = resolveBuildingRoute(state, farm, store).path;
  const farmAfter = resolveBuildingRoute(state, farm, candidate).path;
  assert.ok(farmBefore && farmAfter && farmAfter.length < farmBefore.length);
  assert.deepEqual(candidate.inventory, {});
});

for (const reason of ['staff', 'pending-observation', 'ineffective-store', 'cap', 'no-grain', 'unmeasured'] as const) {
  test(`transport storage does not expand for ${reason}`, () => {
    let state = transportTown();
    if (reason === 'staff') state = { ...state, idleWorkers: 0 };
    if (reason === 'pending-observation') state = { ...state, autoplayFoodObservation: {
      kind: 'granary', siteId: 'prior', placedTick: 5000, completedTick: 5500, observeUntilTick: 7900 } };
    if (reason === 'ineffective-store') state = { ...state, autoplayFoodObservation: {
      kind: 'granary', siteId: 'prior', placedTick: 2000, completedTick: 2100, observeUntilTick: 4500,
      outcome: { outputDelta: 0, deliveredBreadDelta: 0, starvingHomesDelta: 0, effective: false } } };
    if (reason === 'cap') state = { ...state, constructionSites: [createConstructionSite({ ordinal: 1, kind: 'granary', tx: 10, ty: 4, startedTick: 0 })] };
    if (reason === 'no-grain') state = { ...state, buildings: state.buildings.map(b => ({ ...b, inventory: {} })) };
    if (reason === 'unmeasured') { const { autoplayFoodFlow: ignored, ...rest } = state; void ignored; state = rest; }
    assert.deepEqual(foodTransportGranaryAction(state), { kind: 'none' });
  });
}
