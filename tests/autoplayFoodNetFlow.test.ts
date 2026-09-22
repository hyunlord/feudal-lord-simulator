import { observedFoodTown, replayFoodObservation } from './foodEfficiencyObservationFixture';
import { stepCarters } from '../src/agents/delivery';
import { createDeliveryInventoryPort, createSimulationRoutePorts } from '../src/engine/simulationPorts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { foodAction } from '../src/engine/autoplayFood';
import { settleMarkets } from '../src/engine/marketSettlement';
import { advanceTick, runProduction } from '../src/engine/tick';
import { BUILDING_CONFIG_BY_KIND } from '../src/content/buildingConfig';
import { foodRecoveryKind } from '../src/engine/autoplayFoodThroughput';
import { advanceFoodFlow, recordFoodFlow, measuredFoodFlow } from '../src/engine/autoplayFoodFlow';
import { building, foodBuildRequest, routedStockTown, stressedTown, withMeasuredFood } from './helpers/autoplayFoodFixtures';

test('Given gross wheat surplus but actual market exports When recovering hunger Then choose a farm instead of another mill', () => {
  // Given chronological production and export events over a fresh 2400-tick window.

  const state = replayFoodObservation(observedFoodTown(1, 1), { wheat: 400, bread: 100, exports: 101 });
  // When / Then exports consume the margin needed by actual household meals.
  assert.equal(foodRecoveryKind(state, 74.8), 'wheat_farm');
});

for (const [wheat, bread, expected] of [[1000, 40, 'mill'], [1000, 400, null]] as const) {
  test(`Given measured wheat ${wheat} and bread ${bread} When actual household meal events are observed Then recovery is ${expected}`, () => {
    const state = observedFoodTown(wheat, bread);
    assert.equal(foodRecoveryKind(state, 48), expected);
    if (expected === null) assert.deepEqual(foodAction(state, foodBuildRequest), { kind: 'none' });
  });
}

test('Given a legacy cold save When real substeps advance Then partial windows wait and mature without inferred output', () => {
  let state = advanceFoodFlow(stressedTown());
  assert.equal(measuredFoodFlow(state), undefined);
  assert.deepEqual(foodAction(state, foodBuildRequest), { kind: 'none' });
  const deadline = state.autoplayFoodFlow?.current.untilTick;
  assert.ok(deadline);
  state = recordFoodFlow(state, { wheatProduced: 80 });
  state = advanceFoodFlow({ ...state, tick: deadline - 1 });
  assert.equal(measuredFoodFlow(state), undefined);
  state = advanceFoodFlow({ ...state, tick: deadline });
  assert.equal(measuredFoodFlow(state)?.wheatProduced, 80);
  assert.equal(state.autoplayFoodFlow?.current.wheatProduced, 0);
});

test('Given an old completed window When exact age expires or time rewinds Then no stale totals remain eligible', () => {
  const state = withMeasuredFood(stressedTown());
  assert.ok(measuredFoodFlow({ ...state, tick: state.tick + 399 }));
  assert.equal(measuredFoodFlow({ ...state, tick: state.tick + 400 }), undefined);
  const rewound = advanceFoodFlow({ ...state, tick: 0 });
  assert.equal(measuredFoodFlow(rewound), undefined);
  assert.equal(rewound.autoplayFoodFlow?.current.wheatProduced, 0);
});

test('Given mature food flow When a new producer completes Then its prior epoch cannot authorize recovery', () => {
  const state = withMeasuredFood(stressedTown());
  state.buildings = [...state.buildings, building('new-mill', 'mill', 50, 2, 2)];
  assert.equal(measuredFoodFlow(state), undefined);
  const next = advanceFoodFlow(state);
  assert.equal(next.autoplayFoodFlow?.completed, undefined);
  assert.equal(next.autoplayFoodFlow?.current.wheatProduced, 0);
});

test('Given mature food flow When an unrelated road and civic building change Then the bounded history survives', () => {
  const state = withMeasuredFood(stressedTown());
  const next = advanceFoodFlow({ ...state, roadRevision: state.roadRevision + 1,
    buildings: [...state.buildings, building('civic', 'well', 50, 6, 1)] });
  assert.equal(next.autoplayFoodFlow?.completed?.wheatProduced, 20);
});

test('Given unchanged actual meal evidence When legacy projected demand changes Then it cannot invent production demand', () => {
  const state = observedFoodTown();
  assert.equal(foodRecoveryKind(state, 30), 'mill');
  assert.equal(foodRecoveryKind(state, 45), 'mill');
  assert.equal(foodRecoveryKind(state, 60), 'mill');
});

