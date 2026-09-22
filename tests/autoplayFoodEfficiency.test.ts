import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceFoodFlow, recordFoodFlow } from '../src/engine/autoplayFoodFlow';
import { foodAction } from '../src/engine/autoplayFood';
import { DEFAULT_GAME_STATE } from '../src/state/gameStore';
import { foodBuildRequest, routedStockTown } from './helpers/autoplayFoodFixtures';
import { foodEfficiencyMetrics, recordFoodEfficiency } from '../src/engine/autoplayFoodEfficiency';

test('missing observations do not authorize expansion of a complete food chain', () => {
  // Given a complete supplied chain without a measured window.
  const state = routedStockTown(true);
  // When the advisor evaluates expansion.
  const action = foodAction(state, foodBuildRequest);
  // Then no speculative additional mill is requested.
  assert.equal(action.kind, 'none');
});

test('rolling food evidence retains exactly the latest 2400 production ticks', () => {
  // Given an empty observation history.
  let state = { ...structuredClone(DEFAULT_GAME_STATE), tick: 0 };
  // When actual events are recorded over 2500 consecutive ticks.
  for (let tick = 1; tick <= 2500; tick += 1) {
    state = advanceFoodFlow(state);
    state = recordFoodEfficiency(recordFoodFlow({ ...state, tick }, { breadProduced: tick <= 100 ? 2 : 1 }), {}, true);
  }
  // Then expired output is excluded and the original window is complete.
  const metrics = foodEfficiencyMetrics(state);
  assert.equal(metrics.breadProduced, 2400);
  assert.equal(metrics.coveredTicks, 2400);
  assert.equal(metrics.fullWindow, true);
  assert.equal(metrics.eligibleMillTicks, 0);
});

test('real simulation records production starvation and meals across a full observed window', async () => {
  // Given a prepared road-connected town using normal stocks, workforce and production rules.
  const { advanceSimulationSubstep } = await import('../src/engine/tick');
  let state = routedStockTown(true);
  state = { ...state, buildings: state.buildings.map(b => b.kind === 'granary'
    ? { ...b, inventory: { bread: 100, wheat: 100 } } : b),
    houses: state.houses.map(h => ({ ...h, breadStock: 12, emptyFoodTicks: 0 })) };
  // When the actual engine advances without an advisor or injected observation history.
  for (let step = 0; step < 2400; step += 1) state = advanceSimulationSubstep(state);
  // Then measured counters describe real events and strict eligible mill time.
  const metrics = foodEfficiencyMetrics(state);
  assert.equal(metrics.fullWindow, true);
  assert.equal(metrics.coveredTicks, 2400);
  assert.ok(metrics.breadProduced > 0);
  assert.equal(metrics.wheatConsumed, metrics.breadProduced * 2);
  assert.ok(metrics.requestedBread > 0);
  assert.ok(metrics.consumedBread <= metrics.requestedBread);
  assert.ok(metrics.rawStarvedTicks > 0);
  assert.ok(metrics.rawStarvedTicks <= metrics.eligibleMillTicks);
  assert.equal(metrics.eligibleMillTicks, 2400);
});

test('a missing production tick cannot be credited as a full observation window', () => {
  // Given a history opened before an unsupported jump in the simulation clock.
  const opened = advanceFoodFlow({ ...structuredClone(DEFAULT_GAME_STATE), tick: 0 });
  // When an isolated production call arrives 2400 ticks later.
  const jumped = recordFoodEfficiency({ ...opened, tick: 2400 }, { eligibleMillTicks: 1 }, true);
  // Then the intervening ticks are unknown, not elapsed observation credit.
  assert.equal(foodEfficiencyMetrics(jumped).fullWindow, false);
});

test('queued granary counts against the housing-based cap', async () => {
  // Given eight homes and two existing grain stores plus a third under construction.
  const { createConstructionSite } = await import('../src/economy/construction');
  const { foodFacilityWithinLimit } = await import('../src/engine/autoplayFoodLimits');
  const base = routedStockTown(true);
  const granary = base.buildings.find(b => b.kind === 'granary');
  assert.ok(granary);
  const state = { ...base, buildings: [...base.buildings, { ...granary, id: 'second' }],
    constructionSites: [createConstructionSite({ ordinal: 1, kind: 'granary', tx: 15, ty: 2, startedTick: base.tick })] };
  // When another automatic grain store is considered.
  // Then unfinished capacity is included in the three-store limit.
  assert.equal(foodFacilityWithinLimit(state, 'granary'), false);
});

