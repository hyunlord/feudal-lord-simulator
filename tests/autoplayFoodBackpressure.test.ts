import { observedFoodTown } from './foodEfficiencyObservationFixture';
import { unblockedWheatUpperBound } from '../src/engine/autoplayFoodBottleneck';
import { createConstructionSite } from '../src/economy/construction';
import assert from 'node:assert/strict';
import test from 'node:test';
import { foodAction } from '../src/engine/autoplayFood';
import { foodRecoveryKind } from '../src/engine/autoplayFoodThroughput';
import { advanceFoodFlow, measuredFoodFlow, recordFoodFlow } from '../src/engine/autoplayFoodFlow';
import { advanceTick, runProduction } from '../src/engine/tick';
import { building, foodBuildRequest, stressedTown, withMeasuredFood } from './helpers/autoplayFoodFixtures';

function backlog(wheatStart: number, wheatEnd: number, breadBuffer: number, wheat = 134, bread = 67) {
  const base = stressedTown();
  base.tiles = base.tiles.map(t => ({ ...t, hasRoad: t.hasRoad || t.ty === 1 || t.tx === 0 }));
  base.buildings = base.buildings.map(b => b.kind === 'granary' ? { ...b, inventory: { wheat: 100, bread: breadBuffer } } : b);
  const state = withMeasuredFood(base, wheat, bread);
  const flow = state.autoplayFoodFlow;
  assert.ok(flow?.completed);
  const sample = { ...flow.completed, startedTick: state.tick - 1298, farmFullTicks: 1100, farmReadyTicks: 6490, farmOpeningProgress: 0,
    poolStart: { wheat: wheatStart, bread: breadBuffer, usableBread: breadBuffer, usableWheat: wheatStart },
    poolEnd: { wheat: wheatEnd, bread: breadBuffer, usableBread: breadBuffer, usableWheat: wheatEnd } };
  return { ...state, autoplayFoodFlow: { ...flow, poolIds: state.buildings.map(b => b.id), completed: sample } };
}

test('Given natural seed1 20520 flow and stocked buffer When projected demand is 21 Then do not add another farm or mill', () => {
  // Natural window 19106..20404: 134 wheat,67 bread,1100 farm-full ticks; stocked granary75bread/100wheat.
  assert.equal(foodRecoveryKind(backlog(136, 136, 75), 21), null);
});

test('Given nondepleting grain and output-full farms When bread buffer cannot cover demand Then recover downstream with a mill', () => {
  assert.equal(foodRecoveryKind(observedFoodTown(), 24), 'mill');
});

test('Given genuine raw depletion despite output-full activity When net exports leave grain short Then historical aggregates await a fresh measured window', () => {
  const state = backlog(312, 280, 0, 5131, 2076);
  const flow = state.autoplayFoodFlow;
  const sample = { ...flow.completed, startedTick: state.tick - 12000, wheatExported: 1011 };
  assert.equal(foodRecoveryKind({ ...state, autoplayFoodFlow: { ...flow, completed: sample } }, 74.8), null);
});

test('Given full grain stores but no observed backpressure When raw flow is short Then legacy backpressure alone cannot authorize construction', () => {
  const state = backlog(136, 136, 75);
  const flow = state.autoplayFoodFlow;
  assert.equal(foodRecoveryKind({ ...state, autoplayFoodFlow: { ...flow, completed: { ...flow.completed, farmFullTicks: 0 } } }, 21), null);
});

for (const [idle, wheat, bread, expected] of [[0, 20, 10, 'none'], [2, 20, 10, 'none'], [2, 200, 10, 'mill'], [4, 20, 10, 'wheat_farm']] as const) {
  test(`Given ${idle} spare workers When recovery needs additional staff Then action is ${expected}`, () => {
    const state = { ...observedFoodTown(wheat * 6, bread * 6), idleWorkers: idle };
    const action = foodAction(state, foodBuildRequest);
    assert.equal(action.kind === 'place_building' ? action.building : action.kind, expected);
  });
}

