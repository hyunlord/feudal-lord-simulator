import assert from 'node:assert/strict';
import test from 'node:test';
import { transientFoodDecision } from '../src/engine/autoplayFoodTransient';
import { hasTransientMealCoverage } from '../src/engine/autoplayFoodTransientCoverage';
import { decideNextAction } from '../src/engine/autoplay';
import { advanceFoodFlow } from '../src/engine/autoplayFoodFlow';
import { recordFoodMeals } from '../src/engine/autoplayFoodTransientMeals';
import { foodAction } from '../src/engine/autoplayFood';
import { foodFlowLayout, foodFlowRoutes } from '../src/engine/autoplayFoodFlow';
import { autoplayActionToGameAction } from '../src/engine/autoplayActions';
import { gameReducer } from '../src/state/gameStore';
import { foodRecoveryKind } from '../src/engine/autoplayFoodThroughput';
import type { GameState } from '../src/engine/engine.types';
import { building, foodBuildRequest, routedStockTown } from './helpers/autoplayFoodFixtures';

// Derived narrow flow/meal fixture, not a historical save or fabricated runtime proof.
function fedTown(): GameState {
  const base = routedStockTown(true);
  const buildings = [building('granary', 'granary', 1, 2, 2),
    building('mill', 'mill', 5, 2, 2), building('farm', 'wheat_farm', 8, 2, 4),
    building('home', 'house', 4, 0, 0)];
  const houses = [{ ...base.houses[0], buildingId: 'home', level: 4, builtLevel: 4,
    residents: 32, hasWater: true, breadStock: 8, emptyFoodTicks: 0, lastServicedTick: 6000,
    unmetRequirementTicks: 0 }];
  const state = { ...base, tick: 6120, population: 32, idleWorkers: 4, buildings: buildings.map(b =>
    b.kind === 'granary' ? { ...b, inventory: { bread: 40, wheat: 80 } } : b), houses };
  const pool = { wheat: 80, usableWheat: 80, bread: 48, usableBread: 40 };
  const completed = { startedTick: 5600, untilTick: 6000, wheatProduced: 10, wheatExported: 0,
    breadProduced: 3, breadExported: 0, qualified: true,
    poolStart: { ...pool, bread: 49 }, poolEnd: pool,
    meals: { startedTick: 5600, throughTick: 6000, homes: [
      { buildingId: 'home', residents: 32, requested: 4, consumed: 4, starving: false }] } };
  return { ...state, autoplayFoodFlow: { layout: foodFlowLayout(state), routes: foodFlowRoutes(state),
    roadRevision: state.roadRevision, poolIds: buildings.map(b => b.id), completed,
    current: { ...completed, startedTick: 6000, untilTick: 6801, wheatProduced: 0, breadProduced: 0,
      meals: { startedTick: 6000, throughTick: 6120, homes: [{ buildingId: 'home', residents: 32,
        requested: 0, consumed: 0, starving: false }] } } } };
}

function applyFood(state: GameState): GameState {
  const action = autoplayActionToGameAction(foodAction(state, foodBuildRequest), state);
  return action === null ? state : gameReducer(state, action);
}

test('Given one fully served negative window with sufficient reserves When deciding Then persist one fixed confirmation instead of building', () => {
  const state = fedTown();
  assert.equal(foodRecoveryKind(state, 4), 'mill');
  const action = foodAction(state, foodBuildRequest);
  assert.equal(action.kind, 'none');
  assert.ok('foodTransient' in action);
  const next = applyFood(state);
  assert.ok('autoplayFoodTransientConfirmation' in next);
});

test('Given legacy meal metadata is absent When a positive reserve is depleting Then retain immediate mill recovery', () => {
  const state = fedTown();
  const flow = state.autoplayFoodFlow;
  assert.ok(flow?.completed?.poolStart && flow.completed.poolEnd);
  const sample = { startedTick: 5600, untilTick: 6000, wheatProduced: 10, wheatExported: 0,
    breadProduced: 3, breadExported: 0, qualified: true, poolStart: flow.completed.poolStart,
    poolEnd: flow.completed.poolEnd };
  assert.equal(foodAction({ ...state, autoplayFoodFlow: { ...flow, completed: sample } }, foodBuildRequest).kind, 'place_building');
});

