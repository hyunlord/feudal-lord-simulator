import { GRID_SIZE } from './rules.js';
import { random } from './random.js';
import type { City, Terrain, Tile } from './types.js';
export function makeTiles(seed:number,terrain:Terrain):Tile[] {
 const state={rng:seed>>>0}; const tiles:Tile[]=[];
 for(let y=0;y<GRID_SIZE;y++) for(let x=0;x<GRID_SIZE;x++) {
  const noise=random(state); let water=false; let elevation=1; let fertility=3; let wood=1;
  switch(terrain) {
   case 'river': water=x===4+Math.floor(y/7);fertility=4;break;
   case 'coast': water=x<3;fertility=2;break;
   case 'mountain': elevation=Math.floor((x+y)/7);fertility=1;wood=2;break;
   case 'forest':wood=4;fertility=2;break;
   case 'marsh':water=(x<6 && (x+y)%4===0);fertility=2;elevation=0;break;
   default: return assertNever(terrain);
  }
  tiles.push({x,y,water,elevation,fertility:fertility+Math.floor(noise*2),wood:wood+Math.floor(noise*2),road:y===10 || x===10});
 }
 return tiles;
}
function assertNever(value:never):never { throw new RangeError(`Unknown terrain ${String(value)}`); }
export function siteAccess(city:City,tile:Tile):number {
 return (tile.road?3:0)-Math.abs(tile.x-10)*0.12-Math.abs(tile.y-10)*0.12;
}
export function connectRoad(city:City,tile:Tile):void {
 for(const t of city.tiles) if((t.y===tile.y && t.x>=Math.min(tile.x,10) && t.x<=Math.max(tile.x,10)) || (t.x===10 && t.y>=Math.min(tile.y,10) && t.y<=Math.max(tile.y,10))) t.road=true;
}
