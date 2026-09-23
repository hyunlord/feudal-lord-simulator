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
}>;

const tileLayoutKeys = new WeakMap<GameState['tiles'], string>();
const routeAccessCache = new Map<string, Readonly<{ reachableSiteIds: readonly string[]; unreachableSiteIds: readonly string[] }>>();
const statePreviewCache = new WeakMap<GameState, Map<string, PalisadeRouteAccess>>();

function routeAccessKey(state: GameState, path: PalisadePath): string {
  let tiles = tileLayoutKeys.get(state.tiles);
  if (tiles === undefined) {
    tiles = JSON.stringify(state.tiles.map(tile => [tile.terrain, tile.hasRoad, tile.buildingId]));
    tileLayoutKeys.set(state.tiles, tiles);
  }
  return JSON.stringify([
    state.width, state.height, state.roadRevision, tiles, state.nextConstructionOrdinal,
    state.treasuryTimber > 0,
    state.buildings.map(building => [building.id, building.kind, building.tx, building.ty,
      availableStock(building, 'timber') > 0]),
    state.constructionSites.map(site => site.id), path,
  ]);
}

export function previewPalisadeRouteAccess(state: GameState, path: PalisadePath): PalisadeRouteAccess {
  const pathKey = JSON.stringify(path);
  const previous = statePreviewCache.get(state)?.get(pathKey);
  if (previous !== undefined) return previous;
  const projected = projectPalisadeProclamation(state, path);
  if (projected === state || projected.palisade === null) {
    return { projected, reachableSiteIds: [], unreachableSiteIds: [] };
  }
  const key = routeAccessKey(state, path);
  const cached = routeAccessCache.get(key);
  if (cached !== undefined) {
    const result = { projected, ...cached };
    statePreviewCache.set(state, new Map([...(statePreviewCache.get(state) ?? []), [pathKey, result]]));
    return result;
  }
  const routes = createSimulationRoutePorts(projected).delivery;
  const inventory = createDeliveryInventoryPort();
  const reachableSiteIds: string[] = [];
  const unreachableSiteIds: string[] = [];
  for (const site of projected.constructionSites.filter(isPalisadeConstructionSite)) {
    if (site.wallId !== projected.palisade.id) continue;
    const sources = constructionMaterialSources({
      site, buildings: projected.buildings, routes, inventory,
      treasuryTimber: projected.treasuryTimber,
    });
    if (sources.some(source => source.hasRoute)) reachableSiteIds.push(site.id);
    else if (sources.length > 0) unreachableSiteIds.push(site.id);
  }
  if (routeAccessCache.size >= 128) routeAccessCache.delete(routeAccessCache.keys().next().value ?? '');
  routeAccessCache.set(key, { reachableSiteIds, unreachableSiteIds });
  const result = { projected, reachableSiteIds, unreachableSiteIds };
  statePreviewCache.set(state, new Map([...(statePreviewCache.get(state) ?? []), [pathKey, result]]));
  return result;
}

export function computeReachablePalisadeProposalForState(
  state: GameState,
  acceptPath: (path: PalisadePath) => boolean = () => true,
): PalisadeProposalResult {
  const accepted = (path: PalisadePath) => acceptPath(path)
    && previewPalisadeRouteAccess(state, path).unreachableSiteIds.length === 0;
  const reachable = computePalisadeProposalForState(state, accepted);
  return reachable.ok ? reachable : computePalisadeProposalForState(state, acceptPath);
}
