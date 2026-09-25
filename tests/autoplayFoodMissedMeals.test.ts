import assert from 'node:assert/strict';
import test from 'node:test';
import { measuredFoodDecision } from '../src/engine/autoplayFoodMeasuredDecision';
import { replayFoodObservation } from './foodEfficiencyObservationFixture';
import { routedStockTown } from './helpers/autoplayFoodFixtures';
import type { GameState } from '../src/engine/engine.types';

// AF-13: the grain slot is a farmstead judged by its expected harvest, not the wheat_farm's measured flow, so a
// "sufficient grain" scenario now needs an actual arable zone behind the farmstead; without one the expected
// harvest is zero and every scenario is grain-short before the mill/bread checks ever run.
function withFarmstead(state: GameState): GameState {
  return { ...state, buildings: state.buildings.map(b => b.kind === 'wheat_farm' ? { ...b, kind: 'farmstead' } : b) };
}
function withAmpleArable(state: GameState): GameState {
  const membership: number[] = [];
  for (let ty = 3; ty <= 4; ty += 1) for (let tx = 0; tx <= 15; tx += 1) membership.push(ty * state.width + tx);
  return { ...state, zones: [{ id: 'zone-arable-test', kind: 'arable', strokes: [], membership, createdOrdinal: 1 }],
    nextZoneOrdinal: 2 };
}

function stockedTown(fed: boolean, ample = false) {
  let state = withFarmstead(routedStockTown(true));
  if (ample) state = withAmpleArable(state);
  return { ...state, houses: state.houses.map(h => ({ ...h, breadStock: fed ? 8 : 0 })),
    buildings: state.buildings.map(b => b.kind === 'granary' ? { ...b, inventory: { wheat: 100, bread: 60 } }
      : b.kind === 'mill' ? { ...b, inventory: { wheat: 8, bread: 18 } } : b.kind === 'farmstead' ? { ...b, inventory: {} } : b) };
}

test('missed actual meals and negative raw flow cannot be offset by unused global reserves', () => {
  const state = replayFoodObservation(stockedTown(false), { wheat: 120, bread: 70, exports: 0 });
  assert.deepEqual(measuredFoodDecision(state), { kind: 'farmstead', reason: 'actual_wheat_deficit' });
});

test('fed reserves do not conceal a measured bread production deficit', () => {
  const state = replayFoodObservation(stockedTown(true, true), { wheat: 170, bread: 70, exports: 0 });
  assert.deepEqual(measuredFoodDecision(state), { kind: 'mill', reason: 'actual_bread_deficit' });
});

test('missed meals with adequate actual raw output and starved mills diagnose transport rather than more fields', () => {
  const state = replayFoodObservation(stockedTown(false, true), { wheat: 1000, bread: 70, exports: 0 }, 1200);
  assert.deepEqual(measuredFoodDecision(state), { kind: null, reason: 'wheat_transport_blocked' });
});

test('output-blocked farms with recently starved mills route a measured raw deficit to transport instead of another field', () => {
  const base = stockedTown(false, true);
  // AF-13: the farmstead's barn holds 1000 (not the old wheat_farm's 20), so "output-blocked" now means full at 1000.
  const state = replayFoodObservation({ ...base, buildings: base.buildings.map(b => b.kind === 'farmstead'
    ? { ...b, inventory: { wheat: 1000 } } : b) }, { wheat: 120, bread: 70, exports: 0 }, 1);
  assert.deepEqual(measuredFoodDecision(state), { kind: null, reason: 'wheat_transport_blocked' });
});

test('full farms with reachable raw reserves and continuously supplied working mills expose a measured downstream capacity deficit',()=>{
  const base=stockedTown(false, true);
  const state=replayFoodObservation({...base,buildings:base.buildings.map(b=>b.kind==='farmstead'?{...b,inventory:{wheat:20}}:b.kind==='mill'?{...b,inventory:{wheat:12}}:b)}, {wheat:120,bread:70,exports:0});
  assert.deepEqual(measuredFoodDecision(state),{kind:'mill',reason:'actual_bread_deficit'});
});

test('full farms with even recent raw starvation retain transport diagnosis instead of downstream expansion',()=>{
  const base=stockedTown(false, true);
  // AF-13: full is the farmstead's 1000-capacity barn, not the old wheat_farm's 20.
  const state=replayFoodObservation({...base,buildings:base.buildings.map(b=>b.kind==='farmstead'?{...b,inventory:{wheat:1000}}:b.kind==='mill'?{...b,inventory:{wheat:12}}:b)}, {wheat:120,bread:70,exports:0},1);
  assert.deepEqual(measuredFoodDecision(state),{kind:null,reason:'wheat_transport_blocked'});
});

test('current mill input exhaustion still blocks capacity expansion despite an earlier unstarved window',()=>{
  const base=stockedTown(false, true);
  const observed=replayFoodObservation({...base,buildings:base.buildings.map(b=>b.kind==='farmstead'?{...b,inventory:{wheat:20}}:b.kind==='mill'?{...b,inventory:{wheat:12}}:b)}, {wheat:120,bread:70,exports:0});
  const state={...observed,buildings:observed.buildings.map(b=>b.kind==='mill'?{...b,inventory:{wheat:0}}:b)};
  assert.deepEqual(measuredFoodDecision(state),{kind:null,reason:'wheat_transport_blocked'});
});
