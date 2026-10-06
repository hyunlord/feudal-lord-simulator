import { GRID_SIZE } from './rules.js';
import type { BattleMap, Point } from './battle.types.js';
export const pointKey = (p:Point):string => `${p.x},${p.y}`;
export function guardExposure(map:BattleMap,p:Point):number {
 const posts=map.city.facilities.filter(f=>f.axis==='military' && f.hp>0);
 const total=posts.reduce((s,p)=>s+Math.max(0,p.workers),0);
 return posts.reduce((sum,post)=>{
  const distance=Math.abs(post.x-p.x)+Math.abs(post.y-p.y);
  return sum+(distance<=3 ? map.guards*Math.max(0,post.workers)/Math.max(1,total)*(4-distance)/4 : 0);
 },0);
}
export function movementCost(map:BattleMap,p:Point):number {
 const tile=map.city.tiles.find(t=>t.x===p.x && t.y===p.y);
 if(!tile || (tile.water && !tile.road)) return Infinity;
 const gate=map.city.facilities.find(f=>f.x===p.x && f.y===p.y && f.axis==='military' && f.hp>0);
 return (tile.road?1:2)+tile.elevation+(gate?Math.ceil(gate.hp/(map.mode==='siege'?15:5)):0);
}
type QueueEntry = { readonly index:number; readonly distance:number };
class RouteQueue {
 private readonly entries:QueueEntry[]=[];
 private before(a:QueueEntry,b:QueueEntry):boolean {return a.distance<b.distance || (a.distance===b.distance && a.index<b.index);}
 push(entry:QueueEntry):void {
  let at=this.entries.length;this.entries.push(entry);
  while(at>0){const parent=Math.floor((at-1)/2);const prior=this.entries[parent];if(!prior || !this.before(entry,prior))break;this.entries[at]=prior;at=parent;}
  this.entries[at]=entry;
 }
 pop():QueueEntry|undefined {
  const first=this.entries[0];const last=this.entries.pop();if(!last || this.entries.length===0)return first;
  let at=0;
  while(at*2+1<this.entries.length){
   let child=at*2+1;const left=this.entries[child];const right=this.entries[child+1];
   if(right && left && this.before(right,left))child++;
   const candidate=this.entries[child];if(!candidate || !this.before(candidate,last))break;
   this.entries[at]=candidate;at=child;
  }
  this.entries[at]=last;return first;
 }
}
export function findRoute(map:BattleMap,start:Point,goal:Point):Point[] {
 const size=GRID_SIZE*GRID_SIZE;
 const costs=new Float64Array(size).fill(Infinity);
 const posts=map.city.facilities.filter(f=>f.axis==='military' && f.hp>0);
 const total=posts.reduce((s,p)=>s+Math.max(0,p.workers),0);
 const indexedTiles=new Map<number,typeof map.city.tiles[number]>();
 for(const tile of map.city.tiles){const index=tile.y*GRID_SIZE+tile.x;if(!indexedTiles.has(index))indexedTiles.set(index,tile);}
 for(const [index,tile] of indexedTiles){
  if(tile.water && !tile.road)continue;
  const gate=posts.find(f=>f.x===tile.x && f.y===tile.y);
  const move=(tile.road?1:2)+tile.elevation+(gate?Math.ceil(gate.hp/(map.mode==='siege'?15:5)):0);
  const exposure=posts.reduce((sum,post)=>{
   const distance=Math.abs(post.x-tile.x)+Math.abs(post.y-tile.y);
   return sum+(distance<=3 ? map.guards*Math.max(0,post.workers)/Math.max(1,total)*(4-distance)/4 : 0);
  },0);
  costs[index]=move+exposure*0.25;
 }
 const distances=new Float64Array(size).fill(Infinity);const previous=new Int32Array(size).fill(-1);
 const closed=new Uint8Array(size);const open=new RouteQueue();
 const origin=start.y*GRID_SIZE+start.x;const target=goal.y*GRID_SIZE+goal.x;
 distances[origin]=0;open.push({index:origin,distance:0});
 for(let current=open.pop();current;current=open.pop()){
  const index=current.index;if(closed[index] || current.distance!==distances[index])continue;closed[index]=1;
  if(index===target){
   const route:Point[]=[];let cursor=index;
   while(cursor>=0){route.push(cursor===origin?start:{x:cursor%GRID_SIZE,y:Math.floor(cursor/GRID_SIZE)});cursor=previous[cursor]??-1;}
   return route.reverse();
  }
  const x=index%GRID_SIZE;const y=Math.floor(index/GRID_SIZE);
  for(const [dx,dy] of [[0,-1],[-1,0],[1,0],[0,1]] as const){
   const nx=x+dx;const ny=y+dy;if(nx<0 || ny<0 || nx>=GRID_SIZE || ny>=GRID_SIZE)continue;
   const next=ny*GRID_SIZE+nx;const distance=current.distance+(costs[next]??Infinity);
   if(distance<(distances[next]??Infinity)){distances[next]=distance;previous[next]=index;open.push({index:next,distance});}
  }
 }
 return [];
}
