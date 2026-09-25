import type { GameState } from '../src/engine/engine.types';
import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_GAME_STATE, gameReducer } from '../src/state/gameStore';
import { foodEntranceBuildAction } from '../src/engine/autoplayFoodEntrance';
import { BUILDING_CONFIG_BY_KIND, type Building } from '../src/content/buildingConfig';
import { autoplayActionToGameAction } from '../src/engine/autoplayActions';

function town(): GameState {
  const buildings: Building[] = [{id:'granary',kind:'granary',tx:6,ty:6,workers:2,inventory:{wheat:80},reserved:{},stockReserved:{},productionProgress:0},
    {id:'store',kind:'storehouse',tx:2,ty:2,workers:2,inventory:{timber:500,stone:500},reserved:{},stockReserved:{},productionProgress:0}];
  for (const [tx,ty] of [[5,7],[8,7],[5,8],[8,9],[6,9],[7,9]]) buildings.push({id:`block-${tx}-${ty}`,kind:'house',tx:tx??0,ty:ty??0,workers:0,inventory:{},reserved:{},stockReserved:{},productionProgress:0});
  return {...structuredClone(DEFAULT_GAME_STATE),width:16,height:16,buildings,houses:[],walkers:[],constructionSites:[],palisade:null,population:30,idleWorkers:20,
    tiles:Array.from({length:256},(_,i)=>{const tx=i%16,ty=Math.floor(i/16);return {tx,ty,terrain:'grass' as const,hasRoad:ty===4||tx===10&&ty>=4&&ty<=8||ty===8&&tx>=6&&tx<=10,
      buildingId:buildings.find(b=>tx>=b.tx&&tx<b.tx+BUILDING_CONFIG_BY_KIND[b.kind].width&&ty>=b.ty&&ty<b.ty+BUILDING_CONFIG_BY_KIND[b.kind].height)?.id??null};})};
}

test('Given a stocked granary with a long existing entrance When planning a mill Then a paid closer entrance beats existing connected pads',()=>{
  const state=town();
  const action=foodEntranceBuildAction(state,'mill');
  assert.equal(action?.kind,'place_road');
  if(action===null)return;
  const command=autoplayActionToGameAction(action,state);assert.ok(command);
  const next=gameReducer(state,command);assert.notEqual(next,state);
  assert.ok(next.tiles.filter(t=>t.hasRoad).length>state.tiles.filter(t=>t.hasRoad).length);
  assert.equal(next.buildings.filter(b=>b.kind==='mill').length,0);
});

test('Given no available grain When planning a mill entrance Then speculative raw access is not credited',()=>{
  const state=town();state.buildings=state.buildings.map(b=>({...b,inventory:{}}));
  assert.equal(foodEntranceBuildAction(state,'mill'),null);
});

test('Given no construction budget When evaluating a closer entrance Then no orphan road is authorized',()=>{
  const state=town();state.treasuryTimber=0;state.buildings=state.buildings.map(b=>b.kind==='storehouse'?{...b,inventory:{}}:b);
  assert.equal(foodEntranceBuildAction(state,'mill'),null);
});

test('Given a granary already sharing a road with a legal mill pad When evaluating entrances Then no speculative road is added',()=>{
  const state=town();state.buildings=state.buildings.filter(b=>!b.id.startsWith('block-'));
  state.tiles=state.tiles.map(t=>t.buildingId?.startsWith('block-')?{...t,buildingId:null}:t);
  assert.equal(foodEntranceBuildAction(state,'mill')?.kind,'place_building');
});

test('Given an empty second granary beside a remote pad When evaluating mill hauling Then only stocked-source distance ranks the actual placement',()=>{
  const state=town();state.buildings=state.buildings.filter(b=>!b.id.startsWith('block-'));
  state.tiles=state.tiles.map(t=>t.buildingId?.startsWith('block-')?{...t,buildingId:null}:t);
  const expected=foodEntranceBuildAction(state,'mill');assert.equal(expected?.kind,'place_building');
  const empty:Building={id:'empty',kind:'granary',tx:11,ty:2,workers:2,inventory:{},reserved:{},stockReserved:{},productionProgress:0};
  state.buildings.push(empty);state.tiles=state.tiles.map(t=>t.tx>=11&&t.tx<13&&t.ty>=2&&t.ty<4?{...t,buildingId:empty.id}:t);
  assert.deepEqual(foodEntranceBuildAction(state,'mill'),expected);
});

test('Given a closer entrance was built When re-evaluating next action Then the same planner starts ordinary paid mill construction',()=>{
  let state=town();
  for(let step=0;step<8;step++){
    const action=foodEntranceBuildAction(state,'mill');assert.ok(action);
    const command=autoplayActionToGameAction(action,state);assert.ok(command);
    const next=gameReducer(state,command);assert.notEqual(next,state);state=next;
    if(action.kind==='place_building'){
      assert.ok(state.constructionSites.some(site=>site.kind==='mill'&&site.tx===action.tx&&site.ty===action.ty));return;
    }
  }
  assert.fail('entrance planning did not reach construction');
});

import { preserveRoadExpansion } from '../src/engine/autoplayExpansion';
test('Given the best adjacent pad closes a land passage When its preservation needs a road Then it is not credited as immediate mill construction',()=>{
  const state=town();const rows=['#######','###...#','##R...#','##.####','#######'];
  state.width=7;state.height=5;
  state.buildings=[{id:'granary',kind:'granary',tx:0,ty:1,workers:2,inventory:{wheat:80},reserved:{},stockReserved:{},productionProgress:0}];
  state.tiles=rows.flatMap((row,ty)=>[...row].map((cell,tx)=>({tx,ty,terrain:'grass' as const,hasRoad:cell==='R',buildingId:cell==='#'?`occupied-${tx}-${ty}`:null})));
  assert.equal(preserveRoadExpansion(state,{kind:'mill',tx:3,ty:2})?.kind,'place_road');
  const action=foodEntranceBuildAction(state,'mill');
  assert.ok(action?.kind!=='place_building'||action.tx!==3||action.ty!==2);
});

import { foodAction } from '../src/engine/autoplayFood';
test('Given an incomplete initial food chain When the advisor bootstraps Then it paints the first field block without speculative entrance roads or a build delegate',()=>{
  // AF-13: the grain bootstrap step is a painted arable block (no farmstead placement yet, since nothing tends
  // it until a field exists), so the build delegate is never called and no entrance-road logic is engaged.
  const state=structuredClone(DEFAULT_GAME_STATE);
  let requested: string | null=null;
  const action=foodAction(state,(_state,kind)=>{requested=kind;return {kind:'place_building',building:kind,tx:45,ty:37};});
  assert.equal(requested,null);
  assert.deepEqual(action,{kind:'paint_zone',zone:'arable',stroke:{tool:'polygon',points:[{x:44,y:37},{x:46,y:37},{x:46,y:39},{x:44,y:39}]}});
});
