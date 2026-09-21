import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnCarters } from '../src/agents/delivery';
import { fetchCandidate } from '../src/agents/deliveryBuildingCandidates';
import { BUILDING_CONFIG_BY_KIND, type Building } from '../src/content/buildingConfig';
import type { DeliveryRoutePort } from '../src/agents/deliveryTypes';
import { createDeliveryInventoryPort } from '../src/engine/simulationPorts';
const inventory=createDeliveryInventoryPort();
function building(id:string,kind:Building['kind'],wheat:number):Building{
 return{id,kind,tx:0,ty:0,workers:2,inventory:{wheat},reserved:{},stockReserved:{},productionProgress:0};
}
const near=building('near','granary',1),far=building('far','granary',97);
const routes:DeliveryRoutePort={betweenBuildings:(_,id)=>Array.from({length:id==='near'?30:46},(_,tx)=>({tx,ty:0})),fromBuildingToDestination:()=>null,fromTileToBuilding:()=>null,fromTileToDestination:()=>null,isRoad:()=>true};
test('prefers a feasible first production batch when nearer partial input cannot start production',()=>{
 // Given the portable1024834 witness: mill0, nearby1 at29edges, farther97 at45edges.
 const home=building('mill','mill',0),before=structuredClone([home,near,far]);
 // When choosing one normal fetch load.
 const result=fetchCandidate(home,'wheat',[home,near,far],inventory,routes);
 // Then fetch a normal load from the supply sufficient for the existing recipe.
 assert.equal(result?.building.id,'far');assert.equal(result.amount,8);
 assert.deepEqual([home,near,far],before);
});
test('keeps legitimate current1 plus nearest1 production completion',()=>{
 const home=building('mill','mill',1);
 const result=fetchCandidate(home,'wheat',[home,near,far],inventory,routes);
 assert.equal(result?.building.id,'near');assert.equal(result.amount,1);
});
test('keeps immediate nearest partial fallback when no full-recipe load exists',()=>{
 const home=building('mill','mill',0),partialFar={...far,inventory:{wheat:1}};
 assert.equal(fetchCandidate(home,'wheat',[home,near,partialFar],inventory,routes)?.building.id,'near');
});
test('does not count reserved inbound capacity as present input',()=>{
 const home={...building('mill','mill',0),reserved:{wheat:1}};
 assert.equal(fetchCandidate(home,'wheat',[home,near,far],inventory,routes)?.building.id,'far');
});
test('keeps partial fallback when home capacity prevents a sufficient load',()=>{
 const home={...building('mill','mill',0),inventory:{bread:BUILDING_CONFIG_BY_KIND.mill.storageCapacity-1}};
 assert.equal(inventory.availableSpace(home),1);
 assert.equal(fetchCandidate(home,'wheat',[home,near,far],inventory,routes)?.building.id,'near');
});
test('ignores unavailable claimed stock and unreachable sufficient suppliers',()=>{
 const home=building('mill','mill',0),claimed={...far,stockReserved:{wheat:97}};
 assert.equal(fetchCandidate(home,'wheat',[home,near,claimed],inventory,routes)?.building.id,'near');
 assert.equal(fetchCandidate(home,'wheat',[home,near,far],inventory,{...routes,betweenBuildings:(a,id)=>id==='far'?null:routes.betweenBuildings(a,id)})?.building.id,'near');
});
test('preserves nonproduction and mismatched-resource callers',()=>{
 const home=building('store','storehouse',0);
 assert.equal(fetchCandidate(home,'wheat',[home,near,far],inventory,routes)?.building.id,'near');
 const mill=building('mill','sawmill',0);
 assert.equal(fetchCandidate(mill,'wheat',[mill,near,far],inventory,routes)?.building.id,'near');
});
test('retains distance and ID ties among equally sufficient suppliers',()=>{
 const home=building('mill','mill',1),a={...near,id:'a'},b={...near,id:'b'},equal={...routes,betweenBuildings:()=>[{tx:0,ty:0},{tx:1,ty:0}]};
 for(const suppliers of [[b,a],[a,b]])assert.equal(fetchCandidate(home,'wheat',[home,...suppliers],inventory,equal)?.building.id,'a');
});
test('retains existing ordering for nonstandard claimed converter input',()=>{
 const home={...building('mill','mill',1),stockReserved:{wheat:1}};
 assert.equal(inventory.availableStock(home,'wheat'),0);
 assert.equal(fetchCandidate(home,'wheat',[home,near,far],inventory,routes)?.building.id,'near');
});
test('retains direct-call ordering when a physical recipe is already present',()=>{
 const home=building('mill','mill',2);
 assert.equal(fetchCandidate(home,'wheat',[home,near,far],inventory,routes)?.building.id,'near');
});
test('uses existing recipes for every input converter',()=>{
 for(const kind of ['mill','sawmill','masonry'] satisfies Building['kind'][]){
  const recipe=BUILDING_CONFIG_BY_KIND[kind].production;
  assert.ok(recipe?.input);
  const resource=recipe.input,home={...building('home',kind,0),inventory:{}},store=resource==='wheat'?'granary':'storehouse';
  const close={...building('near',store,0),inventory:{[resource]:1}};
  const distant={...building('far',store,0),inventory:{[resource]:8}};
  assert.equal(fetchCandidate(home,resource,[home,close,distant],inventory,routes)?.building.id,'far');
 }
});
test('uses available supplier load rather than raw physical stock',()=>{
 const home=building('mill','mill',0),claimed={...far,stockReserved:{wheat:96}};
 assert.equal(fetchCandidate(home,'wheat',[home,near,claimed],inventory,routes)?.building.id,'near');
});
test('keeps original ordering for nonfinite input metadata',()=>{
 for(const wheat of [NaN,Infinity]){
  const home=building('mill','mill',wheat);
  const port={...inventory,availableSpace:()=>20};
  assert.equal(fetchCandidate(home,'wheat',[home,near,far],port,routes)?.building.id,'near');
 }
});
test('preserves path and ID ordering within the sufficient class',()=>{
 const home=building('mill','mill',0),close={...near,inventory:{wheat:2}},a={...far,id:'a'},b={...far,id:'b'};
 assert.equal(fetchCandidate(home,'wheat',[home,far,close],inventory,routes)?.building.id,'near');
 for(const suppliers of [[a,b],[b,a]])assert.equal(fetchCandidate(home,'wheat',[home,...suppliers],inventory,routes)?.building.id,'a');
});