test('Given full farm inventory When an actual production opportunity closes Then physical stock and blocked activity are measured', () => {
  const base = stressedTown();
  base.tiles = base.tiles.map(t => ({ ...t, hasRoad: t.hasRoad || t.ty === 1 || t.tx === 0 }));
  base.buildings = base.buildings.map(b => b.kind === 'wheat_farm' ? { ...b, inventory: { wheat: 20 } } : b);
  let state = advanceFoodFlow(base);
  const deadline = state.autoplayFoodFlow?.current.untilTick;
  assert.ok(deadline);
  while (state.tick < deadline) state = runProduction({ ...advanceFoodFlow(state), tick: state.tick + 1 });
  state = advanceFoodFlow(state);
  const sample = measuredFoodFlow(state);
  assert.ok(sample);
  assert.ok('farmFullTicks' in sample && typeof sample.farmFullTicks === 'number' && sample.farmFullTicks > 0);
  assert.ok('poolStart' in sample && 'poolEnd' in sample);
});

test('Given two disconnected food pools When one contains surplus Then it cannot mask the other shortage', () => {
  const base = stressedTown();
  base.tiles = base.tiles.map(t => ({ ...t, hasRoad: t.ty === 3 && (t.tx < 20 || t.tx > 40) }));
  base.buildings = [building('west-granary', 'granary', 1, 1, 2), building('west-mill', 'mill', 5, 2, 2),
    building('west-farm', 'wheat_farm', 8, 4, 4),
    { ...building('east-granary', 'granary', 50, 1, 2), inventory: { wheat: 100, bread: 100 } },
    building('east-mill', 'mill', 44, 2, 2), building('east-farm', 'wheat_farm', 46, 4, 4)];
  const state = advanceFoodFlow({ ...base, roadRevision: base.roadRevision + 1, pathCache: {} });
  const deadline = state.autoplayFoodFlow?.current.untilTick;
  assert.ok(deadline);
  const next = advanceFoodFlow({ ...recordFoodFlow(state, { wheatProduced: 1 }), tick: deadline });
  assert.deepEqual(next.autoplayFoodFlow?.poolIds, []);
  assert.equal(foodRecoveryKind(next, 48), null); // A disconnected, incomplete observation cannot authorize expansion.
});

test('Given stock claims incoming capacity and real cargo When observing the pool Then physical units count once and unusable cargo is excluded from buffers', () => {
  const state = stressedTown();
  state.tiles = state.tiles.map(t => ({ ...t, hasRoad: t.hasRoad || t.ty === 1 || t.tx === 0 }));
  state.buildings = state.buildings.map(b => b.kind === 'granary' ? { ...b,
    inventory: { wheat: 100, bread: 10 }, stockReserved: { wheat: 24, bread: 3 }, reserved: { wheat: 8, bread: 9 } } : b);
  state.walkers = [{ id: 'return', kind: 'carter', mission: 'fetch', phase: 'returning', homeBuildingId: 'mill0',
    destination: { kind: 'building', buildingId: 'granary' },
    reservation: { destination: { kind: 'building', buildingId: 'mill0' }, resource: 'wheat', amount: 8,
      sourceStockClaim: null, homeCapacityClaim: null }, position: { tx: 8, ty: 3 }, path: [{ tx: 8, ty: 3 }],
    pathIndex: 0, previousTile: null, cargo: { resource: 'wheat', amount: 8 }, spawnedTick: 5990, cancellation: null }];
  const opened = advanceFoodFlow(state);
  assert.deepEqual(opened.autoplayFoodFlow?.current.poolStart, { wheat: 108, bread: 40, usableWheat: 84, usableBread: 7 });
  const parked = advanceFoodFlow({ ...state, walkers: state.walkers.map(w => w.kind === 'carter'
    ? { ...w, cancellation: { tick: 6000, reason: 'manual', releasedReservation: true } } : w) });
  assert.deepEqual(parked.autoplayFoodFlow?.current.poolStart, { wheat: 108, bread: 40, usableWheat: 76, usableBread: 7 });
});

test('Given claimed bread covering the apparent deficit When choosing downstream expansion Then reserved stock is not a usable buffer', () => {
  const state = observedFoodTown();
  state.buildings = state.buildings.map(b => b.kind === 'granary' ? { ...b, inventory: { bread: 300 }, stockReserved: { bread: 300 } } : b);
  assert.equal(foodRecoveryKind(state, 21), 'mill');
});

