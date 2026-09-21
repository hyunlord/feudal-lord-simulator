import assert from 'node:assert/strict';
import test from 'node:test';
import {bestHouseDemand,nextHouseDemandTile} from '../src/agents/roamingDemand';
import type {RoamingHouse,RoamingRoutePort} from '../src/agents/roamingTypes';
const home=(buildingId:string,breadStock=0,residents=8,lastServicedTick=0):RoamingHouse=>({buildingId,tx:0,ty:1,residents,breadStock,lastServicedTick});
const routes:RoamingRoutePort={homePath:()=>[{tx:0,ty:0}],returnPath:()=>[{tx:0,ty:0}],neighbors:()=>[],isRoad:()=>true,servicePath:(start,h)=>h.buildingId==='blocked'?null:Array.from({length:h.tx+1},(_,i)=>({tx:start.tx+i,ty:start.ty}))};
test('entry accepts zero-edge vacant demand while movement excludes already serviced tile',()=>{
 const adjacent=home('vacant',0,0),further={...home('further'),tx:1};
 assert.equal(bestHouseDemand({tx:0,ty:0},[adjacent,further],routes,40,0)?.house.buildingId,'vacant');
 assert.deepEqual(nextHouseDemandTile({tx:0,ty:0},[adjacent,further],routes,40),{tx:1,ty:0});
});
test('shared priority preserves ration meals, distance, age, ID and capacity/range/path exclusions',()=>{
 const start={tx:0,ty:0};
 const pick=(houses:readonly RoamingHouse[])=>bestHouseDemand(start,houses,routes,40,0)?.house.buildingId;
 assert.equal(pick([{...home('a',2,8),tx:1},{...home('b',3,24),tx:4}]),'b');
 assert.equal(pick([{...home('a'),tx:2},{...home('b'),tx:1}]),'b');
 assert.equal(pick([{...home('a',0,8,4),tx:1},{...home('b',0,8,2),tx:1}]),'b');
 assert.equal(pick([{...home('b'),tx:1},{...home('a'),tx:1}]),'a');
 assert.equal(pick([{...home('full',3),tx:0},{...home('far'),tx:41},home('blocked')]),undefined);
 const merged={...home('merged'),width:2,height:1,tx:1};assert.equal(pick([merged]),'merged');
});
