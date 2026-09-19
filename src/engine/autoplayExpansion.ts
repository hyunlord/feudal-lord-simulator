import { BUILDING_CONFIG_BY_KIND, type BuildingKind } from '../content/buildingConfig';
import { isBuildingConstructionSite } from '../economy/construction';
import { canPlaceRoad } from '../world/roadGraph';
import { canTraverseRoadBoundary } from '../world/bridges';
import type { TileCoordinate } from '../world/grid';
import type { GameState } from './engine.types';
import type { AutoplayAction } from './autoplay.types';

export function preserveRoadExpansion(state: GameState, candidate: TileCoordinate & { readonly kind: BuildingKind }): AutoplayAction | null {
  const definition = BUILDING_CONFIG_BY_KIND[candidate.kind];
  const occupied = (tile: TileCoordinate): boolean => tile.tx >= candidate.tx && tile.tx < candidate.tx + definition.width && tile.ty >= candidate.ty && tile.ty < candidate.ty + definition.height;
  const directions = [{ tx: 0, ty: -1 }, { tx: -1, ty: 0 }, { tx: 1, ty: 0 }, { tx: 0, ty: 1 }];
  const plans = state.constructionSites.filter(isBuildingConstructionSite);
  const free = (tile: TileCoordinate): boolean => canPlaceRoad(state, tile) && !plans.some(site => {
    const size = BUILDING_CONFIG_BY_KIND[site.kind];
    return tile.tx >= site.tx && tile.tx < site.tx + size.width && tile.ty >= site.ty && tile.ty < site.ty + size.height;
  });
  const frontiers = state.tiles.filter(tile => tile.hasRoad).flatMap(road => directions.map(direction => ({ road, direction, next: { tx: road.tx + direction.tx, ty: road.ty + direction.ty } }))).filter(item => free(item.next));
  const exits = frontiers.filter(({ direction, next }) => [next, { tx: next.tx + direction.tx, ty: next.ty + direction.ty }, { tx: next.tx + direction.tx * 2, ty: next.ty + direction.ty * 2 }].every(free));
  if (exits.some(({ direction, next }) => [next, { tx: next.tx + direction.tx, ty: next.ty + direction.ty }, { tx: next.tx + direction.tx * 2, ty: next.ty + direction.ty * 2 }].every(tile => !occupied(tile)))) return null;
  for (const { road, direction, next } of exits) {
    const end = { tx: next.tx + direction.tx * 2, ty: next.ty + direction.ty * 2 };
    const middle = { tx: next.tx + direction.tx, ty: next.ty + direction.ty };
    if (!free(middle) || !free(end)) continue;
    if (![next, middle, end].every(point => canTraverseRoadBoundary(state, road, point))) continue;
    return { kind: 'place_road', from: next, to: end };
  }
  return null;
}