test('Given stock was depleted after the completed opportunity When selecting recovery Then stale buffer does not suppress a mill', () => {
  const state = observedFoodTown();
  state.buildings = state.buildings.map(b => b.kind === 'granary' ? { ...b, inventory: { wheat: 100 } } : b);
  assert.equal(foodRecoveryKind(state, 21), 'mill');
});


test('Given future civic staff already committed When current idle workers look sufficient Then do not spend the same workers twice', () => {
  const base = observedFoodTown(20, 10);
  // Existing demand52, available56, and planned market3 leave only1 for a four-worker farm.
  const state = { ...base, population: 112, idleWorkers: 4, constructionSites: [
    createConstructionSite({ ordinal: 100, kind: 'market', tx: 50, ty: 6, startedTick: base.tick }),
  ] };
  assert.deepEqual(foodAction(state, foodBuildRequest), { kind: 'none' });
});

test('Given an incomplete first chain and no spare labor When bootstrapping Then preserve recruitment-driven first mill construction', () => {
  const base = stressedTown();
  const state = { ...base, idleWorkers: 0, population: 4, houses: base.houses.slice(0, 1),
    buildings: base.buildings.filter(b => b.kind === 'granary' || b.id === 'farm0' || b.id === 'home0') };
  const action = foodAction(state, foodBuildRequest);
  assert.equal(action.kind === 'place_building' ? action.building : action.kind, 'mill');
});

test('Given one connected pool When a remote split leaves each producer a granary Then pool membership changes and old trend expires', () => {
  const base = stressedTown();
  base.buildings = [building('west-granary', 'granary', 1, 1, 2), building('west-mill', 'mill', 5, 2, 2),
    building('west-farm', 'wheat_farm', 8, 4, 4), building('east-granary', 'granary', 50, 1, 2),
    building('east-mill', 'mill', 44, 2, 2), building('east-farm', 'wheat_farm', 46, 4, 4)];
  const opened = advanceFoodFlow(base);
  const deadline = opened.autoplayFoodFlow?.current.untilTick;
  assert.ok(deadline);
  const closed = advanceFoodFlow({ ...opened, tick: deadline });
  assert.ok(measuredFoodFlow(closed)?.poolEnd);
  const split = { ...closed, roadRevision: closed.roadRevision + 1, pathCache: {},
    tiles: closed.tiles.map(t => t.tx === 32 ? { ...t, hasRoad: false } : t) };
  assert.equal(measuredFoodFlow(split), undefined);
  const next = advanceFoodFlow(split);
  assert.deepEqual(next.autoplayFoodFlow?.poolIds, []);
  assert.equal(next.autoplayFoodFlow?.completed, undefined);
});

test('Given a stocked pool and real produced events When the exact opportunity closes Then endpoints bracket the same events', () => {
  const base = stressedTown();
  base.tiles = base.tiles.map(t => ({ ...t, hasRoad: t.hasRoad || t.ty === 1 || t.tx === 0 }));
  base.buildings = base.buildings.map(b => b.kind === 'granary' ? { ...b, inventory: { wheat: 100, bread: 10 } } : b);
  const opened = advanceFoodFlow(base);
  const deadline = opened.autoplayFoodFlow?.current.untilTick;
  assert.ok(deadline);
  const moved = recordFoodFlow({ ...opened, tick: deadline, buildings: opened.buildings.map(b => b.kind === 'granary'
    ? { ...b, inventory: { wheat: 98, bread: 11 } } : b) }, { breadProduced: 1 });
  const closed = advanceFoodFlow(moved);
  assert.equal(measuredFoodFlow(closed)?.poolStart?.wheat, 100);
  assert.equal(measuredFoodFlow(closed)?.poolEnd?.wheat, 98);
  assert.equal(measuredFoodFlow(closed)?.breadProduced, 1);
  assert.equal(closed.autoplayFoodFlow?.current.poolStart?.wheat, 98);
  assert.equal(closed.autoplayFoodFlow?.current.breadProduced, 0);
});

