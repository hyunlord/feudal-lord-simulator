import { RESOURCE_TYPES } from '../content/resourceConfig';
import { BUILDING_CONFIG_BY_KIND } from '../content/buildingConfig';
import { constructionDeliveryNeed, isBuildingConstructionSite } from '../economy/construction';
import { palisadeConstructionSchedule } from '../domain/palisadeConstructionSchedule';
import { availableStock } from '../economy/storage';
import { canPlaceRoad, findExistingRoadPath } from '../world/roadGraph';
import type { WallGrid } from '../world/wallTraversal';
import type { TileCoordinate } from '../world/grid';
import { buildingRoadAccessTiles, constructionSiteRoadAccessTiles, resolveBuildingToConstructionSiteRoute } from './routing';
import { roadPrefixAction } from './autoplayRoadPrefix';
import { serviceSafeRoadAction } from './autoplayServiceSpace';
import type { GameState } from './engine.types';
import type { AutoplayAction } from './autoplay.types';

type CorridorLayout = {
  readonly key: string;
  readonly wall: GameState['palisade'];
  readonly grid: WallGrid;
  readonly paths: Map<string, readonly TileCoordinate[] | null>;
};
const layouts = new WeakMap<GameState['tiles'], CorridorLayout>();
const tileKey = (tile: TileCoordinate): string => `${tile.tx},${tile.ty}`;

function layoutFor(state: GameState): CorridorLayout {
  const plans = state.constructionSites.filter(isBuildingConstructionSite);
  const key = `${state.width}/${state.height}/${plans.map(site => `${site.kind}:${site.tx},${site.ty}`).sort().join(';')}`;
  const cached = layouts.get(state.tiles);
  if (cached?.key === key && cached.wall === state.palisade) return cached;
  const occupied = new Set<string>();
  for (const site of plans) {
    const size = BUILDING_CONFIG_BY_KIND[site.kind];
    for (let y = site.ty; y < site.ty + size.height; y++) for (let x = site.tx; x < site.tx + size.width; x++) occupied.add(`${x},${y}`);
  }
  const grid: WallGrid = { width: state.width, height: state.height, palisade: state.palisade,
    tiles: state.tiles.map(tile => ({ ...tile, hasRoad: tile.hasRoad || (!occupied.has(tileKey(tile)) && canPlaceRoad(state, tile)) })) };
  const result = { key, wall: state.palisade, grid, paths: new Map<string, readonly TileCoordinate[] | null>() };
  layouts.set(state.tiles, result);
  return result;
}

function shortestCorridor(layout: CorridorLayout, starts: readonly TileCoordinate[], targets: readonly TileCoordinate[]): readonly TileCoordinate[] | null {
  const key = `${starts.map(tileKey).join(';')}->${targets.map(tileKey).join(';')}`;
  if (layout.paths.has(key)) return layout.paths.get(key) ?? null;
  let best: readonly TileCoordinate[] | null = null;
  for (const start of starts) for (const destination of targets) {
    const path = findExistingRoadPath(layout.grid, { start, destination });
    if (path !== null && (best === null || path.length < best.length)) best = path;
  }
  if (layout.paths.size >= 128) layout.paths.delete(layout.paths.keys().next().value ?? '');
  layout.paths.set(key, best);
  return best;
}

export function constructionLogisticsAction(state: GameState): AutoplayAction {
  for (const site of [...state.constructionSites].sort((a, b) => a.id.localeCompare(b.id))) {
    if (site.kind !== 'stone_wall_segment' || palisadeConstructionSchedule(site, state.constructionSites).kind !== 'active') continue;
    const need = constructionDeliveryNeed(site);
    for (const resource of RESOURCE_TYPES) {
      if ((need[resource] ?? 0) <= 0) continue;
      for (const source of [...state.buildings].sort((a, b) => a.id.localeCompare(b.id))) {
        if (availableStock(source, resource) <= 0) continue;
        const current = resolveBuildingToConstructionSiteRoute(state, source, site).path;
        if (current === null || current.length === 0) continue;
        const candidate = shortestCorridor(layoutFor(state), buildingRoadAccessTiles(state, source), constructionSiteRoadAccessTiles(state, site));
        if (candidate === null || candidate.length >= current.length) continue;
        const action = serviceSafeRoadAction(state, roadPrefixAction(state, candidate));
        if (action.kind === 'place_road') return action;
      }
      return { kind: 'none' };
    }
  }
  return { kind: 'none' };
}
