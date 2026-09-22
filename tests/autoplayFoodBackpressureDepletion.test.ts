import assert from 'node:assert/strict';
import test from 'node:test';
import { foodRecoveryKind } from '../src/engine/autoplayFoodThroughput';
import { advanceFoodFlow, measuredFoodFlow, recordFoodFlow } from '../src/engine/autoplayFoodFlow';
import type { FoodFlowWindow } from '../src/engine/autoplayFoodFlow';
import type { GameState } from '../src/engine/engine.types';
import { building, stressedTown } from './helpers/autoplayFoodFixtures';

type PhaseSample = FoodFlowWindow & { readonly farmCount?: number; readonly farmTicksPerOutput?: number };

function depleted(sampleOverrides: Partial<PhaseSample> = {}, farmCount = 35): GameState {
  const base = stressedTown();
  const width = 200;
  const state = { ...base, width,
    tiles: Array.from({ length: width * 8 }, (_, n) => ({ tx: n % width, ty: Math.floor(n / width),
      terrain: 'grass' as const, hasRoad: [1, 3].includes(Math.floor(n / width)) || n % width === 0, buildingId: null })),
    buildings: [...base.buildings.filter(b => b.kind !== 'wheat_farm').map(b => b.kind === 'granary'
      ? { ...b, inventory: { wheat: 1143, bread: 172 } } : b),
    ...Array.from({ length: farmCount }, (_, n) => building(`farm${n}`, 'wheat_farm', 4 + n * 5, 4, 4))],
  };
  const opened = advanceFoodFlow(state);
  const flow = opened.autoplayFoodFlow;
  assert.ok(flow);
  const sample: PhaseSample = { startedTick: state.tick - 3240, untilTick: state.tick, qualified: true,
    wheatProduced: 1071, breadProduced: 478, wheatExported: 140, breadExported: 0,
    farmFullTicks: 70632, farmReadyTicks: 113400, farmOpeningProgress: 287, farmCount, farmTicksPerOutput: 40,
    poolStart: { wheat: 1200, bread: 283, usableWheat: 1200, usableBread: 170 },
    poolEnd: { wheat: 1175, bread: 300, usableWheat: 1143, usableBread: 172 }, ...sampleOverrides };
  return { ...opened, autoplayFoodFlow: { ...flow, completed: sample } };
}

function changeSample(state: GameState, update: (sample: PhaseSample) => PhaseSample): GameState {
  const flow = state.autoplayFoodFlow;
  assert.ok(flow?.completed);
  return { ...state, autoplayFoodFlow: { ...flow, completed: update(flow.completed) } };
}

test('Given exact seed3 depleted raw window When blocked work and usable buffers cover demand Then wait instead of adding a farm', () => {
  const state = depleted();
  assert.equal(foodRecoveryKind(state, 70), null);
});

test('Given the same depleted raw evidence without a bread buffer When selecting downstream recovery Then legacy aggregate evidence alone cannot authorize a mill', () => {
  const state = depleted({ poolEnd: { wheat: 1175, bread: 280, usableWheat: 1143, usableBread: 0 } });
  assert.equal(foodRecoveryKind(state, 70), null);
});

test('Given original insufficient seed3 work When even the upper bound nets1237 below1241.84 Then legacy upper bounds alone cannot authorize a farm', () => {
  const state = depleted({ startedTick: 6000 - 3268, wheatProduced: 1400, breadProduced: 574, wheatExported: 241,
    farmFullTicks: 2867, farmReadyTicks: 58824, farmOpeningProgress: 301 }, 18);
  assert.equal(foodRecoveryKind(state, 76), null);
});

test('Given two staggered fractional farm phases When pooled work falsely permits one output Then fractional legacy work cannot authorize a farm', () => {
  const state = depleted({ startedTick: 5999, wheatProduced: 0, wheatExported: 0, breadProduced: 0,
    farmOpeningProgress: 38, farmReadyTicks: 2, farmFullTicks: 1 }, 2);
  // floor((19+1)/40)+floor((19+1)/40)=0, while floor(40/40)=1.
  assert.equal(foodRecoveryKind(state, 200), null);
});

for (const [name, patch] of [
  ['no actual full ticks', { farmFullTicks: 0 }],
  ['unqualified sample', { qualified: false }],
  ['fractional count', { farmCount: 2.5 }],
  ['changed count', { farmCount: 34 }],
  ['zero count', { farmCount: 0 }],
  ['wrong recipe', { farmTicksPerOutput: 41 }],
  ['negative opening phase', { farmOpeningProgress: -1 }],
  ['nonfinite opening phase', { farmOpeningProgress: Number.NaN }],
  ['impossible aggregate opening phase', { farmOpeningProgress: 1400 }],
  ['negative ready work', { farmReadyTicks: -1 }],
  ['nonfinite ready work', { farmReadyTicks: Number.POSITIVE_INFINITY }],
  ['excess ready work', { farmReadyTicks: 113401 }],
  ['full ticks exceed ready work', { farmFullTicks: 113401 }],
  ['negative exports', { wheatExported: -1 }],
] satisfies readonly (readonly [string, Partial<PhaseSample>])[]) {
  test(`Given ${name} When a depleted pool requests an exception Then legacy evidence cannot authorize expansion`, () => {
    const state = depleted(patch);
    assert.notEqual(foodRecoveryKind(state, 70), 'mill');
    assert.equal(foodRecoveryKind(state, 70), null);
  });
}

