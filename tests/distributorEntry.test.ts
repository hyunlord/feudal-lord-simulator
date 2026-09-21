import assert from 'node:assert/strict';
import { createMulberry32 } from '../src/engine/prng';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import type { GameState } from '../src/engine/engine.types';
import { createSimulationRoutePorts } from '../src/engine/simulationPorts';
import { recurringDeliveryRoutes } from '../src/engine/autoplayRecurringDeliveryRoutes';
import { houseBreadCapacity } from '../src/content/houseFoodConfig';
const state = (): GameState => JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/distributor-entry-seed5.json.gz', import.meta.url))).toString());
const granary = 'granary-42-37-0';
test('natural seed5 selects legal near exit instead of 97-edge detour', () => {
  assert.deepEqual(createSimulationRoutePorts(state()).roaming.homePath(granary), [{tx:43,ty:8}]);
});
test('dispatch switches back to the uniquely served homes and all-full fallback', () => {
  const s = state();
  const stocked = {...s, houses:s.houses.map(h=>({...h,breadStock:houseBreadCapacity(h)}))};
  assert.deepEqual(createSimulationRoutePorts(stocked).roaming.homePath(granary), [{tx:42,ty:5}]);
  for (const id of ['construction-site-000056','construction-site-000057','construction-site-000058']) {
    const urgent={...stocked,houses:stocked.houses.map(h=>h.buildingId===id?{...h,breadStock:0}:h)};
    assert.deepEqual(createSimulationRoutePorts(urgent).roaming.homePath(granary), [{tx:42,ty:5}]);
  }
});
test('stable feasible observer providers include near exit and do not track stocks',()=>{
 const s=state(), before=recurringDeliveryRoutes(s);
 const home=before.homes.find(h=>h.buildingId==='construction-site-000009');
 assert.equal(home?.providers.find(p=>p.id===granary)?.edges,0);
 const after=recurringDeliveryRoutes({...s,houses:s.houses.map(h=>({...h,breadStock:houseBreadCapacity(h)}))});
 assert.deepEqual(after,before);
 assert.ok(before.homes.every(h=>new Set(h.providers.map(p=>p.id)).size===h.providers.length));
});

