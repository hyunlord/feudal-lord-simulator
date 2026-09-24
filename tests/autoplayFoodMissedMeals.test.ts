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

test('fed reserves do not conceal a measured bread production deficit', () => {
  const state = replayFoodObservation(stockedTown(true), { wheat: 170, bread: 70, exports: 0 });
  assert.deepEqual(measuredFoodDecision(state), { kind: 'mill', reason: 'actual_bread_deficit' });
});

test('missed meals with adequate actual raw output and starved mills diagnose transport rather than more fields', () => {
  const state = replayFoodObservation(stockedTown(false), { wheat: 1000, bread: 70, exports: 0 }, 1200);
  assert.deepEqual(measuredFoodDecision(state), { kind: null, reason: 'wheat_transport_blocked' });
});

test('output-blocked farms with recently starved mills route a measured raw deficit to transport instead of another field', () => {
  const base = stockedTown(false);
  const state = replayFoodObservation({ ...base, buildings: base.buildings.map(b => b.kind === 'wheat_farm'
    ? { ...b, inventory: { wheat: 20 } } : b) }, { wheat: 120, bread: 70, exports: 0 }, 1);
  assert.deepEqual(measuredFoodDecision(state), { kind: null, reason: 'wheat_transport_blocked' });
});

test('full farms with reachable raw reserves and continuously supplied working mills expose a measured downstream capacity deficit',()=>{
  const base=stockedTown(false);
  const state=replayFoodObservation({...base,buildings:base.buildings.map(b=>b.kind==='wheat_farm'?{...b,inventory:{wheat:20}}:b.kind==='mill'?{...b,inventory:{wheat:12}}:b)}, {wheat:120,bread:70,exports:0});
  assert.deepEqual(measuredFoodDecision(state),{kind:'mill',reason:'actual_bread_deficit'});
});

test('full farms with even recent raw starvation retain transport diagnosis instead of downstream expansion',()=>{
  const base=stockedTown(false);
  const state=replayFoodObservation({...base,buildings:base.buildings.map(b=>b.kind==='wheat_farm'?{...b,inventory:{wheat:20}}:b.kind==='mill'?{...b,inventory:{wheat:12}}:b)}, {wheat:120,bread:70,exports:0},1);
  assert.deepEqual(measuredFoodDecision(state),{kind:null,reason:'wheat_transport_blocked'});
});

test('a common reachable raw reserve too small for the measured shortfall cannot authorize a mill',()=>{
  const base=stockedTown(false);
  const state=replayFoodObservation({...base,buildings:base.buildings.map(b=>b.kind==='wheat_farm'?{...b,inventory:{wheat:20}}:b.kind==='mill'?{...b,inventory:{wheat:12}}:b.kind==='granary'?{...b,inventory:{wheat:1}}:b)}, {wheat:120,bread:70,exports:0});
  assert.deepEqual(measuredFoodDecision(state),{kind:null,reason:'wheat_transport_blocked'});
});

test('current mill input exhaustion still blocks capacity expansion despite an earlier unstarved window',()=>{
  const base=stockedTown(false);
  const observed=replayFoodObservation({...base,buildings:base.buildings.map(b=>b.kind==='wheat_farm'?{...b,inventory:{wheat:20}}:b.kind==='mill'?{...b,inventory:{wheat:12}}:b)}, {wheat:120,bread:70,exports:0});
  const state={...observed,buildings:observed.buildings.map(b=>b.kind==='mill'?{...b,inventory:{wheat:0}}:b)};
  assert.deepEqual(measuredFoodDecision(state),{kind:null,reason:'wheat_transport_blocked'});
});
