import { buildingFootprint } from '../geometry/buildingFootprint';
import { BUILDING_CONFIG_BY_KIND, type Building } from '../content/buildingConfig';
import { isBuildingConstructionSite } from '../economy/construction';
import { canTraverseRoadBoundary } from '../world/bridges';
import { canPlaceRoad, existingRoadComponent } from '../world/roadGraph';
import { getTile, type TileCoordinate } from '../world/grid';
import { buildingRoadAccessTiles, constructionSiteRoadAccessTiles } from './routing';
import type { GameState } from './engine.types';
import type { AutoplayAction } from './autoplay.types';

const key = (tile: TileCoordinate): string => `${tile.tx},${tile.ty}`;

export function constructionRoadAction(state: GameState): AutoplayAction {
  const stalled = state.constructionSites.filter(site => site.stall === 'no_route' || constructionSiteRoadAccessTiles(state, site).length === 0);
  if (stalled.length === 0) return { kind: 'none' };
  const allRoads = { ...state, tiles: state.tiles.map(tile => ({ ...tile, hasRoad: true })) };
  return roadActionToTargets(state, stalled.flatMap(site => constructionSiteRoadAccessTiles(allRoads, site)));
}

export function roadActionToTargets(state: GameState, accessTiles: readonly TileCoordinate[], sourceTiles?: readonly TileCoordinate[]): AutoplayAction {
  const targets = new Set(accessTiles.map(key));
  const plans = state.constructionSites.filter(isBuildingConstructionSite);
  const free = (tile: TileCoordinate): boolean => canPlaceRoad(state, tile) && !plans.some(site => {
    const size = BUILDING_CONFIG_BY_KIND[site.kind];
    return tile.tx >= site.tx && tile.tx < site.tx + size.width && tile.ty >= site.ty && tile.ty < site.ty + size.height;
  });
  const sources = state.buildings.filter(building => building.kind === "storehouse" || (building.inventory.timber ?? 0) > 0 || (building.inventory.stone ?? 0) > 0 || (state.treasuryTimber > 0 && building.kind === "house"));
  const queue = [...existingRoadComponent(state, sourceTiles ?? sources.flatMap(building => buildingRoadAccessTiles(state, building)))];
  const parents = new Map<string, TileCoordinate | null>(queue.map(tile => [key(tile), null]));
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (current === undefined) break;
    if (targets.has(key(current)) && parents.get(key(current)) !== null) {
      const path: TileCoordinate[] = [];
      let point: TileCoordinate | null = current;
      while (point !== null) {
        path.unshift(point);
        point = parents.get(key(point)) ?? null;
      }
      if (getTile(state, path.at(-1) ?? current)?.hasRoad) path.pop();
      const from = path[1];
      const source = path[0];
      if (from === undefined || source === undefined) continue;
      let to = from;
      for (const next of path.slice(2)) {
        if (getTile(state, next)?.hasRoad) break;
        if ((next.tx - to.tx) !== (from.tx - source.tx) || (next.ty - to.ty) !== (from.ty - source.ty)) break;
        to = next;
      }
      return { kind: 'place_road', from, to };
    }
    for (const next of [{ tx: current.tx, ty: current.ty - 1 }, { tx: current.tx - 1, ty: current.ty }, { tx: current.tx + 1, ty: current.ty }, { tx: current.tx, ty: current.ty + 1 }]) {
      if (parents.has(key(next)) || (!getTile(state, next)?.hasRoad && !free(next)) || !canTraverseRoadBoundary(state, current, next)) continue;
      parents.set(key(next), current);
      queue.push(next);
    }
  }
  return { kind: 'none' };
}

export function plannedBuildingRoadAction(state: GameState, candidate: Building): AutoplayAction {
  const footprint = buildingFootprint(candidate);
  const planned = { ...state, tiles: state.tiles.map(tile =>
    tile.tx >= candidate.tx && tile.tx < candidate.tx + footprint.width && tile.ty >= candidate.ty && tile.ty < candidate.ty + footprint.height
      ? { ...tile, buildingId: candidate.id } : tile) };
  const allRoads = { ...planned, tiles: planned.tiles.map(tile => ({ ...tile, hasRoad: true })) };
  return roadActionToTargets(planned, buildingRoadAccessTiles(allRoads, candidate));
}
