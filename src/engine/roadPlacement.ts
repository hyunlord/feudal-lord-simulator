import type { GameState } from "./engine.types";
import { getTile, type TileCoordinate } from "../world/grid";
import { PlacementFailure, placementSpendableResource } from "../world/placement";
import { BRIDGE_MAX_WATER_TILES, BRIDGE_TIMBER_PER_TILE } from "../world/bridges";
import { canTraverseWallBoundary } from "../world/wallTraversal";

export function roadPlacementFailure(state:GameState,path:readonly TileCoordinate[]):PlacementFailure|null {
  const water=path.filter(point=>getTile(state,point)?.terrain==="water");
  if(water.length===0){
    for(const point of path){
      const tile=getTile(state,point);
      if(tile===null)return PlacementFailure.out_of_bounds;
      if(tile.buildingId!==null||tile.hasRoad)return PlacementFailure.occupied;
    }
    return null;
  }
  const first=path[0],last=path.at(-1);
  if(first===undefined||last===undefined||water.length>BRIDGE_MAX_WATER_TILES)return PlacementFailure.wrong_terrain;
  const horizontal=first.ty===last.ty;
  if(first.tx!==last.tx&&!horizontal)return PlacementFailure.wrong_terrain;
  if(getTile(state,first)?.terrain!=="grass"||getTile(state,last)?.terrain!=="grass")return PlacementFailure.wrong_terrain;
  // A bridge drag contains exactly two grass banks and one uninterrupted water span.
  if(path.length!==water.length+2)return PlacementFailure.wrong_terrain;
  for(let index=0;index<path.length;index++){
    const point=path[index];if(point===undefined)continue;
    const tile=getTile(state,point);
    if(tile===null)return PlacementFailure.out_of_bounds;
    if(tile.buildingId!==null||(tile.terrain==="water"&&tile.hasRoad))return PlacementFailure.occupied;
    const previous=path[index-1]??point;
    if(!canTraverseWallBoundary(state,previous,point))return PlacementFailure.wrong_terrain;
    if(tile.terrain!=="water")continue;
    for(const sign of [-1,1]){
      const neighbor=getTile(state,{tx:point.tx+(horizontal?0:sign),ty:point.ty+(horizontal?sign:0)});
      if(neighbor?.terrain==="water"&&neighbor.hasRoad)return PlacementFailure.occupied;
    }
  }
  return placementSpendableResource(state,"timber")<water.length*BRIDGE_TIMBER_PER_TILE?PlacementFailure.insufficient_materials:null;
}

export function roadTimberCost(state:GameState,path:readonly TileCoordinate[]):number {
  return path.filter(point=>getTile(state,point)?.terrain==="water").length*BRIDGE_TIMBER_PER_TILE;
}

export function chargeRoadTimber(state:GameState,cost:number):Pick<GameState,"treasuryTimber"|"buildings"> {
  let remaining=Math.max(0,cost-state.treasuryTimber);
  const buildings=state.buildings.map(building=>{
    const taken=Math.min(remaining,Math.max(0,(building.inventory.timber??0)-(building.stockReserved.timber??0)));
    remaining-=taken;
    return taken===0?building:{...building,inventory:{...building.inventory,timber:(building.inventory.timber??0)-taken}};
  });
  return {treasuryTimber:Math.max(0,state.treasuryTimber-cost),buildings};
}
