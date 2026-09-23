import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_GAME_STATE } from '../src/state/gameStore';
import type { GameState } from '../src/engine/engine.types';
import { buildingPlacementPrediction, roadPlacementPrediction } from '../src/ui/placementPrediction';
import { placeBuilding } from '../src/engine/gameActions';
import { completeEligibleConstruction } from '../src/engine/constructionLifecycle';
import { allocateBuildingAndConstructionLabour } from '../src/population/labour';
import { buildingHasRequiredRoadAccess } from '../src/engine/roadAccess';
import { householdServices } from '../src/engine/householdServices';
import { constructionSiteId } from '../src/economy/construction';

function fixture(): GameState {
  return { ...DEFAULT_GAME_STATE, width: 24, height: 24, era: 'stone_town', population: 100, idleWorkers: 40, treasuryTimber: 999,
    buildings: [{ id: 'home', kind: 'house', tx: 3, ty: 4, workers: 0, inventory: { stone: 999 }, reserved: {}, stockReserved: {}, productionProgress: 0 }],
    houses: [{ buildingId: 'home', level: 2, residents: 14, hasWater: false, breadStock: 5, lastServicedTick: 0, unmetRequirementTicks: 0 }],
    constructionSites: [], walkers: [], palisade: null,
    tiles: Array.from({length:576}, (_,i)=>({tx:i%24,ty:Math.floor(i/24),terrain:'grass',hasRoad:Math.floor(i/24)===5,buildingId:null})),
  };
}
for (const [kind, service] of [['well','water'],['market','market'],['church','church']] as const) {
  test(`${kind} prediction equals real completed construction and labour allocation without state mutation`, () => {
    const state = fixture(); const before = JSON.stringify(state);
    const prediction = buildingPlacementPrediction(state, kind, {tx:6,ty:3});
    const placed = placeBuilding(state, kind, {tx:6,ty:3});
    const completed = completeEligibleConstruction({...placed, wallTick:placed.wallTick+10000, constructionSites:placed.constructionSites.map(s=>({...s,delivered:{...s.required},builderTicks:s.requiredBuilderTicks}))});
    const labour = allocateBuildingAndConstructionLabour(completed.buildings, completed.constructionSites, completed.population,
      {era:completed.era,tick:completed.tick,eraProclaimedTick:completed.eraProclaimedTick}, b=>buildingHasRequiredRoadAccess(completed,b));
    const actual = householdServices({...completed,buildings:[...labour.buildings]});
    const provider = actual.providers.get(constructionSiteId(state.nextConstructionOrdinal)); assert.ok(provider);
    assert.equal(prediction.lines.find(l=>l.id==='supply')?.text, `완공 후 예상 공급 ${provider.used}/${provider.capacity}필지`);
    assert.equal(actual.houses.get('home')?.[service].kind,'served');
    assert.deepEqual(prediction.houseIds,['home']); assert.equal(JSON.stringify(state),before);
    assert.equal(buildingPlacementPrediction(state,kind,{tx:6,ty:3}),prediction);
  });
}
test('understaffed market forecasts no service and failed worker line',()=>{
  const state={...fixture(),population:0,idleWorkers:0};
  const prediction=buildingPlacementPrediction(state,'market',{tx:6,ty:3});
  assert.equal(prediction.lines.find(l=>l.id==='workers')?.tone,'negative');
  assert.match(prediction.lines.find(l=>l.id==='supply')?.text??'',/0\/24/);
});
test('invalid reason is Korean and road access does not invent a placement rejection',()=>{
  const state=fixture();
  assert.match(buildingPlacementPrediction(state,'well',{tx:3,ty:5}).lines[0]?.text??'',/점유 충돌/);
  const disconnected=buildingPlacementPrediction(state,'market',{tx:6,ty:10});
  assert.equal(disconnected.placement.ok,true);
  assert.equal(disconnected.lines.find(l=>l.id==='road')?.tone,'negative');
});
test('bridge counts and costs use current road rules and distinguish patterns',()=>{
  const state=fixture(); state.tiles=state.tiles.map(t=>t.ty===10 && t.tx>=5 && t.tx<=7?{...t,terrain:'water'}:t);
  const path=Array.from({length:5},(_,i)=>({tx:i+4,ty:10}));
  const result=roadPlacementPrediction(state,path);
  assert.equal(result.placement.ok,true);
  assert.match(result.lines[0]?.text??'',/육지 2칸 무료 · 다리 3칸 × 목재 4 = 12/);
  assert.equal(result.roadSegments.filter(s=>s.kind==='bridge').length,3);
});
test('granary marks L3 candidates but not L4 homes',()=>{
  assert.deepEqual(buildingPlacementPrediction(fixture(),'granary',{tx:6,ty:3}).houseIds,['home']);
  const state=fixture();state.houses=state.houses.map(h=>({...h,level:4}));
  assert.deepEqual(buildingPlacementPrediction(state,'granary',{tx:6,ty:3}).houseIds,[]);
});
test('new well prediction includes reallocation from a full existing provider and merged lot demand',()=>{
  const state=fixture(); const template=state.buildings[0]; assert.ok(template);
  const home=state.houses[0]; assert.ok(home);
  state.buildings=Array.from({length:13},(_,i)=>({...template,id:`home-${i}`,tx:3,ty:4,...(i===0?{houseLot:'horizontal' as const}:{})}));
  state.houses=state.buildings.map(b=>({...home,buildingId:b.id}));
  state.buildings.push({...template,id:'old-well',kind:'well',tx:3,ty:3});
  const prediction=buildingPlacementPrediction(state,'well',{tx:6,ty:3});
  assert.match(prediction.lines.find(l=>l.id==='new-service')?.text??'',/^새로 공급 2필지/);
  assert.equal(householdServices(state).providers.get('old-well')?.used,12);
});
test('new state invalidates cached worker forecast even on the same tile',()=>{
  const state=fixture(); const first=buildingPlacementPrediction(state,'market',{tx:6,ty:3});
  const second=buildingPlacementPrediction({...state,population:0},'market',{tx:6,ty:3});
  assert.notEqual(first,second);
  assert.equal(first.lines.find(l=>l.id==='workers')?.tone,'positive');
  assert.equal(second.lines.find(l=>l.id==='workers')?.tone,'negative');
});
test('material shortage and wall clearance preserve authoritative placement reasons',()=>{
  const state=fixture();
  const poor={...state,treasuryTimber:0,buildings:state.buildings.map(b=>({...b,inventory:{}}))};
  assert.match(buildingPlacementPrediction(poor,'church',{tx:6,ty:3}).lines[0]?.text??'',/자재 부족/);
  const wall={...state,palisade:{id:'wall',polygon:[],gate:{x:0,y:0},segments:[{id:'w',order:0,edgePath:[{x:6,y:3},{x:6,y:4}],tileCount:1,completed:true,constructionSiteId:null}]}};
  assert.match(buildingPlacementPrediction(wall,'well',{tx:6,ty:3}).lines[0]?.text??'',/성벽과 너무 가까움/);
});
test('disconnected well reports no road while remaining legal and supplying water',()=>{
  const state=fixture();
  const prediction=buildingPlacementPrediction(state,'well',{tx:6,ty:3});
  assert.equal(prediction.placement.ok,true);
  assert.equal(prediction.lines.find(line=>line.id==='road')?.tone,'negative');
  assert.match(prediction.lines.find(line=>line.id==='road')?.text??'',/운영에 불필요/);
  assert.match(prediction.lines.find(line=>line.id==='supply')?.text??'',/1\/12필지/);
});
test('market projection matches completion when another ready construction reserves a worker',()=>{
  const opening={...fixture(),population:8,idleWorkers:4};
  const withSite=placeBuilding(opening,'house',{tx:10,ty:4});
  const state={...withSite,constructionSites:withSite.constructionSites.map(site=>({...site,delivered:{...site.required}}))};
  const prediction=buildingPlacementPrediction(state,'market',{tx:6,ty:3});
  const marketId=constructionSiteId(state.nextConstructionOrdinal);
  const placed=placeBuilding(state,'market',{tx:6,ty:3});
  const complete=completeEligibleConstruction({...placed,wallTick:placed.wallTick+10000,
    constructionSites:placed.constructionSites.map(site=>site.id===marketId?{...site,delivered:{...site.required},builderTicks:site.requiredBuilderTicks}:site)});
  const labour=allocateBuildingAndConstructionLabour(complete.buildings,complete.constructionSites,complete.population,
    {era:complete.era,tick:complete.tick,eraProclaimedTick:complete.eraProclaimedTick},building=>buildingHasRequiredRoadAccess(complete,building));
  const actual=householdServices({...complete,buildings:[...labour.buildings]});
  const provider=actual.providers.get(marketId);assert.ok(provider);
  assert.equal(prediction.lines.find(line=>line.id==='supply')?.text,`완공 후 예상 공급 ${provider.used}/${provider.capacity}필지`);
  assert.equal(prediction.lines.find(line=>line.id==='workers')?.text,`일꾼 ${provider.workers}/${provider.requiredWorkers}명`);
  assert.equal(complete.constructionSites.length,1);
});
