import { replayFoodObservation } from './foodEfficiencyObservationFixture';
import { foodFlowLayout, foodFlowRoutes } from '../src/engine/autoplayFoodFlow';
import type { GameState } from '../src/engine/engine.types';
import { decideNextAction } from '../src/engine/autoplay';
import assert from 'node:assert/strict';
import test from 'node:test';
import type { FoodDiagnosticCollector } from '../src/engine/autoplayFoodDiagnostic';
import { foodAction } from '../src/engine/autoplayFood';
import { foodBuildRequest, stressedTown, routedStockTown, building, withMeasuredFood } from './helpers/autoplayFoodFixtures';

// AF-13: the grain slot is now a farmstead tending an arable zone, so the wheat-farm town needs the farms
// relabelled and an actual field behind each farmstead (else the expected harvest is zero and grain is always
// short); giving every farmstead its own small block keeps the measured mill/bread checks the only thing in play.
function farmsteadified(state: GameState): GameState {
  return { ...state, buildings: state.buildings.map(b => b.kind === 'wheat_farm' ? { ...b, kind: 'farmstead' } : b) };
}
function withAmpleArable(state: GameState): GameState {
  const membership: number[] = [];
  for (const farmstead of state.buildings.filter(b => b.kind === 'farmstead')) {
    for (let dy = 2; dy <= 3; dy += 1) {
      for (let dx = 2; dx <= 4; dx += 1) {
        const tx = farmstead.tx + dx;
        const ty = farmstead.ty + dy;
        if (tx < 0 || ty < 0 || tx >= state.width || ty >= state.height) continue;
        membership.push(ty * state.width + tx);
      }
    }
  }
  return { ...state, zones: [{ id: 'zone-arable-test', kind: 'arable', strokes: [], membership, createdOrdinal: 1 }],
    nextZoneOrdinal: 2 };
}
function ampleFoodTown(wheat = 1000, bread = 40): GameState {
  const base = withAmpleArable(farmsteadified(stressedTown()));
  // AF-13 shrank the mill headroom to the expected harvest (a handful of mills, not one per farmstead), so this
  // fixture's five stock mills would sit over the new limit before recovery is ever evaluated.
  const state = { ...base,
    tiles: base.tiles.map(t => ({ ...t, hasRoad: t.hasRoad || t.ty === 1 || t.tx === 0 })),
    houses: base.houses.map(h => ({ ...h, breadStock: 0 })),
    buildings: base.buildings.flatMap(b => b.kind !== 'mill' ? [b]
      : b.id === 'mill0' ? [{ ...b, inventory: { wheat: 2 } }] : []) };
  return replayFoodObservation(state, { wheat, bread, exports: 0 });
}

test('Given no housing When food runs Then baseline action and no build calls are preserved', () => {
  const state = { ...stressedTown(), houses: [] };
  let calls = 0;
  assert.deepEqual(foodAction(state, (s, k) => { calls++; return foodBuildRequest(s, k); }), { kind: 'none' });
  assert.equal(calls, 0);
});
test('Given diagnostic collection When no housing returns Then receipt records actual terminal branch', () => {
  const collector: FoodDiagnosticCollector = {};
  const state = { ...stressedTown(), houses: [] };
  assert.deepEqual(foodAction(state, foodBuildRequest, collector), { kind: 'none' });
  assert.equal(collector.food?.reason, 'no_housing');
});

test('Given pending and active observation When food runs Then earlier terminal branches are retained', async () => {
  const { createConstructionSite } = await import('../src/economy/construction');
  const pending = { ...stressedTown(), constructionSites: [createConstructionSite({ ordinal: 1, kind: 'mill', tx: 55, ty: 2, startedTick: 6000 })] };
  const active = { ...stressedTown(), autoplayFoodObservation: { kind: 'mill', siteId: 'mill0', placedTick: 5000, completedTick: 5600, observeUntilTick: 7000 } } satisfies Parameters<typeof foodAction>[0];
  for (const [state, reason] of [[pending, 'pending_chain'], [active, 'active_observation']] as const) {
    const collector: FoodDiagnosticCollector = {};
    assert.deepEqual(foodAction(state, foodBuildRequest, collector), { kind: 'none' });
    assert.equal(collector.food?.reason, reason);
    assert.deepEqual(collector.food?.checks, []);
    assert.equal(collector.food?.evaluation.transitionRepeat, 'not_evaluated');
  }
});

