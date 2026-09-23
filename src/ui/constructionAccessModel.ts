import type { ConstructionSite } from '../economy/construction';
import { constructionDeliveryNeed, isBuildingConstructionSite } from '../economy/construction';
import { RESOURCE_TYPES } from '../content/resourceConfig';
import { BUILDING_CONFIG_BY_KIND } from '../content/buildingConfig';
import { availableStock } from '../economy/storage';
import { buildingRoadAccessTiles, constructionSiteRoadAccessTiles } from '../engine/routing';
import { createDeliveryInventoryPort, createSimulationRoutePorts } from '../engine/simulationPorts';
import { roadPlacementFailure } from '../engine/roadPlacement';
import { constructionMaterialSources } from '../agents/deliveryConstruction';
import type { GameState } from '../engine/engine.types';
import { canTraverseRoadBoundary } from '../world/bridges';
import { getTile, type TileCoordinate } from '../world/grid';
import { canPlaceRoad, existingRoadComponent } from '../world/roadGraph';

export type ConstructionAccessCause =
  | 'road_disconnected' | 'no_route' | 'wall_blocked'
  | 'no_material' | 'no_workers' | 'reserve_held' | 'none';

export type ConstructionAccessModel = Readonly<{
  cause: ConstructionAccessCause;
  label: string;
  accessTiles: readonly TileCoordinate[];
  suggestedRoad: readonly TileCoordinate[];
  missingRoadTiles: readonly TileCoordinate[];
}>;

const LABELS = {
  road_disconnected: '도로 미연결',
  no_route: '창고에서 경로 없음',
  wall_blocked: '성벽이 경로 차단',
  no_material: '자재 없음',
  no_workers: '일꾼 없음',
  reserve_held: '비축분 유지 중',
  none: '',
} as const satisfies Record<ConstructionAccessCause, string>;

const key = (tile: TileCoordinate): string => `${tile.tx},${tile.ty}`;
const nearby = (tile: TileCoordinate): readonly TileCoordinate[] => [
  { tx: tile.tx, ty: tile.ty - 1 },
  { tx: tile.tx - 1, ty: tile.ty },
  { tx: tile.tx + 1, ty: tile.ty },
  { tx: tile.tx, ty: tile.ty + 1 },
];

function candidateAccessTiles(state: GameState, site: ConstructionSite): readonly TileCoordinate[] {
  const allRoads = { ...state, tiles: state.tiles.map(tile => ({ ...tile, hasRoad: true })) };
  return constructionSiteRoadAccessTiles(allRoads, site)
    .filter(tile => getTile(state, tile)?.terrain !== 'water');
}

function sourceRoads(state: GameState, site: ConstructionSite): readonly TileCoordinate[] {
  const need = constructionDeliveryNeed(site);
  const sourceAccess = state.buildings.filter(building => RESOURCE_TYPES.some(resource =>
    (need[resource] ?? 0) > 0 && availableStock(building, resource) > 0)
    || ((need.timber ?? 0) > 0 && state.treasuryTimber > 0 && building.kind === 'house'))
    .flatMap(building => buildingRoadAccessTiles(state, building));
  return existingRoadComponent(state, sourceAccess);
}

function legalNewRoad(state: GameState, tile: TileCoordinate): boolean {
  if (!canPlaceRoad(state, tile)) return false;
  return !state.constructionSites.some(other => {
    if (!isBuildingConstructionSite(other)) return false;
    const size = BUILDING_CONFIG_BY_KIND[other.kind];
    return tile.tx >= other.tx && tile.tx < other.tx + size.width
      && tile.ty >= other.ty && tile.ty < other.ty + size.height;
  });
}

function hasMaterialRoute(state: GameState, site: ConstructionSite): boolean {
  return constructionMaterialSources({
    site,
    buildings: state.buildings,
    routes: createSimulationRoutePorts(state).delivery,
    inventory: createDeliveryInventoryPort(),
    treasuryTimber: state.treasuryTimber,
  }).some(source => source.hasRoute);
}