test('sequential real spawn respects competing source claims and retains partial fallback',()=>{
 const homes=[building('a-home','mill',0),building('b-home','mill',0)];
 const source={...far,inventory:{wheat:8}},buildings=[...homes,near,source],before=structuredClone(buildings);
 const result=spawnCarters({tick:1024834,buildings,walkers:[],inventory,routes,treasuryTimber:17});
 const claims=result.walkers.map(walker=>{
  assert.equal(walker.kind,'carter');
  if(walker.kind!=='carter')throw new Error('expected carter');
  const claim=walker.reservation?.sourceStockClaim;
  assert.ok(claim && 'buildingId' in claim);
  return claim;
 });
 assert.deepEqual(claims.map(claim=>[claim?.buildingId,claim?.amount]),[['far',8],['near',1]]);
 assert.equal(result.buildings.find(b=>b.id==='far')?.stockReserved?.wheat,8);
 assert.equal(result.buildings.find(b=>b.id==='near')?.stockReserved?.wheat,1);
 assert.equal(result.buildings.find(b=>b.id==='a-home')?.reserved?.wheat,8);
 assert.equal(result.buildings.find(b=>b.id==='b-home')?.reserved?.wheat,1);
 assert.equal(result.treasuryTimber,17);assert.deepEqual(buildings,before);
});
test('real spawn preserves a one-unit fetch when present input already supplies the other unit',()=>{
 const home=building('home','mill',1);
 const result=spawnCarters({tick:1025250,buildings:[home,near,far],walkers:[],inventory,routes});
 assert.equal(result.walkers.length,1);
 const walker=result.walkers[0];assert.ok(walker?.kind==='carter');
 const claim=walker.reservation?.sourceStockClaim;assert.ok(claim && 'buildingId' in claim);
 assert.equal(claim.buildingId,'near');
 assert.equal(walker.reservation?.sourceStockClaim?.amount,1);
});
