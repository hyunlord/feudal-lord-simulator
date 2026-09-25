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
import { constructionSiteId, createPalisadeConstructionSite } from '../src/economy/construction';
import { toPredictionLine, type PresentablePredictionLine } from '../src/ui/predictionTypes';

const severityOf = (line: PresentablePredictionLine | undefined) => line === undefined ? undefined : toPredictionLine(line).severity;

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
  assert.equal(severityOf(prediction.lines.find(l=>l.id==='workers')),'block');
  assert.match(prediction.lines.find(l=>l.id==='supply')?.text??'',/0\/24/);
});
test('invalid reason is Korean, and a road-less site is refused as the checklist says (FIX-1)',()=>{
  const state=fixture();
  assert.match(buildingPlacementPrediction(state,'well',{tx:3,ty:5}).lines[0]?.text??'',/점유 충돌/);
  const disconnected=buildingPlacementPrediction(state,'market',{tx:6,ty:10});
  assert.deepEqual(disconnected.placement,{ok:false,reason:'needs_road'});
  assert.equal(severityOf(disconnected.lines.find(l=>l.id==='road')),'block');
  assert.match(disconnected.lines[0]?.text??'',/도로 연결 없음/);
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
  assert.equal(severityOf(first.lines.find(l=>l.id==='workers')),'ok');
  assert.equal(severityOf(second.lines.find(l=>l.id==='workers')),'block');
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
  assert.equal(severityOf(prediction.lines.find(line=>line.id==='road')),'block');
  assert.match(prediction.lines.find(line=>line.id==='road')?.text??'',/운영에 불필요/);
  assert.match(prediction.lines.find(line=>line.id==='supply')?.text??'',/1\/12필지/);
});
test('food placement distinguishes a local road from a material delivery route',()=>{
  const connected = fixture();
  connected.treasuryTimber = 0;
  connected.buildings = [
    {...connected.buildings[0]!, inventory: {timber: 100}},
    {...connected.buildings[0]!, id: 'far-store', kind: 'storehouse', tx: 15, ty: 15, inventory: {}},
  ];
  const nearby = buildingPlacementPrediction(connected,'mill',{tx:6,ty:4});
  assert.equal(nearby.placement.ok,true);
  assert.equal(severityOf(nearby.lines.find(line => line.id === 'delivery-route')),'ok');

  const island = {...connected,tiles:connected.tiles.map(tile => tile.tx === 6 && tile.ty === 9
    ? {...tile,hasRoad:true} : tile)};
  const disconnected = buildingPlacementPrediction(island,'mill',{tx:6,ty:10});
  assert.equal(disconnected.placement.ok,true);
  assert.equal(severityOf(disconnected.lines.find(line => line.id === 'road')),'ok');
  assert.equal(severityOf(disconnected.lines.find(line => line.id === 'delivery-route')),'block');

  const shifted = {...connected, buildings: connected.buildings.map(building => ({
    ...building, inventory: {timber: building.id === 'far-store' ? 100 : 0},
  }))};
  const nowUnreachable = buildingPlacementPrediction(shifted,'mill',{tx:6,ty:4});
  assert.notEqual(nowUnreachable, nearby);
  assert.equal(severityOf(nowUnreachable.lines.find(line => line.id === 'delivery-route')),'block');
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
test('tick and production-only clones reuse predictions while semantic changes invalidate them',()=>{
  const state=fixture();const tile={tx:6,ty:3};
  const first=buildingPlacementPrediction(state,'market',tile);
  const ticking={...state,tick:state.tick+1,wallTick:state.wallTick+1,
    buildings:state.buildings.map(b=>({...b,productionProgress:b.productionProgress+1,inventory:{...b.inventory,bread:77}})),
    houses:state.houses.map(h=>({...h,breadStock:99,residents:15}))};
  assert.equal(buildingPlacementPrediction(ticking,'market',tile),first);
  for(const changed of [
    {...state,treasuryTimber:0},
    {...state,population:0},
    {...state,tiles:state.tiles.map(t=>({...t,hasRoad:false}))},
    {...state,houses:state.houses.map(h=>({...h,level:4}))},
    {...state,nextConstructionOrdinal:state.nextConstructionOrdinal+1},
  ]) assert.notEqual(buildingPlacementPrediction(changed,'market',tile),first);
});

test('semantic cache follows reservation expiry and completion while retaining ready-site labour demand',()=>{
  const site=createPalisadeConstructionSite({id:'wall-site',wallId:'wall',segmentIndex:0,gateDistance:0,order:0,path:[{x:18,y:18},{x:19,y:18}],startedTick:0});
  const state={...fixture(),era:'palisade' as const,eraProclaimedTick:0,tick:100,population:6,
    constructionSites:[{...site,delivered:{...site.required}}]};
  const first=buildingPlacementPrediction(state,'market',{tx:6,ty:3});
  assert.equal(buildingPlacementPrediction({...state,tick:101},'market',{tx:6,ty:3}),first);
  const expired=buildingPlacementPrediction({...state,tick:600},'market',{tx:6,ty:3});
  assert.notEqual(expired,first);
  assert.equal(severityOf(first.lines.find(line=>line.id==='workers')),'block');
  assert.equal(severityOf(expired.lines.find(line=>line.id==='workers')),'block');
  assert.equal(buildingPlacementPrediction({...state,tick:601},'market',{tx:6,ty:3}),expired);
  const completed=buildingPlacementPrediction({...state,tick:601,
    constructionSites:state.constructionSites.map(ready=>({...ready,builderTicks:ready.requiredBuilderTicks}))},'market',{tx:6,ty:3});
  assert.notEqual(completed,expired);
  assert.equal(severityOf(completed.lines.find(line=>line.id==='workers')),'ok');
});