test('an empty existing mill prevents another mill even below the farm-count cap', async () => {
  // Given a complete chain, an additional farm and a mill awaiting grain.
  const { foodFacilityWithinLimit } = await import('../src/engine/autoplayFoodLimits');
  const base = routedStockTown(true);
  const farm = base.buildings.find(b => b.kind === 'wheat_farm');
  assert.ok(farm);
  const state = { ...base, buildings: [...base.buildings, { ...farm, id: 'second-farm' }] };
  // When additional milling capacity is requested.
  // Then the raw-input bottleneck cannot be treated as absent processing capacity.
  assert.equal(foodFacilityWithinLimit(state, 'mill'), false);
});

test('fully staffed disconnected mills are excluded from eligible production time', async () => {
  // Given a mill with assigned workers but no actual traversable entrance.
  const { runProduction } = await import('../src/engine/simulationProduction');
  const base = routedStockTown(true);
  const state = advanceFoodFlow({ ...base, tiles: base.tiles.map(tile => ({ ...tile, hasRoad: false })) });
  // When the production phase runs once.
  const next = runProduction({ ...state, tick: state.tick + 1 });
  // Then no usable mill time or input starvation is invented.
  assert.equal(foodEfficiencyMetrics(next).eligibleMillTicks, 0);
  assert.equal(foodEfficiencyMetrics(next).rawStarvedTicks, 0);
});

test('pre-wall food roads reconnect occupied homes to an existing stocked granary', async () => {
  // Given legal existing road components on opposite sides of a buildable gap.
  const state = { ...routedStockTown(false), treasuryTimber: 100 };
  // When the food advisor runs even before its production observation is complete.
  const action = foodAction(state, foodBuildRequest);
  // Then it repairs an actual route rather than adding an unreachable producer.
  assert.equal(action.kind, 'place_road');
  const { autoplayActionToGameAction } = await import('../src/engine/autoplayActions');
  const { gameReducer } = await import('../src/state/gameStore');
  const command = autoplayActionToGameAction(action, state);
  assert.ok(command);
  const repaired = gameReducer(state, command);
  assert.ok(repaired.tiles.filter(t => t.hasRoad).length > state.tiles.filter(t => t.hasRoad).length);
  assert.ok(repaired.treasuryTimber <= state.treasuryTimber);
});

for (const localBread of [0, 1]) test(`remote stocked bread cannot cover local bread ${localBread} and hungry homes`, async () => {
  // Given real road components and synthetic chronological policy evidence only.
  const { replayFoodObservation } = await import('./foodEfficiencyObservationFixture');
  const { building } = await import('./helpers/autoplayFoodFixtures');
  const { measuredFoodDecision } = await import('../src/engine/autoplayFoodMeasuredDecision');
  const base = routedStockTown(false);
  const state = replayFoodObservation({ ...base, houses: base.houses.map(h => ({ ...h, breadStock: 0 })),
    buildings: [...base.buildings.map(b => b.kind === 'granary' ? { ...b, inventory: { bread: 200 } } : b),
      { ...building('local', 'granary', 1, 2, 2), inventory: { bread: localBread } }] }, { wheat: 1000, bread: 1000, exports: 0 });
  // When global production and remote inventory look abundant.
  const decision = measuredFoodDecision(state);
  // Then a physical supply break is diagnosed before claiming sufficient food.
  assert.equal(decision.reason, 'food_route_blocked');
});

test('private household reserves cannot offset measured missed meals in other homes', async () => {
  const { observedFoodTown } = await import('./foodEfficiencyObservationFixture');
  const { measuredFoodDecision } = await import('../src/engine/autoplayFoodMeasuredDecision');
  const observed = observedFoodTown(180, 89);
  const state = { ...observed, houses: observed.houses.map((house, index) => ({ ...house,
    breadStock: index === 0 ? 0 : 100 })) };
  assert.ok(foodEfficiencyMetrics(state).requestedBread > foodEfficiencyMetrics(state).consumedBread);
  assert.deepEqual(measuredFoodDecision(state), { kind: 'wheat_farm', reason: 'actual_wheat_deficit' });
  const shared = { ...state, buildings: state.buildings.map(building => building.kind === 'granary'
    ? { ...building, inventory: { ...building.inventory, bread: 1000 } } : building) };
  assert.deepEqual(measuredFoodDecision(shared), { kind: null, reason: 'food_supply_sufficient' });
});