test('D9 cached identity/deadline and failed attempt survive demand switching but invalidate real topology', async()=>{
 const {recordRecurringDelivery}=await import('../src/engine/autoplayRecurringDelivery');
 let s=state();s=recordRecurringDelivery(s,{servedHouses:s.houses,deliveryEvents:[]});
 assert.ok(s.autoplayRecurringDelivery);
 const before=s.autoplayRecurringDelivery;
 const marked={...s,autoplayRecurringDelivery:{...before,homes:before.homes.map(h=>({...h,deficientSince:s.tick-100,attemptedSiteId:'old-attempt'}))}};
 const after=recordRecurringDelivery({...marked,tick:s.tick+1,houses:s.houses.map(h=>({...h,breadStock:houseBreadCapacity(h)}))},{servedHouses:s.houses,deliveryEvents:[]});
 assert.equal(after.autoplayRecurringDelivery?.routes,before.routes);
 for(const h of after.autoplayRecurringDelivery?.homes??[]){
   assert.equal(h.window.untilTick,before.homes.find(p=>p.buildingId===h.buildingId)?.window.untilTick);
   assert.equal(h.attemptedSiteId,'old-attempt');
 }
 const changed=recurringDeliveryRoutes({...after,roadRevision:after.roadRevision+1});
 assert.notEqual(changed,before.routes);
 const unstaffed=recurringDeliveryRoutes({...after,buildings:after.buildings.map(b=>b.id===granary?{...b,workers:0}:b)});
 assert.notDeepEqual(unstaffed,before.routes);
 const legacy={...before.routes,layout:before.routes.layout.replace('eligible-exits-v1|','')};
 assert.notEqual(recurringDeliveryRoutes({...after,autoplayRecurringDelivery:{...before,routes:legacy}}),legacy);
});
test('D5 target deadline takes stable maximum of per-target minimum routes',async()=>{
 const {foodObservationTicks}=await import('../src/engine/autoplayFoodThroughput');
 const {feasibleDistributorDistance}=await import('../src/engine/distributorAccess');
 const {BALANCE}=await import('../src/content/balanceConfig');
 const s=state(),g=s.buildings.find(b=>b.id===granary);assert.ok(g);
 const targets=['construction-site-000009','construction-site-000056'];
 const ds=targets.map(id=>feasibleDistributorDistance(s,g,id));assert.ok(ds.every(d=>d!==null));
 const expected=BALANCE.DISTRIBUTOR_INTERVAL+(2*BALANCE.DISTRIBUTOR_RANGE+Math.max(...ds.map(d=>d??0)))*Math.ceil(1/BALANCE.DISTRIBUTOR_SPEED);
 assert.equal(foodObservationTicks(s,g,targets),expected);
 assert.equal(foodObservationTicks({...s,houses:s.houses.map(h=>({...h,breadStock:houseBreadCapacity(h)}))},g,targets),expected);
});
test('missing/no-access granary and non-granary behavior preserve fallback; road removal drops chosen exit',async()=>{
 const {eligibleRoamingExits}=await import('../src/engine/distributorAccess');
 const s=state(),g=s.buildings.find(b=>b.id===granary);assert.ok(g);
 assert.equal(createSimulationRoutePorts(s).roaming.homePath('missing'),null);
 const removed={...s,roadRevision:s.roadRevision+1,tiles:s.tiles.map(t=>t.tx===43&&t.ty===8?{...t,hasRoad:false}:t),pathCache:{}};
 assert.ok(!eligibleRoamingExits(removed,g).some(t=>t.tx===43&&t.ty===8));
 const none={...s,tiles:s.tiles.map(t=>({...t,hasRoad:false})),roadRevision:s.roadRevision+1,pathCache:{}};
 assert.equal(createSimulationRoutePorts(none).roaming.homePath(granary),null);
 const other={...g,kind:'storehouse' as const};const non={...s,buildings:s.buildings.map(b=>b.id===g.id?other:b)};
 assert.deepEqual(createSimulationRoutePorts(non).roaming.homePath(granary),[{tx:42,ty:5}]);
});
test('zero-edge spawn really services vacant home once and conserves loaded bread',async()=>{
 const {spawnDistributors,stepDistributors}=await import('../src/agents/roaming');
 const {buildingFootprint}=await import('../src/geometry/buildingFootprint');
 const s=state(),g=s.buildings.find(b=>b.id===granary);assert.ok(g);
 const routes=createSimulationRoutePorts(s).roaming;
 const spawned=spawnDistributors({tick:s.tick,buildings:[g],walkers:[],routes});
 assert.equal(spawned.walkers.length,1);
 assert.deepEqual(spawned.walkers[0]?.position,{tx:43,ty:8});
 const houses=s.houses.flatMap(h=>{const b=s.buildings.find(b=>b.id===h.buildingId);return b?[{...h,tx:b.tx,ty:b.ty,...buildingFootprint(b)}]:[];});
 const serviced=stepDistributors({...spawned,tick:s.tick,houses,routes,rngForJunction:()=>createMulberry32(1)});
 const events=serviced.deliveryEvents.filter(e=>e.houseBuildingId==='construction-site-000009');
 assert.equal(events.length,1);assert.equal(events[0]?.amount,1);
 const total=(buildings:typeof spawned.buildings,walkers:typeof spawned.walkers,homes:readonly {readonly breadStock:number}[])=>buildings.reduce((n,b)=>n+(b.inventory.bread??0),0)+walkers.reduce((n,w)=>n+(w.cargo?.resource==='bread'?w.cargo.amount:0),0)+homes.reduce((n,h)=>n+h.breadStock,0);
 assert.equal(total(spawned.buildings,spawned.walkers,houses),total(serviced.buildings,serviced.walkers,serviced.houses));
 assert.ok(routes.returnPath({tx:43,ty:8},granary));
});