test('Given a measured recovery When instrumented Then each applicable construction guard is evaluated once in order', async () => {
  const state = ampleFoodTown();
  const collector: FoodDiagnosticCollector = {};
  const result = foodAction(state, foodBuildRequest, collector);
  assert.equal(collector.food?.recovery, 'mill');
  assert.equal(collector.food?.reason, 'recovery_selected');
  assert.deepEqual(collector.food?.checks.map(c => [c.phase, c.check]), [['build','repeat'],['build','staff']]);
  assert.deepEqual(result, foodAction(structuredClone(state), foodBuildRequest));
});

test('Given a rejected build When recovery runs Then diagnostics distinguish build none without a second attempt', async () => {
  const collector: FoodDiagnosticCollector = {};
  let calls = 0;
  foodAction(ampleFoodTown(), () => { calls++; return { kind: 'none' }; }, collector);
  assert.equal(calls, 1);
  assert.equal(collector.food?.reason, 'build_returned_none');
});

function fedTown(): GameState {
  const base = routedStockTown(true);
  const buildings = [building('granary', 'granary', 1, 2, 2),
    building('mill', 'mill', 5, 2, 2), building('farm', 'farmstead', 8, 2, 4),
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


for (const blocked of ['repeat', 'staff'] as const) test(`Given ${blocked} blocks recovery When recorded Then short-circuited calls remain unevaluated`, () => {
  let state = ampleFoodTown();
  if (blocked === 'staff') state.idleWorkers = 0;
  else state = { ...state, autoplayFoodObservation: { kind: 'mill', siteId: 'mill0', placedTick: 1, completedTick: 2, observeUntilTick: 3,
    outcome: { outputDelta: 0, deliveredBreadDelta: 0, starvingHomesDelta: 0, effective: false } } };
  const collector: FoodDiagnosticCollector = {};
  foodAction(state, foodBuildRequest, collector);
  assert.equal(collector.food?.reason, blocked === 'repeat' ? 'repeat_blocked' : 'staff_blocked');
  if (blocked === 'repeat') assert.equal(collector.food?.evaluation.transitionStaff, 'not_evaluated');
});
test('Given adequate measured food When recorded Then subordinate reasons stay not captured', () => {
  const collector: FoodDiagnosticCollector = {};
  foodAction(ampleFoodTown(2400, 1000), foodBuildRequest, collector);
  assert.equal(collector.food?.reason, 'food_supply_sufficient');
  assert.equal(collector.food?.details, 'not_captured');
});
test('Given stale measured flow and starving homes When recorded Then actual unmeasured guard remains unchanged', () => {
  let state = withMeasuredFood(farmsteadified(stressedTown()));
  assert.ok(state.autoplayFoodFlow);
  state = { ...state, autoplayFoodFlow: { ...state.autoplayFoodFlow, layout: 'stale' } };
  const collector: FoodDiagnosticCollector = {};
  foodAction(state, foodBuildRequest, collector);
  assert.equal(collector.food?.reason, 'observation_warmup');
  assert.equal(collector.food?.details, 'not_captured');
});
test('Given incomplete food chain When recorded Then bootstrap selection and sufficiently stocked bootstrap are distinct', () => {
  const state = stressedTown();state.buildings = state.buildings.filter(b => b.kind === 'house');
  state.houses = state.houses.map(h => ({ ...h, breadStock: 0 }));
  const collector: FoodDiagnosticCollector = {};
  foodAction(state, foodBuildRequest, collector);
  assert.equal(collector.food?.reason, 'bootstrap_selected');
  state.houses = state.houses.map(h => ({ ...h, breadStock: 100 }));state.idleWorkers = 0;
  foodAction(state, foodBuildRequest, collector);
  assert.equal(collector.food?.reason, 'bootstrap_exhausted');
});
test('Given only legacy transient evidence When recorded Then warmup is explicit and no new transient metadata is generated', () => {
  const state = fedTown();const collector: FoodDiagnosticCollector = {};
  const result = foodAction(state, foodBuildRequest, collector);
  assert.equal(collector.food?.reason, 'observation_warmup');
  assert.equal(result.kind, 'none');assert.equal(collector.food?.transition, undefined);
  assert.equal(result.foodTransient, undefined);
});
test('Given legacy pending metadata When rolling evidence is absent Then it does not authorize or rewrite a recovery', () => {
  const state = { ...fedTown(), autoplayFoodTransientConfirmation: { status: 'pending', startedTick: 1, deadlineTick: 2, evaluationTick: 2, epoch: 'stale', firstWindowUntilTick: 0 } } satisfies GameState;
  state.buildings = state.buildings.map(b => b.kind === 'mill' ? { ...b, workers: 0 } : b);
  const collector: FoodDiagnosticCollector = {};
  const result = foodAction(state, foodBuildRequest, collector);
  assert.equal(collector.food?.reason, 'observation_warmup');
  assert.equal(result.foodTransient, undefined);
});
test('Given food warmup before later water choice When advisor runs Then food and final action remain distinct', () => {
  const state = { ...fedTown(), era: 'stone_town', houses: fedTown().houses.map(h => ({ ...h, hasWater: false })) } satisfies GameState;
  const collector: FoodDiagnosticCollector = {};
  const result = decideNextAction(state, undefined, collector);
  assert.equal(collector.food?.action?.kind, 'none');
  assert.notEqual(result.kind, 'none');assert.equal(result.foodTransient, undefined);
});

test('Given distant vacant home and stocked granary When food runs Then coverage is the actual terminal branch', () => {
  const granary = { ...building('granary', 'granary', 1, 1, 2), inventory: { bread: 100 } };
  const home = building('home', 'house', 55, 2, 0);
  const state = { ...stressedTown(), era: 'hamlet', treasuryTimber: 1000, idleWorkers: 20, buildings: [granary, home],
    houses: [{ buildingId: 'home', level: 0, builtLevel: 0, residents: 0, hasWater: true, breadStock: 0, lastServicedTick: 0, unmetRequirementTicks: 0 }] } satisfies GameState;
  const collector: FoodDiagnosticCollector = {};
  const action = foodAction(state, foodBuildRequest, collector);
  assert.notEqual(action.kind, 'none');assert.equal(collector.food?.reason, 'coverage_selected');
  assert.equal(collector.food?.recovery, undefined);
});
test('Given food warmup When the full driver records Then observation matches the uninstrumented action without invented metadata', async () => {
  const { createAutoplayTraceDriver } = await import('../scripts/economyHarnessAutoplay');
  const state = { ...fedTown(), era: 'stone_town' } satisfies GameState;
  const baseline = createAutoplayTraceDriver({ id: 'baseline', source: 'synthetic' }).apply(structuredClone(state));
  let seen = 0;
  const driver = createAutoplayTraceDriver({ id: 'metadata', source: 'synthetic', onDiagnostic: receipt => {
    seen++;assert.equal(receipt.food.reason, 'observation_warmup');
    assert.equal(receipt.food.action?.kind, 'none');assert.equal(receipt.result, 'applied');
    assert.equal(driver.appliedActions.length, 1);
  } });
  const next = driver.apply(structuredClone(state));
  assert.deepEqual(next, baseline);assert.equal(next.autoplayFoodTransientConfirmation, undefined);assert.equal(seen, 1);
});
