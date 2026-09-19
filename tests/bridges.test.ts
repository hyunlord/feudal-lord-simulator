import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { placeRoadLine, removeRoad } from "../src/engine/gameActions";
import { findExistingRoadPath } from "../src/world/roadGraph";

function river() {
  const state = DEFAULT_GAME_STATE;
  return { ...state, width: 7, height: 7, buildings: [], constructionSites: [], palisade: null, treasuryTimber: 100,
    tiles: Array.from({length:49}, (_,i) => ({tx:i%7,ty:Math.floor(i/7),terrain: i%7>=2 && i%7<=4 ? "water" as const : "grass" as const,buildingId:null,hasRoad:false})) };
}
test("bank to bank bridge places atomically, costs timber, routes, and removes as one span", () => {
  const state=river(); const next=placeRoadLine(state,{tx:1,ty:3},{tx:5,ty:3});
  assert.equal(next.treasuryTimber,88);
  assert.equal(next.tiles.filter(t=>t.hasRoad).length,5);
  assert.equal(findExistingRoadPath(next,{start:{tx:1,ty:3},destination:{tx:5,ty:3}})?.length,5);
  const removed=removeRoad(next,{tx:3,ty:3});
  assert.equal(removed.tiles.filter(t=>t.terrain==="water"&&t.hasRoad).length,0);
  assert.equal(removeRoad(next,{tx:1,ty:3}).tiles.filter(t=>t.terrain==="water"&&t.hasRoad).length,0);
});
test("partial, unaffordable, occupied bank and crossing bridge requests leave state unchanged",()=>{
  const state=river();
  assert.equal(placeRoadLine(state,{tx:1,ty:3},{tx:3,ty:3}),state);
  const poor={...state,treasuryTimber:11};
  assert.equal(placeRoadLine(poor,{tx:1,ty:3},{tx:5,ty:3}),poor);
  const blocked={...state,tiles:state.tiles.map(t=>t.tx===5&&t.ty===3?{...t,buildingId:"house"}:t)};
  assert.equal(placeRoadLine(blocked,{tx:1,ty:3},{tx:5,ty:3}),blocked);
});

test("existing bank roads are reused, water side access is blocked, reverse drag has identical tiles",()=>{
  const state=river();
  const banks={...state,tiles:state.tiles.map(t=>t.ty===3&&(t.tx===1||t.tx===5)?{...t,hasRoad:true}:t)};
  const next=placeRoadLine(banks,{tx:5,ty:3},{tx:1,ty:3});
  assert.equal(next.treasuryTimber,88);
  assert.deepEqual(next.tiles,placeRoadLine(state,{tx:1,ty:3},{tx:5,ty:3}).tiles);
  const side={...next,tiles:next.tiles.map(t=>t.tx===3&&t.ty===2?{...t,terrain:"grass" as const,hasRoad:true}:t)};
  assert.equal(findExistingRoadPath(side,{start:{tx:3,ty:2},destination:{tx:3,ty:3}}),null);
  assert.equal(placeRoadLine(next,{tx:1,ty:2},{tx:5,ty:2}),next);
});
test("completed wall rejects bridge atomically and blocks an existing bridge without a gate",()=>{
  const state=river();
  const palisade={id:"wall",polygon:[{x:3,y:0},{x:3,y:7}],gate:{x:3,y:0},segments:[{id:"solid",order:0,edgePath:[{x:3,y:0},{x:3,y:7}],tileCount:7,completed:true,constructionSiteId:null}]};
  const blocked={...state,palisade};
  assert.equal(placeRoadLine(blocked,{tx:1,ty:3},{tx:5,ty:3}),blocked);
  const bridge=placeRoadLine(state,{tx:1,ty:3},{tx:5,ty:3});
  assert.equal(findExistingRoadPath({...bridge,palisade},{start:{tx:1,ty:3},destination:{tx:5,ty:3}}),null);
});
test("vertical bridges preserve graph symmetry, bounded lengths, and no-turn legacy rejection",()=>{
  const state=river();
  const vertical={...state,tiles:state.tiles.map(t=>({...t,terrain:t.ty>=2&&t.ty<=4?"water" as const:"grass" as const}))};
  const bridge=placeRoadLine(vertical,{tx:3,ty:1},{tx:3,ty:5});
  assert.equal(bridge.treasuryTimber,88);
  assert.equal(findExistingRoadPath(bridge,{start:{tx:3,ty:5},destination:{tx:3,ty:1}})?.length,5);
  const long={...state,width:12,height:3,tiles:Array.from({length:36},(_,i)=>({tx:i%12,ty:Math.floor(i/12),terrain:i%12>0&&i%12<10?"water" as const:"grass" as const,buildingId:null,hasRoad:false}))};
  assert.equal(placeRoadLine(long,{tx:0,ty:1},{tx:10,ty:1}),long);
  const broken={...bridge,tiles:bridge.tiles.map(t=>t.tx===3&&t.ty===1?{...t,hasRoad:false}:t)};
  assert.equal(findExistingRoadPath(broken,{start:{tx:3,ty:2},destination:{tx:3,ty:5}}),null);
});

test("bridge spending preserves reserved stock and UI preview shares atomic validation",async()=>{
  const {placementPreview}=await import("../src/render/interactions");
  const state=river();
  const store={id:"stock",kind:"storehouse" as const,tx:0,ty:0,inventory:{timber:20},stockReserved:{timber:10},reserved:{},workers:2,productionProgress:0};
  const stocked={...state,treasuryTimber:5,buildings:[store]};
  const preview=placementPreview(stocked,"road",{tx:5,ty:3},{tx:1,ty:3});
  assert.equal(preview.ok,true);assert.equal(preview.timberCost,12);
  const built=placeRoadLine(stocked,{tx:1,ty:3},{tx:5,ty:3});
  assert.equal(built.treasuryTimber,0);assert.equal(built.buildings[0]?.inventory.timber,13);assert.equal(built.buildings[0]?.stockReserved.timber,10);
  const poor={...stocked,treasuryTimber:0};
  assert.equal(placementPreview(poor,"road",{tx:5,ty:3},{tx:1,ty:3}).ok,false);
  assert.equal(placeRoadLine(poor,{tx:1,ty:3},{tx:5,ty:3}),poor);
});
