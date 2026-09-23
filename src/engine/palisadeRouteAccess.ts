import { constructionMaterialSources } from '../agents/deliveryConstruction';
import { isPalisadeConstructionSite } from '../domain/palisadeConstructionSchedule';
import { availableStock } from '../economy/storage';
import { createDeliveryInventoryPort, createSimulationRoutePorts } from './simulationPorts';
import { projectPalisadeProclamation } from './palisade';
import { computePalisadeProposalForState } from './palisadeFootprints';
import type { GameState } from './engine.types';
import type { PalisadePath, PalisadeProposalResult } from '../world/palisadeGeometry';

export type PalisadeRouteAccess = Readonly<{
  projected: GameState;
  reachableSiteIds: readonly string[];
  unreachableSiteIds: readonly string[];
  unavailableSiteIds: readonly string[];
}>;

const tileLayoutKeys = new WeakMap<GameState['tiles'], string>();
const routeAccessCache = new Map<string, PalisadeRouteAccess>();
const statePreviewCache = new WeakMap<GameState, Map<string, PalisadeRouteAccess>>();
const defaultProposalCache = new Map<string, PalisadeProposalResult>();

function routeAccessKey(state: GameState, path: PalisadePath): string {
  let tiles = tileLayoutKeys.get(state.tiles);
  if (tiles === undefined) {
    tiles = JSON.stringify(state.tiles.map(tile => [tile.terrain, tile.hasRoad, tile.buildingId]));
    tileLayoutKeys.set(state.tiles, tiles);
  }
  return JSON.stringify([
    state.width, state.height, state.era, state.palisade?.id, state.roadRevision, tiles,
    state.nextConstructionOrdinal,
    state.treasuryTimber > 0,
    state.buildings.map(building => [building.id, building.kind, building.tx, building.ty, building.houseLot,
      availableStock(building, 'timber') > 0]),
    state.constructionSites.map(site => 'tx' in site
      ? [site.id, site.kind, site.tx, site.ty]
      : [site.id, site.kind, site.path]), path,
  ]);
}

export function previewPalisadeRouteAccess(state: GameState, path: PalisadePath): PalisadeRouteAccess {
  const pathKey = JSON.stringify(path);
  const previous = statePreviewCache.get(state)?.get(pathKey);
  if (previous !== undefined) return previous;
  const key = routeAccessKey(state, path);
  const cached = routeAccessCache.get(key);
  if (cached !== undefined) {
    statePreviewCache.set(state, new Map([...(statePreviewCache.get(state) ?? []), [pathKey, cached]]));
    return cached;
  }
  const projected = projectPalisadeProclamation(state, path);
  if (projected === state || projected.palisade === null) {
    return { projected, reachableSiteIds: [], unreachableSiteIds: [], unavailableSiteIds: [] };
  }
  const routes = createSimulationRoutePorts(projected).delivery;
  const inventory = createDeliveryInventoryPort();
  const reachableSiteIds: string[] = [];
  const unreachableSiteIds: string[] = [];
  const unavailableSiteIds: string[] = [];
  for (const site of projected.constructionSites.filter(isPalisadeConstructionSite)) {
    if (site.wallId !== projected.palisade.id) continue;
    const sources = constructionMaterialSources({
      site, buildings: projected.buildings, routes, inventory,
      treasuryTimber: projected.treasuryTimber,
    });
    if (sources.some(source => source.hasRoute)) reachableSiteIds.push(site.id);
    else if (sources.length > 0) unreachableSiteIds.push(site.id);
    else unavailableSiteIds.push(site.id);
  }
  const result = { projected, reachableSiteIds, unreachableSiteIds, unavailableSiteIds };
  if (routeAccessCache.size >= 128) routeAccessCache.delete(routeAccessCache.keys().next().value ?? '');
  routeAccessCache.set(key, result);
  statePreviewCache.set(state, new Map([...(statePreviewCache.get(state) ?? []), [pathKey, result]]));
  return result;
}

export function computeReachablePalisadeProposalForState(
  state: GameState,
  acceptPath?: (path: PalisadePath) => boolean,
): PalisadeProposalResult {
  const cacheKey = acceptPath === undefined ? routeAccessKey(state, []) : null;
  const cached = cacheKey === null ? undefined : defaultProposalCache.get(cacheKey);
  if (cached !== undefined) return cached;
  const predicate = acceptPath ?? (() => true);
  const accepted = (path: PalisadePath) => {
    if (!predicate(path)) return false;
    const access = previewPalisadeRouteAccess(state, path);
    return access.unreachableSiteIds.length === 0 && access.unavailableSiteIds.length === 0;
  };
  const reachable = computePalisadeProposalForState(state, accepted);
  const result = reachable.ok ? reachable : computePalisadeProposalForState(state, predicate);
  if (cacheKey !== null) {
    if (defaultProposalCache.size >= 32) defaultProposalCache.delete(defaultProposalCache.keys().next().value ?? '');
    defaultProposalCache.set(cacheKey, result);
  }
  return result;
}