test('Given private food is insufficient through the next ordinary decision When shared stock is reserved Then do not defer', () => {
  const state = fedTown();
  const reserved = { ...state, houses: state.houses.map(h => ({ ...h, breadStock: 0 })),
    buildings: state.buildings.map(b => b.kind === 'granary' ? { ...b, stockReserved: { bread: 40 } } : b) };
  assert.equal(foodAction(reserved, foodBuildRequest).kind, 'place_building');
});

function progressed(state: GameState, tick: number, bread: number): GameState {
  const flow = state.autoplayFoodFlow;
  assert.ok(flow?.completed);
  const completed = { ...flow.completed, startedTick: 6000, untilTick: 6802,
    wheatProduced: 40, breadProduced: bread, meals: { startedTick: 6000, throughTick: 6802,
      homes: [{ buildingId: 'home', residents: 32, requested: 8, consumed: 8, starving: false }] } };
  return { ...state, tick, autoplayFoodFlow: { ...flow, completed,
    current: { ...completed, startedTick: 6802, untilTick: 7602, meals: { startedTick: 6802, throughTick: tick,
      homes: [{ buildingId: 'home', residents: 32, requested: 0, consumed: 0, starving: false }] } } } };
}

test('Given a fixed pending deadline When a newer full window is positive at the ordinary decision Then clear without construction', () => {
  const pending = applyFood(fedTown());
  assert.equal(pending.autoplayFoodTransientConfirmation?.status, 'pending');
  const positive = progressed(pending, 6840, 9);
  const action = foodAction(positive, foodBuildRequest);
  assert.equal(action.kind, 'none');
  assert.equal(action.foodTransient, null);
  assert.equal(applyFood(positive).autoplayFoodTransientConfirmation, undefined);
});

test('Given one confirmation When the second comparable window is negative Then recover in the same call and latch failure', () => {
  const second = progressed(applyFood(fedTown()), 6840, 3);
  const action = foodAction(second, foodBuildRequest);
  assert.equal(action.kind, 'place_building');
  assert.equal(action.foodTransient?.status, 'failed_until_positive_window');
});

test('Given the opportunity dynamically extends When no new completed sample exists at the fixed deadline decision Then fail without extending', () => {
  const pending = applyFood(fedTown());
  const flow = pending.autoplayFoodFlow;
  assert.ok(flow?.current.meals);
  const extended = { ...pending, tick: 6840, autoplayFoodFlow: { ...flow,
    current: { ...flow.current, untilTick: 9000, meals: { ...flow.current.meals, throughTick: 6840 } } } };
  const decision = transientFoodDecision(extended, 4, true);
  assert.equal(decision.defer, false);
  assert.equal(decision.foodTransient?.status, 'failed_until_positive_window');
});

test('Given a pending confirmation When roads change Then failed allowance survives missing and negative windows and token output', () => {
  const pending = applyFood(fedTown());
  const changed = { ...pending, roadRevision: pending.roadRevision + 1 };
  const decision = transientFoodDecision(changed, 4, true);
  assert.equal(decision.foodTransient?.status, 'failed_until_positive_window');
  assert.ok(decision.foodTransient);
  const failed = { ...changed, autoplayFoodTransientConfirmation: decision.foodTransient };
  const { autoplayFoodFlow: _flow, ...warming } = failed;
  assert.deepEqual(transientFoodDecision(warming, 4, false), { defer: false });
  assert.deepEqual(transientFoodDecision(progressed(failed, 6840, 1), 4, true), { defer: false });
});

test('Given a projected extra home When existing rations are lower Then confirmation never hides growth demand', () => {
  const state = fedTown();
  assert.equal(transientFoodDecision(state, 6, true).defer, false);
});

test('Given a meal after the frozen deadline but before evaluation When private stock covers only the bare deadline Then reject confirmation', () => {
  const state = fedTown();
  const flow = state.autoplayFoodFlow;
  assert.ok(flow);
  const low = { ...state, tick: 6360, houses: state.houses.map(h => ({ ...h, breadStock: 0 })),
    buildings: state.buildings.map(b => ({ ...b, inventory: { wheat: 80, bread: 0 } })),
    autoplayFoodFlow: { ...flow, current: { ...flow.current, untilTick: 6399 } } };
  assert.equal(hasTransientMealCoverage(low, 6399), true);
  assert.equal(hasTransientMealCoverage(low, 6480), false);
});