test('Given grain backpressure and positive bread reserve When physical bread is depleting Then legacy depletion alone cannot authorize construction', () => {
  const state = backlog(136, 136, 75);
  const flow = state.autoplayFoodFlow;
  const sample = { ...flow.completed, poolStart: { ...flow.completed.poolStart, bread: 90 } };
  assert.equal(foodRecoveryKind({ ...state, autoplayFoodFlow: { ...flow, completed: sample } }, 21), null);
});

test('Given sufficient raw flow and a nondepleting bread buffer When observed output has a fractional shortfall Then avoid an unnecessary mill', () => {
  assert.equal(foodRecoveryKind(backlog(136, 138, 75, 140, 67), 21), null);
});

test('Given bread moves from a granary into a connected home When a window closes Then delivery is not physical bread depletion or shared usable stock', () => {
  const base = stressedTown();
  base.tiles = base.tiles.map(t => ({ ...t, hasRoad: t.hasRoad || t.ty === 1 || t.tx === 0 }));
  base.buildings = base.buildings.map(b => b.kind === 'granary' ? { ...b, inventory: { bread: 10 } } : b);
  const opened = advanceFoodFlow(base);
  const deadline = opened.autoplayFoodFlow?.current.untilTick;
  assert.ok(deadline);
  const closed = advanceFoodFlow({ ...opened, tick: deadline,
    buildings: opened.buildings.map(b => b.kind === 'granary' ? { ...b, inventory: { bread: 8 } } : b),
    houses: opened.houses.map((h, n) => n === 0 ? { ...h, breadStock: h.breadStock + 2 } : h) });
  assert.equal(measuredFoodFlow(closed)?.poolStart?.bread, 40);
  assert.equal(measuredFoodFlow(closed)?.poolEnd?.bread, 40);
  assert.equal(measuredFoodFlow(closed)?.poolEnd?.usableBread, 8);
});

test('Given seed3 brief raw rebound and five percent blocked farms When even removing storage blockage cannot supply demand Then theoretical work cannot authorize a farm', () => {
  const state = backlog(283, 294, 236, 1400, 574);
  const flow = state.autoplayFoodFlow;
  const sample = { ...flow.completed, startedTick: state.tick - 3268, wheatExported: 241,
    farmFullTicks: 2867, farmReadyTicks: 58824, farmOpeningProgress: 301,
    poolStart: { ...flow.completed.poolStart, bread: 383 }, poolEnd: { ...flow.completed.poolEnd, bread: 322 } };
  // Even pooled partial progress yields at most1478 wheat, net1237 <1241.84 needed.
  assert.equal(foodRecoveryKind({ ...state, autoplayFoodFlow: { ...flow, completed: sample } }, 76), null);
});


test('Given staggered partial batches When pooling ready-work upper bounds Then it overestimates rather than credits impossible production', () => {
  const state = backlog(136, 136, 0);
  const sample = { ...state.autoplayFoodFlow.completed, farmOpeningProgress: 39 + 1, farmReadyTicks: 0 };
  assert.equal(Math.floor(39 / 40) + Math.floor(1 / 40), 0);
  assert.equal(unblockedWheatUpperBound(sample), 1);
  assert.equal(sample.wheatProduced, 134);
});

test('Given legacy backpressure metadata without ready-work observation When raw output is deficient Then missing rolling evidence cannot authorize expansion', () => {
  const state = backlog(136, 136, 75);
  const flow = state.autoplayFoodFlow;
  const { farmReadyTicks: _ready, farmOpeningProgress: _progress, ...sample } = flow.completed;
  assert.equal(foodRecoveryKind({ ...state, autoplayFoodFlow: { ...flow, completed: sample } }, 21), null);
});

test('Given no workers after actual allocation When the normal substep runs Then no potential ready work is counted', () => {
  const next = advanceTick({ ...stressedTown(), population: 0 });
  assert.equal(next.autoplayFoodFlow?.current.farmReadyTicks, 0);
  assert.equal(next.autoplayFoodFlow?.current.farmFullTicks, 0);
  assert.equal(next.autoplayFoodFlow?.current.qualified, false);
});
