import assert from 'node:assert/strict';
import test from 'node:test';
import { refreshFoodObservation } from '../src/engine/autoplayFoodThroughput';
import { observedFoodTown } from './foodEfficiencyObservationFixture';

for (const condition of ['local-output-only', 'delivered-no-improvement', 'delivered-improvement', 'missing-proof'] as const) {
  test(`farm repeat authority requires usable grain delivery and downstream outcome: ${condition}`, () => {
    const state = observedFoodTown(200, 80);
    const next = refreshFoodObservation({ ...state, autoplayFoodObservation: {
      kind: 'wheat_farm', siteId: 'farm0', placedTick: state.tick - 3000, completedTick: state.tick - 2400,
      observeUntilTick: state.tick, requiresDeliveredOutcome: true,
      baseline: { outputTotal: 0, houseBread: 0, starvingHomes: 1,
        ...(condition === 'missing-proof' ? {} : { breadProduced: condition === 'delivered-improvement' ? 60 : 80, missedMeals: 0 }) },
      latest: { outputTotal: 20, houseBread: 0, starvingHomes: 1, deliveredWheat: condition === 'local-output-only' ? 0 : 8 },
    } });
    assert.equal(next.autoplayFoodObservation?.outcome?.effective, condition === 'delivered-improvement');
  });
}

for (const homeOffset of [12, 50]) {
  test(`real farm deposit credits only a granary within household range at offset ${homeOffset}`, async () => {
    const { routedStockTown } = await import('./helpers/autoplayFoodFixtures');
    const { advanceSimulationSubstep } = await import('../src/engine/tick');
    const base = routedStockTown(true);
    const state = { ...base, width: 64,
      buildings: base.buildings.map(b => b.kind === 'house' ? { ...b, tx: homeOffset + Number(b.id.slice(4)) }
        : b.kind === 'wheat_farm' ? { ...b, inventory: { wheat: 8 } } : b),
      tiles: Array.from({ length: 320 }, (_, n) => ({ tx: n % 64, ty: Math.floor(n / 64),
        terrain: 'grass' as const, hasRoad: Math.floor(n / 64) === 1, buildingId: null })),
      autoplayFoodObservation: { kind: 'wheat_farm' as const, siteId: 'farm', placedTick: base.tick,
        completedTick: base.tick, observeUntilTick: base.tick + 2400, requiresDeliveredOutcome: true,
        baseline: { outputTotal: 0, houseBread: 0, starvingHomes: 0, breadProduced: 0, missedMeals: 10 },
        latest: { outputTotal: 0, houseBread: 0, starvingHomes: 0 } },
    };
    if (homeOffset === 50) {
      const { replayFoodObservation } = await import('./foodEfficiencyObservationFixture');
      const { measuredFoodDecision } = await import('../src/engine/autoplayFoodMeasuredDecision');
      const stocked = replayFoodObservation({ ...state, buildings: state.buildings.map(b => b.kind === 'granary'
        ? { ...b, inventory: { bread: 100, wheat: 100 } } : b) }, { wheat: 1000, bread: 1000, exports: 0 });
      assert.equal(measuredFoodDecision(stocked).reason, 'food_route_blocked');
    }
    // A normal engine loop, including actual outbound arrival and granary deposit.
    let result: import('../src/engine/engine.types').GameState = state;
    for (let tick = 0; tick < 160; tick += 1) result = advanceSimulationSubstep(result);
    assert.ok((result.autoplayFoodObservation?.latest?.deliveredWheat ?? 0) > 0 === (homeOffset === 12));
    assert.ok(result.buildings.some(b => b.kind === 'granary' && (b.inventory.wheat ?? 0) > 0)
      || result.buildings.some(b => b.kind === 'mill' && (b.inventory.wheat ?? 0) > 0));
  });
}

test('expired legacy farm success cannot authorize repeat without delivery proof', async () => {
  const { blocksRepeatedFoodExpansion } = await import('../src/engine/autoplayFoodThroughput');
  const state = observedFoodTown();
  const observation = { kind: 'wheat_farm' as const, siteId: 'farm0', placedTick: 0, completedTick: 1, observeUntilTick: 2401,
    outcome: { outputDelta: 20, deliveredBreadDelta: 0, starvingHomesDelta: 0, effective: true } };
  assert.equal(blocksRepeatedFoodExpansion({ ...state, autoplayFoodObservation: observation }, 'wheat_farm'), true);
  assert.equal(blocksRepeatedFoodExpansion({ ...state, autoplayFoodObservation: { ...observation, requiresDeliveredOutcome: false } }, 'wheat_farm'), false);
});
