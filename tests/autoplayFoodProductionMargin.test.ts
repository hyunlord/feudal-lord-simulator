import assert from 'node:assert/strict';
import test from 'node:test';
import { BALANCE } from '../src/content/balanceConfig';
import { foodEfficiencyMetrics, FOOD_EFFICIENCY_WINDOW, recordFoodEfficiency, type FoodEfficiencyTotals } from '../src/engine/autoplayFoodEfficiency';
import { advanceFoodFlow } from '../src/engine/autoplayFoodFlow';
import { measuredFoodDecision } from '../src/engine/autoplayFoodMeasuredDecision';
import type { GameState } from '../src/engine/engine.types';
import { routedStockTown } from './helpers/autoplayFoodFixtures';

const REQUIRED_MARGIN_FACTOR = BALANCE.FOOD_PRODUCTION_MARGIN_FACTOR;

function observeFoodMargin(totals: FoodEfficiencyTotals): GameState {
  const base = routedStockTown(true);
  let state: GameState = {
    ...base,
    houses: base.houses.map(house => ({ ...house, breadStock: 8, emptyFoodTicks: 0 })),
    buildings: base.buildings.map(building => building.kind === 'granary'
      ? { ...building, inventory: { bread: 80, wheat: 80 } }
      : building.kind === 'mill'
        ? { ...building, inventory: { wheat: 8 } }
        : building.kind === 'wheat_farm'
          ? { ...building, inventory: {} }
        : building),
  };
  state = { ...state, tick: state.tick - FOOD_EFFICIENCY_WINDOW };
  const units = (total: number, index: number): number => Math.floor(total * index / FOOD_EFFICIENCY_WINDOW)
    - Math.floor(total * (index - 1) / FOOD_EFFICIENCY_WINDOW);
  for (let index = 1; index <= FOOD_EFFICIENCY_WINDOW; index += 1) {
    state = advanceFoodFlow(state);
    state = { ...state, tick: state.tick + 1 };
    state = recordFoodEfficiency(state, {
      wheatProduced: units(totals.wheatProduced, index),
      wheatConsumed: units(totals.wheatConsumed, index),
      breadProduced: units(totals.breadProduced, index),
      wheatExported: units(totals.wheatExported, index),
      breadExported: units(totals.breadExported, index),
      requestedBread: units(totals.requestedBread, index),
      consumedBread: units(totals.consumedBread, index),
      rawStarvedTicks: units(totals.rawStarvedTicks, index),
      eligibleMillTicks: units(totals.eligibleMillTicks, index),
    }, true);
  }
  return state;
}

test('E1 Given seed2-like blade-edge wheat output When measured Then the food advisor requests another farm', () => {
  assert.equal(REQUIRED_MARGIN_FACTOR, 1.05);
  const state = observeFoodMargin({
    wheatProduced: 1167,
    wheatConsumed: 1172,
    breadProduced: 586,
    requestedBread: 576,
    consumedBread: 576,
    wheatExported: 0,
    breadExported: 0,
    rawStarvedTicks: 444,
    eligibleMillTicks: FOOD_EFFICIENCY_WINDOW,
  });
  const metrics = foodEfficiencyMetrics(state);
  assert.equal(metrics.wheatProduced < metrics.wheatConsumed * REQUIRED_MARGIN_FACTOR, true);
  assert.equal(metrics.breadProduced >= metrics.requestedBread, true);
  assert.deepEqual(measuredFoodDecision(state), { kind: 'wheat_farm', reason: 'actual_wheat_deficit' });
});

test('E1 margin acts before a missed meal or an observed raw-starved tick', () => {
  const state = observeFoodMargin({
    wheatProduced: 1200,
    wheatConsumed: 1200,
    breadProduced: 630,
    requestedBread: 600,
    consumedBread: 600,
    wheatExported: 0,
    breadExported: 0,
    rawStarvedTicks: 0,
    eligibleMillTicks: FOOD_EFFICIENCY_WINDOW,
  });
  assert.deepEqual(measuredFoodDecision(state), { kind: 'wheat_farm', reason: 'actual_wheat_deficit' });
});

test('E2 Given twenty percent production margin When measured Then the food advisor does not expand', () => {
  const state = observeFoodMargin({
    wheatProduced: 1440,
    wheatConsumed: 1200,
    breadProduced: 720,
    requestedBread: 600,
    consumedBread: 600,
    wheatExported: 0,
    breadExported: 0,
    rawStarvedTicks: 0,
    eligibleMillTicks: FOOD_EFFICIENCY_WINDOW,
  });
  const metrics = foodEfficiencyMetrics(state);
  assert.equal(metrics.wheatProduced >= metrics.wheatConsumed * REQUIRED_MARGIN_FACTOR, true);
  assert.equal(metrics.breadProduced >= metrics.requestedBread * REQUIRED_MARGIN_FACTOR, true);
  assert.deepEqual(measuredFoodDecision(state), { kind: null, reason: 'food_supply_sufficient' });
});

test('a wheat margin warning chooses mill capacity when stocked mills are the immediate bread bottleneck', () => {
  const state = observeFoodMargin({
    wheatProduced: 726,
    wheatConsumed: 722,
    breadProduced: 361,
    requestedBread: 375,
    consumedBread: 362,
    wheatExported: 5,
    breadExported: 0,
    rawStarvedTicks: 1300,
    eligibleMillTicks: 12000,
  });
  assert.deepEqual(measuredFoodDecision(state), { kind: 'mill', reason: 'actual_bread_deficit' });
});