test('Given food in another home When this home cannot meet its meal Then private stock is not a shared source', () => {
  const state = fedTown();
  const poor = { ...state, buildings: [...state.buildings.map(b => ({ ...b, inventory: {} })), building('other', 'house', 7, 0, 0)],
    houses: [{ ...state.houses[0], buildingId: 'home', level: 4, residents: 32, hasWater: true,
      breadStock: 0, lastServicedTick: 0, unmetRequirementTicks: 0 },
    { ...state.houses[0], buildingId: 'other', level: 4, residents: 32, hasWater: true,
      breadStock: 100, lastServicedTick: 0, unmetRequirementTicks: 0 }] };
  assert.equal(hasTransientMealCoverage(poor, 6480), false);
});

test('Given confirmation metadata with a building command When reducing Then both state effects occur in one action', () => {
  const state = fedTown();
  const food = foodAction(state, foodBuildRequest);
  assert.ok(food.foodTransient);
  const action = autoplayActionToGameAction({ kind: 'place_building', building: 'well', tx: 12, ty: 3,
    foodTransient: food.foodTransient }, state);
  assert.ok(action);
  const next = gameReducer(state, action);
  assert.equal(next.autoplayFoodTransientConfirmation?.status, 'pending');
  assert.equal(next.constructionSites.length, state.constructionSites.length + 1);
});

test('Given higher priority missing water When food could confirm Then water action is not consumed by bookkeeping', () => {
  const state = { ...fedTown(), houses: fedTown().houses.map(h => ({ ...h, hasWater: false })) };
  const action = decideNextAction(state);
  assert.equal(action.kind, 'place_building');
  assert.equal(action.kind === 'place_building' && action.building, 'well');
  assert.equal(action.foodTransient, undefined);
});

test('Given a legacy mid-window load When recording real meals Then missing historical ticks cannot qualify', () => {
  const legacy = fedTown();
  const flow = legacy.autoplayFoodFlow;
  assert.ok(flow);
  const { meals: _meals, ...current } = flow.current;
  const observed = recordFoodMeals({ ...legacy, autoplayFoodFlow: { ...flow, current } }, legacy.houses);
  assert.equal(observed.autoplayFoodFlow?.current.meals?.valid, false);
  const fresh = advanceFoodFlow({ ...observed, tick: 10000 });
  const ticked = recordFoodMeals({ ...fresh, tick: fresh.tick + 1 }, fresh.houses);
  assert.equal(ticked.autoplayFoodFlow?.current.meals?.valid, true);
});

test('Given one shared granary reserve When two homes need the same bread Then allocation spends it only once', () => {
  const state = fedTown();
  const shared = { ...state, buildings: [...state.buildings.map(b => b.kind === 'granary'
    ? { ...b, inventory: { bread: 4, wheat: 80 } } : b), building('other', 'house', 7, 0, 0)],
    houses: [...state.houses.map(h => ({ ...h, breadStock: 0 })),
      { buildingId: 'other', level: 4, residents: 32, hasWater: true, breadStock: 0,
        lastServicedTick: 0, unmetRequirementTicks: 0 }] };
  assert.equal(hasTransientMealCoverage(shared, 6480), false);
});

test('Given stocked bread in an unreachable supplier component When the local granary is empty Then global inventory cannot qualify', () => {
  const state = fedTown();
  const disconnected = { ...state, buildings: [...state.buildings.map(b => ({ ...b, inventory: {} })),
    { ...building('remote', 'granary', 25, 2, 2), inventory: { bread: 100 } }],
    houses: state.houses.map(h => ({ ...h, breadStock: 0 })),
    tiles: state.tiles.map(t => ({ ...t, hasRoad: t.ty === 1 && (t.tx < 12 || t.tx > 20) })),
    roadRevision: state.roadRevision + 1, pathCache: {} };
  assert.equal(hasTransientMealCoverage(disconnected, 6480), false);
});

