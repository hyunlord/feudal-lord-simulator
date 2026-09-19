import { getTile, type TileCoordinate } from "./grid";
import { canTraverseWallBoundary, type WallGrid } from "./wallTraversal";

export const BRIDGE_MAX_WATER_TILES = 8;
export const BRIDGE_TIMBER_PER_TILE = 4;
export type BridgeSpan = { readonly axis: "x" | "y"; readonly water: readonly TileCoordinate[]; readonly banks: readonly [TileCoordinate, TileCoordinate] };
const axes = [{tx:1,ty:0,axis:"x"},{tx:0,ty:1,axis:"y"}] as const;
const same = (a:TileCoordinate,b:TileCoordinate) => a.tx===b.tx&&a.ty===b.ty;

/** Derive only bounded, straight complete spans. Invalid legacy water roads stay impassable. */
export function bridgeAt(grid:WallGrid, coordinate:TileCoordinate):BridgeSpan|null {
  const tile=getTile(grid,coordinate);
  if(tile?.terrain!=="water"||!tile.hasRoad)return null;
  const spans:BridgeSpan[]=[];
  for(const direction of axes){
    const water:TileCoordinate[]=[coordinate];
    const banks:TileCoordinate[]=[];
    for(const sign of [-1,1]){
      for(let step=1;step<=BRIDGE_MAX_WATER_TILES+1;step++){
        const point={tx:coordinate.tx+direction.tx*sign*step,ty:coordinate.ty+direction.ty*sign*step};
        const candidate=getTile(grid,point);
        if(candidate?.hasRoad!==true||candidate.buildingId!==null)break;
        if(candidate.terrain==="grass"){banks.push(point);break;}
        if(candidate.terrain!=="water")break;
        water.push(point);
      }
    }
    const first=banks[0],last=banks[1];
    if(first===undefined||last===undefined||water.length>BRIDGE_MAX_WATER_TILES)continue;
    water.sort((a,b)=>a.tx-b.tx||a.ty-b.ty);
    spans.push({axis:direction.axis,water,banks:[first,last]});
  }
  return spans.length===1 ? spans[0]??null : null;
}

export function canTraverseRoadBoundary(grid:WallGrid,from:TileCoordinate,to:TileCoordinate):boolean {
  if(!canTraverseWallBoundary(grid,from,to))return false;
  for(const [point,other] of [[from,to],[to,from]] as const){
    if(getTile(grid,point)?.terrain!=="water")continue;
    const span=bridgeAt(grid,point);
    if(span===null)return false;
    if(![...span.water,...span.banks].some(candidate=>same(candidate,other)))return false;
  }
  return true;
}

export function bridgeRemovalTiles(grid:WallGrid,coordinate:TileCoordinate):readonly TileCoordinate[]{
  const removed:TileCoordinate[]=[coordinate];
  for(const candidate of [coordinate,...axes.flatMap(d=>[-1,1].map(sign=>({tx:coordinate.tx+d.tx*sign,ty:coordinate.ty+d.ty*sign})))]){
    const span=bridgeAt(grid,candidate);
    if(span!==null&&(span.water.some(t=>same(t,coordinate))||span.banks.some(t=>same(t,coordinate))))removed.push(...span.water);
  }
  return removed;
}
