import type { GameState } from "./engine.types";
import { getTile, type TileCoordinate } from "../world/grid";
import { PlacementFailure, placementSpendableResource } from "../world/placement";
import { BRIDGE_MAX_WATER_TILES, BRIDGE_TIMBER_PER_TILE, bridgeAt } from "../world/bridges";
import { canTraverseWallBoundary } from "../world/wallTraversal";

export type RoadPlacementAssessment = {
  readonly failure: PlacementFailure | null;
  readonly newTiles: readonly TileCoordinate[];
  readonly existingTiles: readonly TileCoordinate[];
};

/** Existing road and bridge cells are traversed without replacement or cost; invalid cells reject the full drag. */
export function roadPlacementAssessment(state: GameState, path: readonly TileCoordinate[]): RoadPlacementAssessment {
  const newTiles: TileCoordinate[] = [];
  const existingTiles: TileCoordinate[] = [];
  const result = (failure: PlacementFailure | null): RoadPlacementAssessment => ({ failure, newTiles, existingTiles });
  if (path.length === 0) return result(PlacementFailure.wrong_terrain);
  for (const point of path) {
    const tile = getTile(state, point);
    if (tile === null) return result(PlacementFailure.out_of_bounds);
    if (tile.buildingId !== null) return result(PlacementFailure.occupied);
    (tile.hasRoad ? existingTiles : newTiles).push(point);
  }
  const first = path[0], last = path.at(-1);
  if (first === undefined || last === undefined) return result(PlacementFailure.wrong_terrain);
  const horizontal = first.ty === last.ty;
  if (first.tx !== last.tx && !horizontal) return result(PlacementFailure.wrong_terrain);
  const waterIndexes = path.flatMap((point, index) => getTile(state, point)?.terrain === 'water' ? [index] : []);
  if (waterIndexes.length === 0) return result(null);
  const newWaterIndexes = waterIndexes.filter(index => {
    const point = path[index];
    return point !== undefined && getTile(state, point)?.hasRoad !== true;
  });
  const newWaterStart = newWaterIndexes[0], newWaterEnd = newWaterIndexes.at(-1);
  if (newWaterIndexes.length > BRIDGE_MAX_WATER_TILES
    || (newWaterStart !== undefined && newWaterEnd !== undefined
      && newWaterEnd - newWaterStart + 1 !== newWaterIndexes.length)) return result(PlacementFailure.wrong_terrain);
  const additions = new Set(newTiles.map(point => `${point.tx},${point.ty}`));
  const projected = { ...state, tiles: state.tiles.map(tile => additions.has(`${tile.tx},${tile.ty}`)
    ? { ...tile, hasRoad: true } : tile) };
  for (let index = 0; index < path.length; index += 1) {
    const point = path[index];
    if (point === undefined) continue;
    if (!canTraverseWallBoundary(state, path[index - 1] ?? point, point)) return result(PlacementFailure.wrong_terrain);
    if (getTile(state, point)?.terrain !== 'water') continue;
    if (bridgeAt(projected, point) === null) return result(PlacementFailure.wrong_terrain);
    if (getTile(state, point)?.hasRoad === true) continue;
    for (const sign of [-1, 1]) {
      const neighbor = getTile(state, { tx: point.tx + (horizontal ? 0 : sign), ty: point.ty + (horizontal ? sign : 0) });
      if (neighbor?.terrain === 'water' && neighbor.hasRoad) return result(PlacementFailure.occupied);
    }
  }
  return placementSpendableResource(state, 'timber') < newWaterIndexes.length * BRIDGE_TIMBER_PER_TILE
    ? result(PlacementFailure.insufficient_materials) : result(null);
}

export function roadPlacementFailure(state: GameState, path: readonly TileCoordinate[]): PlacementFailure | null {
  return roadPlacementAssessment(state, path).failure;
}

export function roadTimberCost(state:GameState,path:readonly TileCoordinate[]):number {
  return path.filter(point => {
    const tile = getTile(state, point);
    return tile?.terrain === 'water' && !tile.hasRoad;
  }).length * BRIDGE_TIMBER_PER_TILE;
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