test('Given a partial mill output marked effective When net raw supply is insufficient Then it cannot authorize another mill', () => {
  const base = observedFoodTown(80, 40);
  const state = { ...base, autoplayFoodObservation: { kind: 'mill' as const, siteId: 'mill0', placedTick: 0,
    completedTick: 100, observeUntilTick: 200, baseline: { outputTotal: 0, houseBread: 0, starvingHomes: 0 },
    latest: { outputTotal: 5, houseBread: 0, starvingHomes: 2 },
    outcome: { outputDelta: 5, deliveredBreadDelta: 0, starvingHomesDelta: 0, effective: true } } };
  const action = foodAction(state, foodBuildRequest);
  assert.equal(action.kind === 'place_building' ? action.building : action.kind, 'wheat_farm');
});

test('Given same-tick sale production delivery and consumption When the normal engine advances Then exact food events survive all state merges', () => {
  const state = routedStockTown(true);
  state.tick = 799;
  state.buildings.push(building('market', 'market', 10, 2, 2));
  state.buildings = state.buildings.map(b => b.kind === 'granary' ? { ...b, inventory: { wheat: 40 } }
    : b.kind === 'mill' ? { ...b, inventory: { wheat: 4 }, productionProgress: (BUILDING_CONFIG_BY_KIND.mill.production?.ticksPerOutput ?? 1) - 1 }
    : b.kind === 'wheat_farm' ? { ...b, inventory: {}, productionProgress: (BUILDING_CONFIG_BY_KIND.wheat_farm.production?.ticksPerOutput ?? 1) - 1 } : b);
  state.walkers = [{ id: 'food-delivery', kind: 'distributor', phase: 'roaming', homeBuildingId: 'granary',
    position: { tx: 7, ty: 1 }, path: [{ tx: 7, ty: 1 }], pathIndex: 0, previousTile: null,
    cargo: { resource: 'bread', amount: 2 }, spawnedTick: 799, junctionVisits: 0, tilesTravelled: 0, priorTile: null }];
  const next = advanceTick(state);
  assert.equal(next.autoplayFoodFlow?.current.wheatExported, 1);
  assert.equal(next.autoplayFoodFlow?.current.wheatProduced, 1);
  assert.equal(next.autoplayFoodFlow?.current.breadProduced, 1);
  assert.equal(next.treasuryCoin - state.treasuryCoin, 2);
  assert.equal(next.houses.find(h => h.buildingId === 'home7')?.lastServicedTick, 800);
  assert.equal(next.houses.find(h => h.buildingId === 'home7')?.breadStock, 0);
});

test('Given healthy homes and sufficient measured projected supply When nominal mill count is low Then preserve civic materials', () => {
  const state = withMeasuredFood(stressedTown(), 200, 100);
  state.houses = state.houses.map(h => ({ ...h, breadStock: 6, emptyFoodTicks: 0 }));
  state.buildings = state.buildings.filter(b => b.kind !== 'mill' || b.id === 'mill0');
  const measured = withMeasuredFood(state, 200, 100);
  assert.deepEqual(foodAction(measured, foodBuildRequest), { kind: 'none' });
});

test('Given healthy homes and only a short legacy window When growth demand is projected Then await actual rolling evidence', () => {
  const state = withMeasuredFood(stressedTown(), 80, 40);
  state.houses = state.houses.map(h => ({ ...h, breadStock: 6, emptyFoodTicks: 0 }));
  assert.equal(foodRecoveryKind(state, 48), null);
});

test('Given an actual food carter route When its travel exceeds the initial batch window Then opportunity extends without fabricating production', () => {
  const base = advanceTick(routedStockTown(true));
  const carter = base.walkers.find(w => w.kind === 'carter' && w.homeBuildingId === 'farm');
  assert.ok(carter);
  const initial = advanceFoodFlow(base);
  const before = initial.autoplayFoodFlow?.current.untilTick;
  assert.ok(before);
  const next = advanceFoodFlow({ ...initial, walkers: [{ ...carter,
    path: Array.from({ length: 201 }, (_, tx) => ({ tx, ty: 1 })) }] });
  assert.ok((next.autoplayFoodFlow?.current.untilTick ?? 0) > before);
  assert.equal(next.autoplayFoodFlow?.current.wheatProduced, 0);
  assert.deepEqual(advanceFoodFlow(next), next);
});

test('Given no production in a finite opportunity When it closes Then short zero throughput is recorded but cannot replace a full rolling observation', () => {
  const initial = advanceFoodFlow(stressedTown());
  const deadline = initial.autoplayFoodFlow?.current.untilTick;
  assert.ok(deadline);
  const next = advanceFoodFlow({ ...initial, tick: deadline });
  assert.equal(measuredFoodFlow(next)?.breadProduced, 0);
  assert.equal(foodRecoveryKind(next, 48), null);
});

