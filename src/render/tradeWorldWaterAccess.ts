import type { GameState } from '../engine/engine.types';
import type { TileCoordinate } from '../geometry/tileGeometry';
import { buildingFootprint } from '../geometry/buildingFootprint';
import { BUILDING_CONFIG_BY_KIND } from '../content/buildingConfig';
import { isBuildingConstructionSite } from '../economy/constructionSiteAccessors';
import { canTraverseWallBoundary } from '../world/wallTraversal';

const within = (a: TileCoordinate, b: TileCoordinate) => Math.max(Math.abs(a.tx - b.tx), Math.abs(a.ty - b.ty)) <= 3;
/** Existing wells get one cell of render clearance; this is not an unmodelled river-intake guarantee. */
export function tradeWaterCellBlocked(state: GameState, cell: TileCoordinate): boolean {
  if (state.buildings.some(building => {
    const size = buildingFootprint(building), margin = building.kind === 'well' ? 1 : 0;
    return cell.tx >= building.tx - margin && cell.tx < building.tx + size.width + margin
      && cell.ty >= building.ty - margin && cell.ty < building.ty + size.height + margin;
  })) return true;
  return state.constructionSites.some(site => {
    if (!isBuildingConstructionSite(site)) return false;
    const size = BUILDING_CONFIG_BY_KIND[site.kind];
    return cell.tx >= site.tx && cell.tx < site.tx + size.width && cell.ty >= site.ty && cell.ty < site.ty + size.height;
  });
}
/** Search current dry ground to an adjacent water cell inside the household's existing three-cell suitability radius. */
export function tradeWatersideCells(state: GameState, house: TileCoordinate): readonly TileCoordinate[] {
  const candidates: TileCoordinate[] = [];
  for (let ty = Math.max(0, house.ty - 3); ty <= Math.min(state.height - 1, house.ty + 3); ty++) {
    for (let tx = Math.max(0, house.tx - 3); tx <= Math.min(state.width - 1, house.tx + 3); tx++) {
      const cell = { tx, ty }, tile = state.tiles[ty * state.width + tx];
      if (tile?.terrain === 'grass' && !tile.hasRoad && tile.buildingId === null && !tradeWaterCellBlocked(state, cell)) candidates.push(cell);
    }
  }
  return candidates.filter(start => {
    const queue = [start], seen = new Set([start.ty * state.width + start.tx]);
    for (const cell of queue) for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]] as const) {
      const next = { tx: cell.tx + dx, ty: cell.ty + dy };
      if (next.tx < 0 || next.ty < 0 || next.tx >= state.width || next.ty >= state.height || !within(next, house)) continue;
      const at = next.ty * state.width + next.tx, tile = state.tiles[at];
      if (seen.has(at) || tile === undefined || tile.buildingId !== null || tradeWaterCellBlocked(state, next)
        || !canTraverseWallBoundary(state, cell, next)) continue;
      if (tile.terrain === 'water') return true;
      if (tile.terrain !== 'grass') continue;
      seen.add(at); queue.push(next);
    }
    return false;
  });
}
