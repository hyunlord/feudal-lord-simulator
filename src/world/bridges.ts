import { getTile, type TileCoordinate } from "./grid";
import { canTraverseWallBoundary, type WallGrid } from "./wallTraversal";

export const BRIDGE_MAX_WATER_TILES = 8;
export const BRIDGE_TIMBER_PER_TILE = 4;
/**
 * FIX-10 (FD-1…FD-3, spec docs/design/map-archetypes.md): a ford — a road laid over a river's ford cells (its narrow,
 * open-banked reaches, `RiverData.fords`) — needs no bridge: a timber a cell for the causeway's stones and hurdles, and
 * carts and walkers wade it at half their pace.
 */
export const FORD_TIMBER_PER_TILE = 1;
export const FORD_PACE_DIVISOR = 2;
const fordSets = new WeakMap<readonly number[], ReadonlySet<number>>();

/** The tile is one of the river's ford cells (with a road or not). */
export function isFordCell(grid:WallGrid,coordinate:TileCoordinate):boolean {
  const fords=grid.river?.fords;
  if(fords===undefined||fords.length===0||coordinate.tx<0||coordinate.ty<0||coordinate.tx>=grid.width||coordinate.ty>=grid.height)return false;
  let set=fordSets.get(fords);
  if(set===undefined){set=new Set(fords);fordSets.set(fords,set);}
  return set.has(coordinate.ty*grid.width+coordinate.tx);
}

/** FD-2: the pace of a step from `from` to `to` — `pace`, or `pace / FORD_PACE_DIVISOR` when either end is a ford road. */
export function wadingPace(isFord:((tile:TileCoordinate)=>boolean)|undefined,from:TileCoordinate|undefined,to:TileCoordinate|undefined,pace:number):number {
  return from!==undefined&&to!==undefined&&isFord!==undefined&&(isFord(from)||isFord(to)) ? pace/FORD_PACE_DIVISOR : pace;
}

/** A road on a ford cell: the wading place. */
export function isFordRoad(grid:WallGrid,coordinate:TileCoordinate):boolean {
  return getTile(grid,coordinate)?.hasRoad===true&&isFordCell(grid,coordinate);
}
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
  return canTraverseWallBoundary(grid,from,to)&&bridgeEndAllows(grid,from,to)&&bridgeEndAllows(grid,to,from);
}

/** A water end of a step is a bridge's, and the other end on that same bridge (its water or its banks). */
function bridgeEndAllows(grid:WallGrid,point:TileCoordinate,other:TileCoordinate):boolean {
  if(getTile(grid,point)?.terrain!=="water")return true;
  if(isFordRoad(grid,point))return true;
  const span=bridgeAt(grid,point);
  return span!==null&&(span.water.some(candidate=>same(candidate,other))||span.banks.some(candidate=>same(candidate,other)));
}

export function bridgeRemovalTiles(grid:WallGrid,coordinate:TileCoordinate):readonly TileCoordinate[]{
  const removed:TileCoordinate[]=[coordinate];
  for(const candidate of [coordinate,...axes.flatMap(d=>[-1,1].map(sign=>({tx:coordinate.tx+d.tx*sign,ty:coordinate.ty+d.ty*sign})))]){
    const span=bridgeAt(grid,candidate);
    if(span!==null&&(span.water.some(t=>same(t,coordinate))||span.banks.some(t=>same(t,coordinate))))removed.push(...span.water);
  }
  return removed;
}
