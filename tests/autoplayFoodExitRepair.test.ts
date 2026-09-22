import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_GAME_STATE } from '../src/state/gameStore';
import { building } from './helpers/autoplayFoodFixtures';
import type { GameState } from '../src/engine/engine.types';
import { eligibleRoamingExits, feasibleDistributorDistance } from '../src/engine/distributorAccess';
import { foodRouteRepairAction } from '../src/engine/autoplayFoodRoutes';
import { placeRoadLine } from '../src/engine/gameActions';

test('food repairs the distributor exit component rather than an unused connected building entrance', () => {
  const granary = { ...building('granary', 'granary', 4, 2, 2), inventory: { bread: 40 } };
  const house = building('house', 'house', 6, 5, 0);
  let state: GameState = { ...structuredClone(DEFAULT_GAME_STATE), width: 12, height: 8,
    buildings: [granary, house], constructionSites: [], walkers: [], palisade: null, treasuryTimber: 1000,
    population: 32, idleWorkers: 10, pathCache: {},
    houses: [{ buildingId: house.id, level: 4, builtLevel: 4, residents: 32, hasWater: true,
      breadStock: 0, lastServicedTick: 0, emptyFoodTicks: 500, unmetRequirementTicks: 0 }],
    tiles: Array.from({ length: 96 }, (_, index) => { const tx = index % 12, ty = Math.floor(index / 12);
      return { tx, ty, terrain: 'grass', hasRoad: ty === 1 || ty === 4 && tx < 8,
        buildingId: tx >= 4 && tx < 6 && ty >= 2 && ty < 4 ? granary.id : tx === 6 && ty === 5 ? house.id : null }; }),
  };
  assert.ok(eligibleRoamingExits(state, granary).every(tile => tile.ty === 1));
  assert.equal(feasibleDistributorDistance(state, granary, house.id), null);
  const initialTimber = state.treasuryTimber;
  for (let attempts = 0; attempts < 4 && feasibleDistributorDistance(state, granary, house.id) === null; attempts += 1) {
    const action = foodRouteRepairAction(state);
    assert.equal(action.kind, 'place_road');
    if (action.kind !== 'place_road') return;
    state = placeRoadLine(state, action.from, action.to);
  }
  assert.notEqual(feasibleDistributorDistance(state, granary, house.id), null);
  assert.equal(state.treasuryTimber, initialTimber);
  assert.deepEqual(state.buildings, [granary, house]);
});
