import assert from 'node:assert/strict';
import test from 'node:test';
import { blocksRepeatedFoodExpansion } from '../src/engine/autoplayFoodThroughput';
import { measuredFoodDecision } from '../src/engine/autoplayFoodMeasuredDecision';
import { replayFoodObservation } from './foodEfficiencyObservationFixture';
import { routedStockTown } from './helpers/autoplayFoodFixtures';

function lateFarmOutcome() {
  const base = routedStockTown(true);
  const state = replayFoodObservation({ ...base,
    houses: base.houses.map(h => ({ ...h, breadStock: 0 })),
    buildings: base.buildings.map(b => b.kind === 'wheat_farm' ? { ...b, inventory: {} }
      : b.kind === 'mill' ? { ...b, inventory: { wheat: 8 } } : b),
  }, { wheat: 120, bread: 70, exports: 0 });
  return { ...state, autoplayFoodObservation: {
    kind: 'wheat_farm' as const, siteId: 'farm', placedTick: 0, completedTick: 1, observeUntilTick: 2401,
    requiresDeliveredOutcome: true,
    baseline: { outputTotal: 0, houseBread: 0, starvingHomes: 0, breadProduced: 60, missedMeals: 0 },
    latest: { outputTotal: 60, houseBread: 0, starvingHomes: 0, deliveredWheat: 59 },
    outcome: { outputDelta: 60, deliveredBreadDelta: 0, starvingHomesDelta: 0, deliveredWheatDelta: 59, effective: false },
  } };
}

test('late measured bread improvement releases a delivered farm failure without rewriting its history', () => {
  const state = lateFarmOutcome();
  const before = structuredClone(state.autoplayFoodObservation);
  assert.equal(measuredFoodDecision(state).reason, 'actual_wheat_deficit');
  assert.equal(blocksRepeatedFoodExpansion(state, 'wheat_farm'), false);
  assert.deepEqual(state.autoplayFoodObservation, before);
});

for (const condition of ['no-improvement', 'zero-deposit', 'legacy', 'unknown-window', 'stale-window', 'no-current-deficit'] as const) {
  test(`late farm release stays closed for ${condition}`, () => {
    const base = lateFarmOutcome();
    const observation = base.autoplayFoodObservation;
    const { autoplayFoodFlow: omittedFlow, ...withoutFlow } = base;
    const { requiresDeliveredOutcome: omittedProof, ...withoutProof } = observation;
    const state = {
      ...(condition === 'unknown-window' ? withoutFlow : base),
      tick: condition === 'stale-window' ? base.tick + 1 : base.tick,
      ...(condition === 'no-current-deficit' ? { buildings: base.buildings.map(b => b.kind === 'wheat_farm' ? { ...b, inventory: { wheat: 20 } } : b) } : {}),
      autoplayFoodObservation: { ...(condition === 'legacy' ? withoutProof : observation),
        baseline: { ...observation.baseline, breadProduced: condition === 'no-improvement' ? 70 : 60 },
        outcome: { ...observation.outcome, deliveredWheatDelta: condition === 'zero-deposit' ? 0 : 59 },
      },
    };
    assert.equal(blocksRepeatedFoodExpansion(state, 'wheat_farm'), true);
  });
}