test('Given a pending confirmation When the current real meal is missed Then revoke before its fixed deadline', () => {
  const pending = applyFood(fedTown());
  const flow = pending.autoplayFoodFlow;
  assert.ok(flow?.current.meals);
  const missed = { ...pending, autoplayFoodFlow: { ...flow, current: { ...flow.current,
    meals: { ...flow.current.meals, homes: flow.current.meals.homes.map(h => ({ ...h, requested: 4, consumed: 3 })) } } } };
  const result = transientFoodDecision(missed, 4, true);
  assert.equal(result.defer, false);
  assert.equal(result.foodTransient?.status, 'failed_until_positive_window');
});

test('Given a pending confirmation When a new occupied home lacks evidence Then revoke without inventing historical meals', () => {
  const pending = applyFood(fedTown());
  const newHome = { ...pending, houses: [...pending.houses,
    { buildingId: 'new', level: 0, residents: 1, hasWater: true, breadStock: 3,
      lastServicedTick: 6120, unmetRequirementTicks: 0 }] };
  assert.equal(transientFoodDecision(newHome, 5, true).foodTransient?.status, 'failed_until_positive_window');
});

test('Given a failed allowance after an epoch change When a newer whole window is healthy and nonnegative Then rearm only then', () => {
  const state: GameState = { ...fedTown(), autoplayFoodTransientConfirmation:
    { status: 'failed_until_positive_window', failedTick: 6120 } };
  assert.equal(transientFoodDecision(state, 4, true).foodTransient, undefined);
  assert.equal(transientFoodDecision(progressed(state, 6840, 9), 4, false).foodTransient, null);
});

test('Given a full actual post-delivery meal When observing Then consumption is recorded once at the same tick', () => {
  const state = fedTown();
  const flow = state.autoplayFoodFlow;
  assert.ok(flow);
  const { meals: _meals, ...current } = flow.current;
  const opened = { ...state, tick: 6400, autoplayFoodFlow: { ...flow,
    current: { ...current, startedTick: 6399 } } };
  const served = opened.houses.map(h => ({ ...h, breadStock: 4 }));
  const recorded = recordFoodMeals(opened, served);
  const evidence = recorded.autoplayFoodFlow?.current.meals;
  assert.equal(evidence?.homes[0]?.requested, 4);
  assert.equal(evidence?.homes[0]?.consumed, 4);
  assert.equal(evidence?.valid, true);
  assert.deepEqual(recordFoodMeals(recorded, served), recorded);
});

test('Given a cancelled or wrong destination bread carter When no shared stock remains Then cargo cannot fund confirmation', () => {
  const state = fedTown();
  const cargo: GameState = { ...state, buildings: state.buildings.map(b => ({ ...b, inventory: {} })),
    houses: state.houses.map(h => ({ ...h, breadStock: 0 })), walkers: [{
      id: 'cancelled', kind: 'carter', mission: 'deliver', phase: 'outbound', homeBuildingId: 'mill',
      destination: { kind: 'building', buildingId: 'granary' }, reservation: {
        destination: { kind: 'building', buildingId: 'granary' }, resource: 'bread', amount: 8,
        sourceStockClaim: null, homeCapacityClaim: null },
      position: { tx: 5, ty: 1 }, path: [{ tx: 5, ty: 1 }], pathIndex: 0, previousTile: null,
      cargo: { resource: 'bread', amount: 8 }, spawnedTick: 6000,
      cancellation: { tick: 6120, reason: 'manual', releasedReservation: true } }] };
  assert.equal(hasTransientMealCoverage(cargo, 6480), false);
  assert.equal(hasTransientMealCoverage({ ...cargo, walkers: cargo.walkers.map(w => w.kind === 'carter'
    ? { ...w, cancellation: null, destination: { kind: 'building', buildingId: 'missing' } } : w) }, 6480), false);
});

test('Given a pending food deferral in stone town When lower priority water is required Then carry metadata with that same-call action', () => {
  const state = { ...fedTown(), era: 'stone_town' as const,
    houses: fedTown().houses.map(h => ({ ...h, hasWater: false })) };
  const action = decideNextAction(state);
  assert.notEqual(action.kind, 'none');
  assert.equal(action.foodTransient?.status, 'pending');
});

