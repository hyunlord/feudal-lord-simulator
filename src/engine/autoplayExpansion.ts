import { BUILDING_CONFIG_BY_KIND, type BuildingKind } from '../content/buildingConfig';
import { isBuildingConstructionSite } from '../economy/construction';
import { canPlaceRoad, existingRoadComponent } from '../world/roadGraph';
import { canTraverseRoadBoundary } from '../world/bridges';
import type { TileCoordinate } from '../world/grid';
import type { GameState } from './engine.types';
import type { AutoplayAction } from './autoplay.types';

const key = (tile: TileCoordinate): string => `${tile.tx},${tile.ty}`;

function compareCoordinates(left: TileCoordinate, right: TileCoordinate): number {
  return left.ty - right.ty || left.tx - right.tx;
}

export function preserveRoadExpansion(state: GameState, candidate: TileCoordinate & { readonly kind: BuildingKind }): AutoplayAction | null {
  const definition = BUILDING_CONFIG_BY_KIND[candidate.kind];
  const occupied = (tile: TileCoordinate): boolean => tile.tx >= candidate.tx && tile.tx < candidate.tx + definition.width && tile.ty >= candidate.ty && tile.ty < candidate.ty + definition.height;
  const directions = [{ tx: 0, ty: -1 }, { tx: -1, ty: 0 }, { tx: 1, ty: 0 }, { tx: 0, ty: 1 }];
  const plans = state.constructionSites.filter(isBuildingConstructionSite);
  const free = (tile: TileCoordinate): boolean => canPlaceRoad(state, tile) && !plans.some(site => {
    const size = BUILDING_CONFIG_BY_KIND[site.kind];
    return tile.tx >= site.tx && tile.tx < site.tx + size.width && tile.ty >= site.ty && tile.ty < site.ty + size.height;
  });
  const visited = new Set<string>();
  const roadTiles = state.tiles.filter(tile => tile.hasRoad).sort(compareCoordinates);
  for (const road of roadTiles) {
    if (visited.has(key(road))) continue;
    const component = [...existingRoadComponent(state, [road])].sort(compareCoordinates);
    for (const point of component) visited.add(key(point));
    const frontiers = component
      .flatMap(point => directions.map(direction => ({ road: point, direction, next: { tx: point.tx + direction.tx, ty: point.ty + direction.ty } })))
      .filter(item => free(item.next))
      .sort((left, right) => compareCoordinates(left.next, right.next));
    if (frontiers.length === 0 || frontiers.some(({ next }) => !occupied(next))) continue;
    for (const { road: source, direction, next } of frontiers) {
      let previous = source;
      let end: TileCoordinate | null = null;
      for (const point of [
        next,
        { tx: next.tx + direction.tx, ty: next.ty + direction.ty },
        { tx: next.tx + direction.tx * 2, ty: next.ty + direction.ty * 2 },
      ]) {
        if (!free(point) || !canTraverseRoadBoundary(state, previous, point)) break;
        end = point;
        previous = point;
      }
      if (end !== null) return { kind: 'place_road', from: next, to: end };
    }
  }
  return null;
}