function withNewRoads(state: GameState, path: readonly TileCoordinate[]): GameState {
  const added = new Set(path.map(key));
  return {
    ...state,
    tiles: state.tiles.map(tile => added.has(key(tile)) ? { ...tile, hasRoad: true } : tile),
    roadRevision: state.roadRevision + 1,
    pathCache: {},
  };
}

export function roadConnectsConstructionSite(
  state: GameState,
  site: ConstructionSite,
  path: readonly TileCoordinate[],
): boolean {
  if (path.length === 0 || roadPlacementFailure(state, path) !== null || hasMaterialRoute(state, site)) return false;
  return hasMaterialRoute(withNewRoads(state, path), site);
}

export function suggestedConstructionRoad(
  state: GameState,
  site: ConstructionSite,
  accessTiles = candidateAccessTiles(state, site),
): readonly TileCoordinate[] {
  const targets = new Set(accessTiles.map(key));
  const sources = sourceRoads(state, site);
  if (sources.length === 0 || targets.size === 0) return [];
  const queue = [...sources];
  const parents = new Map<string, TileCoordinate | null>(queue.map(tile => [key(tile), null]));
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (current === undefined) break;
    if (targets.has(key(current))) {
      const path: TileCoordinate[] = [];
      let step: TileCoordinate | null = current;
      while (step !== null) {
        path.unshift(step);
        step = parents.get(key(step)) ?? null;
      }
      if (hasMaterialRoute(withNewRoads(state, path), site)) return path;
    }
    for (const next of nearby(current)) {
      if (parents.has(key(next))) continue;
      if (getTile(state, next)?.hasRoad !== true && !legalNewRoad(state, next)) continue;
      if (!canTraverseRoadBoundary(state, current, next)) continue;
      parents.set(key(next), current);
      queue.push(next);
    }
  }
  return [];
}

export function constructionAccessModel(state: GameState, site: ConstructionSite): ConstructionAccessModel {
  const accessTiles = candidateAccessTiles(state, site);
  const existingAccess = constructionSiteRoadAccessTiles(state, site);
  let cause: ConstructionAccessCause = 'none';
  if (site.stall === 'no_builders') cause = 'no_workers';
  else if (site.stall === 'no_material_source') cause = 'no_material';
  else if (site.stall === 'reserve_held') cause = 'reserve_held';
  else if (site.stall === 'no_route' || (existingAccess.length === 0 && site.stall !== 'none')) {
    if (existingAccess.length === 0) cause = 'road_disconnected';
    else {
      const withoutWall = { ...state, palisade: null };
      const wallFreeAccess = constructionSiteRoadAccessTiles(withoutWall, site);
      cause = wallFreeAccess.length > existingAccess.length
        || (sourceRoads(withoutWall, site).length > sourceRoads(state, site).length)
        ? 'wall_blocked' : 'no_route';
    }
  }
  if ((cause === 'road_disconnected' || cause === 'no_route') && state.palisade !== null
    && suggestedConstructionRoad(state, site, accessTiles).length === 0) {
    const withoutWall = { ...state, palisade: null };
    if (suggestedConstructionRoad(withoutWall, site).length > 0) cause = 'wall_blocked';
  }
  const suggestedRoad = cause === 'road_disconnected' || cause === 'no_route'
    ? suggestedConstructionRoad(state, site, accessTiles) : [];
  return {
    cause,
    label: LABELS[cause],
    accessTiles: cause === 'road_disconnected' || cause === 'no_route' || cause === 'wall_blocked' ? accessTiles : [],
    suggestedRoad,
    missingRoadTiles: suggestedRoad.filter(tile => getTile(state, tile)?.hasRoad !== true),
  };
}

export function groupedConstructionCause(state: GameState, cause: ConstructionAccessCause): string | null {
  if (cause === 'none') return null;
  const count = state.constructionSites.filter(site => constructionAccessModel(state, site).cause === cause).length;
  return count > 1 ? `공사 ${count}구간이 같은 이유로 대기: ${LABELS[cause]}` : LABELS[cause];
}
