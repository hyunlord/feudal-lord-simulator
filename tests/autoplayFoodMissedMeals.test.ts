import assert from 'node:assert/strict';
import test from 'node:test';
import { measuredFoodDecision } from '../src/engine/autoplayFoodMeasuredDecision';
import { replayFoodObservation } from './foodEfficiencyObservationFixture';
import { routedStockTown } from './helpers/autoplayFoodFixtures';

function stockedTown(fed: boolean) {
  const state = routedStockTown(true);
  return { ...state, houses: state.houses.map(h => ({ ...h, breadStock: fed ? 8 : 0 })),
    buildings: state.buildings.map(b => b.kind === 'granary' ? { ...b, inventory: { wheat: 100, bread: 60 } }
      : b.kind === 'mill' ? { ...b, inventory: { wheat: 8, bread: 18 } } : b.kind === 'wheat_farm' ? { ...b, inventory: {} } : b) };
}

test('missed actual meals and negative raw flow cannot be offset by unused global reserves', () => {
  const state = replayFoodObservation(stockedTown(false), { wheat: 120, bread: 70, exports: 0 });
  assert.deepEqual(measuredFoodDecision(state), { kind: 'wheat_farm', reason: 'actual_wheat_deficit' });
});

test('reserves retain their credit when they actually sustained every observed meal', () => {
  const state = replayFoodObservation(stockedTown(true), { wheat: 120, bread: 70, exports: 0 });
  assert.deepEqual(measuredFoodDecision(state), { kind: null, reason: 'food_supply_sufficient' });
});

test('missed meals with adequate actual raw output and starved mills diagnose transport rather than more fields', () => {
  const state = replayFoodObservation(stockedTown(false), { wheat: 1000, bread: 70, exports: 0 }, 1200);
  assert.deepEqual(measuredFoodDecision(state), { kind: null, reason: 'wheat_transport_blocked' });
});

test('output-blocked farms route a measured raw deficit to transport instead of another field', () => {
  const base = stockedTown(false);
  const state = replayFoodObservation({ ...base, buildings: base.buildings.map(b => b.kind === 'wheat_farm'
    ? { ...b, inventory: { wheat: 20 } } : b) }, { wheat: 120, bread: 70, exports: 0 });
  assert.deepEqual(measuredFoodDecision(state), { kind: null, reason: 'wheat_transport_blocked' });
});