for (const sale of [true, false]) test(`Given two connected markets and sale eligibility ${sale} When actual settlement runs Then only completed exports are counted`, () => {
  const base = routedStockTown(true);
  base.tick = 800;
  base.buildings.push(building('market1', 'market', 10, 2, 3), building('market2', 'market', 12, 2, 3));
  base.buildings = base.buildings.map(b => b.kind === 'granary' ? { ...b, inventory: { bread: sale ? 44 : 40, wheat: 30 } } : b);
  const state = advanceFoodFlow(base);
  const next = settleMarkets(state);
  assert.equal(next.autoplayFoodFlow?.current.breadExported, sale ? 2 : 0);
  assert.equal(next.autoplayFoodFlow?.current.wheatExported, 0);
  assert.equal(next.treasuryCoin - state.treasuryCoin, sale ? 10 : 0);
  assert.equal(next.buildings.find(b => b.kind === 'granary')?.inventory.bread, sale ? 42 : 40);
});

for (const [kinds, expected] of [
  [['granary'], 'wheat_farm'],
  [['granary', 'wheat_farm'], 'mill'],
  [['wheat_farm', 'mill'], 'granary'],
] as const) test(`Given mature zero flow and only ${kinds.join(',')} When bootstrapping Then first missing chain step remains ${expected}`, () => {
  const base = stressedTown();
  base.houses = base.houses.slice(0, 1).map(h => ({ ...h, breadStock: 0 }));
  base.buildings = base.buildings.filter(b => b.id === base.houses[0]?.buildingId);
  base.buildings.push(...kinds.map((kind, n) => building(`bootstrap-${kind}`, kind, 2 + n * 4, 4, 4)));
  const state = withMeasuredFood(base, 0, 0);
  const action = foodAction(state, foodBuildRequest);
  assert.equal(action.kind === 'place_building' ? action.building : action.kind, expected);
});

for (const cause of ['staff', 'access', 'remote-route'] as const) test(`Given a ${cause} interruption When supply is restored Then its interrupted epoch cannot authorize expansion`, () => {
  const base = routedStockTown(true);
  let state = advanceFoodFlow({ ...base,
    buildings: base.buildings.map(b => cause === 'staff' ? { ...b, workers: 0 } : b),
    tiles: base.tiles.map(t => cause === 'access' || cause === 'remote-route' && t.tx === 4 ? { ...t, hasRoad: false } : t),
    roadRevision: base.roadRevision + 1, pathCache: {} });
  const deadline = state.autoplayFoodFlow?.current.untilTick;
  assert.ok(deadline);
  while (state.tick < deadline) state = runProduction({ ...advanceFoodFlow(state), tick: state.tick + 1 });
  state = advanceFoodFlow(state);
  const restored = advanceFoodFlow({ ...state,
    buildings: state.buildings.map(b => ({ ...b, workers: BUILDING_CONFIG_BY_KIND[b.kind].workersRequired })),
    tiles: base.tiles, roadRevision: state.roadRevision + 1, pathCache: {} });
  assert.equal(measuredFoodFlow(restored), undefined);
  assert.deepEqual(foodAction(restored, foodBuildRequest), { kind: 'none' });
});

test('Given a previously staffed mature sample When normal labour drops staffing Then post-labour flow is ineligible immediately', () => {
  const state = withMeasuredFood(routedStockTown(true), 0, 0);
  const next = advanceTick({ ...state, population: 0 });
  assert.equal(measuredFoodFlow(next), undefined);
  const restored = advanceTick({ ...next, population: 128 });
  assert.equal(measuredFoodFlow(restored), undefined);
});

test('Given an actual return-capacity-blocked food carter When real transport and production steps continue Then observation still has finite opportunity', () => {
  const base = routedStockTown(true);
  const destination = { kind: 'building' as const, buildingId: 'granary' };
  base.walkers = [{ id: 'blocked-return', kind: 'carter', mission: 'deliver', phase: 'returning',
    homeBuildingId: 'farm', destination,
    reservation: { destination, resource: 'wheat', amount: 8, sourceStockClaim: null, homeCapacityClaim: null },
    position: { tx: 7, ty: 1 }, path: [{ tx: 7, ty: 1 }], pathIndex: 0, previousTile: null,
    cargo: { resource: 'wheat', amount: 8 }, spawnedTick: base.tick,
    cancellation: { tick: base.tick, reason: 'road_removed', releasedReservation: true } }];
  let state = advanceFoodFlow(base);
  const deadline = state.autoplayFoodFlow?.current.untilTick;
  assert.ok(deadline);
  while (state.tick < deadline + 1) {
    const opened = advanceFoodFlow(state);
    const transport = stepCarters({ tick: state.tick + 1, buildings: state.buildings, walkers: state.walkers,
      inventory: createDeliveryInventoryPort(), routes: createSimulationRoutePorts(state).delivery });
    state = runProduction({ ...opened, tick: state.tick + 1, buildings: [...transport.buildings], walkers: [...transport.walkers] });
  }
  assert.equal(state.walkers.find(w => w.id === 'blocked-return')?.cargo?.amount, 8);
  assert.ok(measuredFoodFlow(state));
});
