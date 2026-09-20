import { BUILDING_CONFIG_BY_KIND, type BuildingKind } from '../content/buildingConfig';
import { isBuildingConstructionSite } from '../economy/construction';
import { canPlaceRoad, existingRoadComponent } from '../world/roadGraph';
import { canTraverseRoadBoundary } from '../world/bridges';
import type { TileCoordinate } from '../world/grid';
import { getTile } from '../world/grid';
import type { GameState } from './engine.types';
import type { AutoplayAction } from './autoplay.types';

const key = (tile: TileCoordinate): string => `${tile.tx},${tile.ty}`;
const directions = [{ tx: 0, ty: -1 }, { tx: -1, ty: 0 }, { tx: 1, ty: 0 }, { tx: 0, ty: 1 }] as const;

function compareCoordinates(left: TileCoordinate, right: TileCoordinate): number {
  return left.ty - right.ty || left.tx - right.tx;
}

function reachableRoadSpace(
  state: GameState,
  component: readonly TileCoordinate[],
  free: (tile: TileCoordinate) => boolean,
  excluded: (tile: TileCoordinate) => boolean,
): { readonly tiles: readonly TileCoordinate[]; readonly parents: ReadonlyMap<string, TileCoordinate | null> } {
  const tiles = [...component];
  const parents = new Map<string, TileCoordinate | null>(component.map(tile => [key(tile), null]));
  for (let index = 0; index < tiles.length; index += 1) {
    const current = tiles[index];
    if (current === undefined) continue;
    for (const direction of directions) {
      const next = { tx: current.tx + direction.tx, ty: current.ty + direction.ty };
      if (parents.has(key(next)) || excluded(next) ||
          (!getTile(state, next)?.hasRoad && !free(next)) || !canTraverseRoadBoundary(state, current, next)) continue;
      parents.set(key(next), current);
      tiles.push(next);
    }
  }
  return { tiles, parents };
}

function preserveReachableSpace(
  state: GameState,
  component: readonly TileCoordinate[],
  free: (tile: TileCoordinate) => boolean,
  occupied: (tile: TileCoordinate) => boolean,
): AutoplayAction | null {
  const before = reachableRoadSpace(state, component, free, () => false);
  if (!before.tiles.some(occupied)) return null;
  const after = reachableRoadSpace(state, component, free, occupied);
  const lost = before.tiles.find(tile => !occupied(tile) && !after.parents.has(key(tile)));
  if (lost === undefined) return null;
  const path: TileCoordinate[] = [];
  let point: TileCoordinate | null = lost;
  while (point !== null) {
    path.unshift(point);
    point = before.parents.get(key(point)) ?? null;
  }
  const firstFreeIndex = path.findIndex(tile => !getTile(state, tile)?.hasRoad);
  const from = path[firstFreeIndex];
  const source = path[firstFreeIndex - 1];
  if (from === undefined || source === undefined) return null;
  const direction = { tx: from.tx - source.tx, ty: from.ty - source.ty };
  let to = from;
  for (const next of path.slice(firstFreeIndex + 1)) {
    if (!free(next) || next.tx - to.tx !== direction.tx || next.ty - to.ty !== direction.ty) break;
    to = next;
  }
  return { kind: 'place_road', from, to };
}

export function preserveRoadExpansion(state: GameState, candidate: TileCoordinate & { readonly kind: BuildingKind }): AutoplayAction | null {
  const definition = BUILDING_CONFIG_BY_KIND[candidate.kind];
  const occupied = (tile: TileCoordinate): boolean => tile.tx >= candidate.tx && tile.tx < candidate.tx + definition.width && tile.ty >= candidate.ty && tile.ty < candidate.ty + definition.height;
  const plans = state.constructionSites.filter(isBuildingConstructionSite);
  const free = (tile: TileCoordinate): boolean => canPlaceRoad(state, tile) && !plans.some(site => {
    const size = BUILDING_CONFIG_BY_KIND[site.kind];
    return tile.tx >= site.tx && tile.tx < site.tx + size.width && tile.ty >= site.ty && tile.ty < site.ty + size.height;
  });
  const visited = new Set<string>();
  const components: (readonly TileCoordinate[])[] = [];
  const roadTiles = state.tiles.filter(tile => tile.hasRoad).sort(compareCoordinates);
  for (const road of roadTiles) {
    if (visited.has(key(road))) continue;
    const component = [...existingRoadComponent(state, [road])].sort(compareCoordinates);
    components.push(component);
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
  for (const component of components) {
    const connection = preserveReachableSpace(state, component, free, occupied);
    if (connection !== null) return connection;
  }
  return null;
}