for (const key of ['farmCount', 'farmTicksPerOutput', 'farmOpeningProgress', 'farmReadyTicks', 'qualified'] as const) {
  test(`Given legacy missing ${key} When raw stock falls Then legacy evidence cannot authorize expansion`, () => {
    const state = changeSample(depleted(), sample => { const next = { ...sample }; delete next[key]; return next; });
    assert.equal(foodRecoveryKind(state, 70), null);
  });
}

for (const [where, amount, expected] of [['end', 202, null], ['current', 202, null],
  ['end', 203, null], ['current', 203, null]] as const) {
  test(`Given ${where} usable raw ${amount} When only legacy aggregate evidence exists Then recovery is ${expected}`, () => {
    let state = depleted();
    if (where === 'end') state = changeSample(state, s => ({ ...s,
      poolEnd: { wheat: 1175, bread: 300, usableWheat: amount, usableBread: 172 } }));
    else state = { ...state, buildings: state.buildings.map(b => b.kind === 'granary'
      ? { ...b, stockReserved: { wheat: 1143 - amount } } : b) };
    assert.equal(foodRecoveryKind(state, 70), expected);
  });
}

test('Given qualified metadata When the sample is stale or the clock rewinds Then it cannot change recovery', () => {
  const state = depleted();
  assert.equal(measuredFoodFlow({ ...state, tick: 9240 }), undefined);
  assert.equal(measuredFoodFlow({ ...state, tick: 5999 }), undefined);
});

test('Given qualified metadata When a farm is removed Then membership invalidates the observation', () => {
  const state = depleted();
  assert.equal(measuredFoodFlow({ ...state, buildings: state.buildings.filter(b => b.id !== 'farm0') }), undefined);
});

test('Given qualified metadata When the supply road splits Then route qualification expires', () => {
  const state = depleted();
  const split = { ...state, roadRevision: state.roadRevision + 1, pathCache: {},
    tiles: state.tiles.map(t => t.tx === 100 ? { ...t, hasRoad: false } : t) };
  assert.equal(measuredFoodFlow(split), undefined);
  assert.equal(advanceFoodFlow(split).autoplayFoodFlow?.completed, undefined);
});

test('Given an invalid individual opening phase hidden by another farm When a new window opens Then no phase certificate is recorded', () => {
  const { autoplayFoodFlow: _flow, ...base } = depleted({}, 2);
  const opened = advanceFoodFlow({ ...base,
    buildings: base.buildings.map(b => b.id === 'farm0' ? { ...b, productionProgress: 40 } : b) });
  assert.equal(opened.autoplayFoodFlow?.current.farmCount, undefined);
});

test('Given valid opening farms When a fresh window records work Then stable phase metadata accompanies observed counters', () => {
  const { autoplayFoodFlow: _flow, ...base } = depleted();
  const opened = advanceFoodFlow(base);
  const next = recordFoodFlow(opened, { farmReadyTicks: 35, farmFullTicks: 1 });
  assert.equal(next.autoplayFoodFlow?.current.farmCount, 35);
  assert.equal(next.autoplayFoodFlow?.current.farmTicksPerOutput, 40);
  assert.equal(next.autoplayFoodFlow?.current.wheatProduced, 0);
});

for (const cancelled of [false, true]) {
  test(`Given a raw deficit covered only by one cargo unit When cancellation is ${cancelled} Then count only usable cargo`, () => {
    const base = depleted();
    const state: GameState = { ...base, buildings: base.buildings.map(b => b.kind === 'granary'
      ? { ...b, stockReserved: { wheat: 941 }, reserved: { wheat: 1000 } } : b), walkers: [
      { id: 'raw-return', kind: 'carter', mission: 'fetch', phase: 'returning', homeBuildingId: 'mill0',
        destination: { kind: 'building', buildingId: 'granary' },
        reservation: { destination: { kind: 'building', buildingId: 'mill0' }, resource: 'wheat', amount: 1,
          sourceStockClaim: null, homeCapacityClaim: null }, position: { tx: 8, ty: 3 }, path: [{ tx: 8, ty: 3 }],
        pathIndex: 0, previousTile: null, cargo: { resource: 'wheat', amount: 1 }, spawnedTick: 5990,
        cancellation: cancelled ? { tick: 6000, reason: 'manual', releasedReservation: true } : null },
    ] };
    const { autoplayFoodFlow: _oldFlow, ...unobserved } = state;
    const opened = advanceFoodFlow(unobserved);
    assert.equal(opened.autoplayFoodFlow?.current.poolStart?.usableWheat, cancelled ? 202 : 203);
    assert.equal(foodRecoveryKind(state, 70), null);
  });
}
