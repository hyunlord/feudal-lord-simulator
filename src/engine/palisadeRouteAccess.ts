import { constructionMaterialSources } from '../agents/deliveryConstruction';
import { isPalisadeConstructionSite } from '../domain/palisadeConstructionSchedule';
import { createPalisadeConstructionSite, type PalisadeConstructionSite } from '../economy/construction';
import { availableStock } from '../economy/storage';
import { buildingRoadAccessTiles, resolveDirectBuildingToConstructionSiteRoute } from './routing';
import { wallCarryRoute } from './wallCarryRoute';
import { createDeliveryInventoryPort, createSimulationRoutePorts } from './simulationPorts';
import { projectPalisadeProclamation } from './palisade';
import { computePalisadeProposalForState } from './palisadeFootprints';
import { PALISADE_SEGMENT_SITE_STEPS, segmentPalisadePathForConstruction } from './palisadeSegments';
import type { GameState } from './engine.types';
import { palisadePerimeterSteps, type PalisadePath, type PalisadeProposalResult, type TileEdgePoint } from '../world/palisadeGeometry';

export type PalisadeRouteSegment = Readonly<{
  siteId: string;
  path: PalisadePath;
  tileCount: number;
  status: 'reachable' | 'unreachable' | 'unavailable';
  access: 'direct' | 'wall' | 'none';
  wallDistance: number | null;
}>;

export type PalisadeRouteAccess = Readonly<{
  projected: GameState;
  provisional: boolean;
  segments: readonly PalisadeRouteSegment[];
  gates: readonly TileEdgePoint[];
  reachableSiteIds: readonly string[];
  unreachableSiteIds: readonly string[];
  unavailableSiteIds: readonly string[];
}>;

const tileLayoutKeys = new WeakMap<GameState['tiles'], string>();
const routeAccessCache = new Map<string, PalisadeRouteAccess>();
const statePreviewCache = new WeakMap<GameState, Map<string, PalisadeRouteAccess>>();
const provisionalPreviewCache = new WeakMap<GameState, Map<string, PalisadeRouteAccess>>();
const provisionalRouteCache = new Map<string, PalisadeRouteAccess>();
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
    return { projected, provisional: false, segments: [], gates: [],
      reachableSiteIds: [], unreachableSiteIds: [], unavailableSiteIds: [] };
  }
  const sites = projected.constructionSites.filter(isPalisadeConstructionSite)
    .filter(site => site.wallId === projected.palisade?.id);
  const result = auditPalisadeSites(projected, sites, false,
    [projected.palisade.gate, ...(projected.palisade.additionalGates ?? [])]);
  if (routeAccessCache.size >= 128) routeAccessCache.delete(routeAccessCache.keys().next().value ?? '');
  routeAccessCache.set(key, result);
  statePreviewCache.set(state, new Map([...(statePreviewCache.get(state) ?? []), [pathKey, result]]));
  return result;
}

function auditPalisadeSites(
  projected: GameState,
  sites: readonly PalisadeConstructionSite[],
  provisional: boolean,
  gates: readonly TileEdgePoint[],
): PalisadeRouteAccess {
  const routes = createSimulationRoutePorts(projected).delivery;
  const inventory = createDeliveryInventoryPort();
  const segments: PalisadeRouteSegment[] = [];
  const reachableSiteIds: string[] = [];
  const unreachableSiteIds: string[] = [];
  const unavailableSiteIds: string[] = [];
  for (const site of sites) {
    const sources = constructionMaterialSources({
      site, buildings: projected.buildings, routes, inventory,
      treasuryTimber: projected.treasuryTimber,
    });
    const status = sources.some(source => source.hasRoute) ? 'reachable'
      : sources.length > 0 ? 'unreachable' : 'unavailable';
    const stocked = sources.filter(source => source.hasRoute).flatMap(source => source.id === 'treasury'
      ? projected.buildings.filter(building => building.kind === 'house')
      : projected.buildings.filter(building => building.id === source.id));
    const direct = stocked.some(building => resolveDirectBuildingToConstructionSiteRoute(projected, building, site) !== null);
    const distances = stocked.flatMap(building => {
      const route = wallCarryRoute(projected, buildingRoadAccessTiles(projected, building), site);
      return route === null ? [] : [route.wallSteps];
    });
    const access = status !== 'reachable' ? 'none' : direct ? 'direct' : 'wall';
    const wallDistance = access === 'wall' && distances.length > 0 ? Math.min(...distances) : null;
    segments.push({ siteId: site.id, path: site.path, tileCount: palisadePerimeterSteps(site.path),
      status, access, wallDistance });
    switch (status) {
      case 'reachable': reachableSiteIds.push(site.id); break;
      case 'unreachable': unreachableSiteIds.push(site.id); break;
      case 'unavailable': unavailableSiteIds.push(site.id); break;
    }
  }
  return { projected, provisional, segments, gates,
    reachableSiteIds, unreachableSiteIds, unavailableSiteIds };
}

export function previewPalisadeDraftRouteAccess(state: GameState, path: PalisadePath): PalisadeRouteAccess {
  const pathKey = JSON.stringify(path);
  const previous = provisionalPreviewCache.get(state)?.get(pathKey);
  if (previous !== undefined) return previous;
  const key = routeAccessKey(state, path);
  const cached = provisionalRouteCache.get(key);
  if (cached !== undefined) {
    provisionalPreviewCache.set(state, new Map([...(provisionalPreviewCache.get(state) ?? []), [pathKey, cached]]));
    return cached;
  }
  const exact = previewPalisadeRouteAccess(state, path);
  if (exact.projected !== state) return exact;
  const wallId = `draft-${state.nextConstructionOrdinal}`;
  const sites = segmentPalisadePathForConstruction(path).map((segment, index) =>
    createPalisadeConstructionSite({
      id: `${wallId}-segment-${String(index).padStart(3, '0')}`,
      wallId, segmentIndex: index, gateDistance: index * PALISADE_SEGMENT_SITE_STEPS, order: index,
      path: segment.path, startedTick: state.tick,
    }));
  const projected = { ...state, constructionSites: [...state.constructionSites, ...sites] };
  const result = auditPalisadeSites(projected, sites, true, []);
  if (provisionalRouteCache.size >= 128) provisionalRouteCache.delete(provisionalRouteCache.keys().next().value ?? '');
  provisionalRouteCache.set(key, result);
  provisionalPreviewCache.set(state, new Map([...(provisionalPreviewCache.get(state) ?? []), [pathKey, result]]));
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