test('Given bread in a distant granary on the same road When only an empty local granary can reach the home Then no imaginary granary transfer funds waiting', () => {
  const state = fedTown();
  const flow = state.autoplayFoodFlow;
  assert.ok(flow);
  const stranded = { ...state, width: 64, buildings: [...state.buildings.map(b => ({ ...b, inventory: {} })),
    { ...building('remote', 'granary', 55, 2, 2), inventory: { bread: 40 } }],
    houses: state.houses.map(h => ({ ...h, breadStock: 0 })),
    tiles: Array.from({ length: 320 }, (_, n) => ({ tx: n % 64, ty: Math.floor(n / 64), terrain: 'grass' as const,
      hasRoad: Math.floor(n / 64) === 1, buildingId: null })),
    autoplayFoodFlow: { ...flow, poolIds: [...(flow.poolIds ?? []), 'remote'] } };
  assert.equal(hasTransientMealCoverage(stranded, 6480), false);
});

function deliveryCargoTown(): GameState {
  const state = fedTown();
  return { ...state, buildings: state.buildings.map(b => ({ ...b, inventory: {},
    reserved: b.kind === 'granary' ? { bread: 8 } : {} })),
    houses: state.houses.map(h => ({ ...h, breadStock: 0 })), walkers: [{ id: 'bread-trip', kind: 'carter',
      mission: 'deliver', phase: 'outbound', homeBuildingId: 'mill', destination: { kind: 'building', buildingId: 'granary' },
      reservation: { destination: { kind: 'building', buildingId: 'granary' }, resource: 'bread', amount: 8,
        sourceStockClaim: null, homeCapacityClaim: null },
      cargo: { resource: 'bread', amount: 8 }, position: { tx: 5, ty: 1 },
      path: [5, 4, 3, 2, 1].map(tx => ({ tx, ty: 1 })), pathIndex: 0, previousTile: null,
      cancellation: null, spawnedTick: 6110 }] };
}

test('Given real outbound bread with matching capacity reservation When its own granary can feed the home before evaluation Then count cargo once', () => {
  assert.equal(hasTransientMealCoverage(deliveryCargoTown(), 6480), true);
});

for (const defect of ['cancelled', 'returning', 'wrong-reservation', 'removed-road', 'late', 'unreserved'] as const) {
  test(`Given outbound bread with ${defect} When evaluating reserve Then do not credit cargo`, () => {
    const state = deliveryCargoTown();
    const changed: GameState = { ...state,
      buildings: defect === 'unreserved' ? state.buildings.map(b => ({ ...b, reserved: {} })) : state.buildings,
      tiles: defect === 'removed-road' ? state.tiles.map(t => t.tx === 3 ? { ...t, hasRoad: false } : t) : state.tiles,
      walkers: state.walkers.map(w => w.kind !== 'carter' ? w : {
        ...w, phase: defect === 'returning' ? 'returning' : w.phase,
        reservation: defect === 'wrong-reservation' ? { ...w.reservation,
          destination: { kind: 'building', buildingId: 'mill' } } : w.reservation,
        cancellation: defect === 'cancelled' ? { tick: state.tick, reason: 'manual', releasedReservation: true } : null,
      }) };
    assert.equal(hasTransientMealCoverage(changed, defect === 'late' ? 6121 : 6480), defect === 'late');
    // No meal before6121 means no cargo is needed; at a meal one tick away it is necessary and too late.
    if (defect === 'late') assert.equal(hasTransientMealCoverage({ ...changed, tick: 6399 }, 6400), false);
  });
}

test('Given two cargo claims but only one reserved capacity When three homes need bread Then shared reservation cannot be reused', () => {
  const state = deliveryCargoTown();
  const trip = state.walkers[0];
  assert.ok(trip);
  const crowded = { ...state, buildings: [...state.buildings, building('other', 'house', 7, 0, 0), building('third', 'house', 9, 0, 0)],
    houses: [...state.houses, ...['other', 'third'].map(buildingId => ({ buildingId, level: 4, residents: 32,
      hasWater: true, breadStock: 0, lastServicedTick: 0, unmetRequirementTicks: 0 }))],
    walkers: [trip, { ...trip, id: 'duplicate-claim' }] };
  assert.equal(hasTransientMealCoverage(crowded, 6480), false);
});
