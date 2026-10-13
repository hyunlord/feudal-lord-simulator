import { preservesAutoplayServiceSpace } from './autoplayServiceSpace';
import { preservesAutoplayWallSpace } from './autoplayWallSpace';
import { BUILDING_CONFIG_BY_KIND, type Building } from '../content/buildingConfig';
import { isBuildingConstructionSite } from '../economy/construction';
import { buildingFootprintDistance } from '../geometry/buildingDistance';
import { housingLotCount } from '../population/housing';
import { availableWorkers } from '../population/labour';
import { rankServiceCandidates } from './autoplayServiceCandidates';
import { rankServiceRoadPlans } from './autoplayServiceRoadPlans';
import { serviceAccessDistances } from './autoplayServiceAccess';
import { canPlaceBuilding, canPlaceBuildingBeforeRoad, isBuildingOpen } from '../world/placement';
import type { GameState } from './engine.types';
import type { AutoplayAction } from './autoplay.types';
import { householdServices } from './householdServices';
import { anotherMarketAllowed, marketRoadService } from './marketService';
import { hasConnectedConstructionRoute } from './autoplayConstructionRoute';
import { plannedBuildingRoadAction, roadActionToTargets } from './autoplayConstructionRoads';
import { hasAutoplayBuildingClearance } from './autoplaySetback';
import { autoplaySearchExhausted, autoplaySearchWorkUsed, spendAutoplaySearch } from './autoplaySearchBudget';
import { autoplayConstructionSources } from './autoplayConstructionSources';
import { operationSuspended } from '../content/buildingConfig';
import { buildingRoadAccessTiles } from './routing';

type UrbanService = 'market' | 'church';
const NONE = { kind: 'none' } as const satisfies AutoplayAction;

function candidateBuilding(kind: UrbanService, tx: number, ty: number): Building {
  return { id: 'autoplay-service-candidate', kind, tx, ty,
    workers: BUILDING_CONFIG_BY_KIND[kind].workersRequired,
    inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
}

export type ServicePlanningReason = 'worker_shortage' | 'facility_limit';
export interface ServicePlanningDiagnostic { readonly service: UrbanService; readonly reason: ServicePlanningReason }
export interface ServicePlanningCollector { services?: readonly ServicePlanningDiagnostic[] }

/**
 * GROW-A (the user's ruling 2026-10-13, P-X1): a lord town whose second church or market finds no site searched again
 * every week at the same layout — 80 % of a year in seed 33 at 718 with five houses out of the church's reach (profile
 * engine-GROWA-prof-277bbcc, 571 s that year). A failed search is remembered by the layout and searched again only
 * when the layout changes.
 *  (a) Key: what the search reads, from the state — the tiles (terrain, roads, occupancy), the buildings without their
 *      stocks (kind, place, staff, the rest of their fields), the construction sites without their deliveries (kind,
 *      place, wall path), the houses (level, residents), the walls, zones, fields, land, the era, scenario and rights,
 *      the idle workers and population, the construction sources (stock-driven membership), the homes wanting the
 *      service, the service and the caller's filter. Never the clock or a tick interval.
 *  (b) Left out: stock magnitudes, deliveries and walkers — the site search reads none (placement, clearance, routes,
 *      wall and service space read the layout; supply reaches it through the sources' identities).
 *  (c) A hit replays the failed search's work on the search budget, so the steps after it see the same budget; a
 *      search the budget cut short is not remembered. Before/after: the judgement run's final-state hashes must match
 *      with and without this memory; seed 33's year times are measured there.
 * Lord mode only (the sandbox guardrail untouched); the last 32 failures kept.
 */
const failedSearches = new Map<string, number>();
const tileSignatures = new WeakMap<GameState['tiles'], string>();
const STOCK_FIELDS = new Set(['inventory', 'reserved', 'stockReserved', 'productionProgress', 'stuckSinceTick']);
const SITE_PROGRESS = new Set(['required', 'delivered', 'reserved', 'builderTicks', 'requiredBuilderTicks', 'assignedBuilders', 'stall', 'startedTick']);
const without = (value: object, drop: ReadonlySet<string>) => Object.entries(value).filter(([field]) => !drop.has(field));

function failedSearchKey(state: GameState, kind: UrbanService, homes: readonly Building[], acceptsKey: string): string {
  let tiles = tileSignatures.get(state.tiles);
  if (tiles === undefined) { tiles = JSON.stringify(state.tiles); tileSignatures.set(state.tiles, tiles); }
  const layout = JSON.stringify([kind, acceptsKey, state.width, state.height, state.era, state.scenarioId, state.idleWorkers, state.population,
    state.buildings.map(building => [without(building, STOCK_FIELDS), operationSuspended(building)]),
    state.constructionSites.map(site => without(site, SITE_PROGRESS)),
    state.houses.map(house => [house.buildingId, house.level, house.residents]),
    state.palisade ?? null, state.zones ?? null, state.arableFields ?? null, state.land ?? null, state.politics?.rights.map(right => right.id) ?? null,
    autoplayConstructionSources(state).map(source => source.id), homes.map(home => home.id)]);
  return `${tiles.length}:${hashText(tiles)}:${layout.length}:${hashText(layout)}`;
}

/** cyrb53: a 53-bit string hash (the key's two halves, with their lengths). */
function hashText(text: string): number {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761); h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

const ACCEPT_ALL = (): boolean => true;

/** `accepts` (BOT-1 AR-7): a further bot filter on the market and church placements; every placement passes by default.
 * `acceptsKey` names the filter for the failed-search memory (none: not remembered). */
export function urbanServiceAction(state: GameState, diagnostic?: ServicePlanningCollector,
  accepts: (action: AutoplayAction) => boolean = ACCEPT_ALL, acceptsKey: string | undefined = accepts === ACCEPT_ALL ? 'all' : undefined): AutoplayAction {
  if (!isBuildingOpen(state, 'market')) return NONE;
  const current = householdServices(state);
  const roadService = marketRoadService(state);
  for (const kind of ['market', 'church'] as const) {
    if (!isBuildingOpen(state, kind)) continue;
    if (state.constructionSites.some(site => isBuildingConstructionSite(site) && site.kind === kind)) continue;
    const underserved = state.buildings.filter(home => home.kind === 'house' && current.houses.has(home.id)
      && current.houses.get(home.id)?.[kind].kind !== 'served');
    if (underserved.length === 0) continue;
    const definition = BUILDING_CONFIG_BY_KIND[kind];
    const providers = state.buildings.filter(building => building.kind === kind);
    // Reuse an existing in-range facility, even if it needs staff, rather than
    // buying another building to disguise a workforce or disconnected-road problem.
    for (const home of underserved) {
      for (const provider of providers.filter(provider => buildingFootprintDistance(home, provider) <= definition.serviceRadius)) {
        const allocation = current.providers.get(provider.id);
        const demand = current.houses.get(home.id)?.[kind].demand ?? 1;
        if (allocation === undefined || allocation.capacity - allocation.used < demand || roadService(home, provider)) continue;
        const allRoads = { ...state, tiles: state.tiles.map(tile => ({ ...tile, hasRoad: true })) };
        const source = buildingRoadAccessTiles(state, home);
        const repair = roadActionToTargets(state, buildingRoadAccessTiles(allRoads, provider), source);
        if (repair.kind !== 'none') return repair;
      }
    }
    const needsBuilding = underserved.filter(home => {
      const access = current.houses.get(home.id)?.[kind];
      const reusable = providers.some(provider => {
        const allocation = current.providers.get(provider.id);
        return allocation !== undefined && allocation.capacity - allocation.used >= (access?.demand ?? 1)
          && buildingFootprintDistance(home, provider) <= definition.serviceRadius;
      });
      return !reusable && (access?.kind === 'missing' || access?.kind === 'outside' || access?.kind === 'capacity');
    });
    if (needsBuilding.length === 0) continue;
    const planned = state.constructionSites.filter(isBuildingConstructionSite);
    // MARKET-1 (MK-2): no count cap on markets; another only while 12 lots or more go unserved (churches keep theirs).
    const capped = kind === 'market'
      ? planned.some(site => site.kind === 'market') || !anotherMarketAllowed(state, current)
      : providers.length + planned.filter(site => site.kind === kind).length >= Math.ceil(housingLotCount(state) / 32) + 1;
    if (capped) {
      if (diagnostic !== undefined) diagnostic.services = [...(diagnostic.services ?? []), { service: kind, reason: 'facility_limit' }];
      continue;
    }
    const committed = state.buildings.reduce((sum, building) => sum + BUILDING_CONFIG_BY_KIND[building.kind].workersRequired, 0)
      + planned.reduce((sum, site) => sum + BUILDING_CONFIG_BY_KIND[site.kind].workersRequired, 0);
    if (state.idleWorkers < definition.workersRequired || availableWorkers(state.population) - committed < definition.workersRequired) {
      if (diagnostic !== undefined) diagnostic.services = [...(diagnostic.services ?? []), { service: kind, reason: 'worker_shortage' }];
      continue;
    }
    const searchKey = acceptsKey === undefined || state.agency === undefined ? null : failedSearchKey(state, kind, needsBuilding, acceptsKey);
    const remembered = searchKey === null ? undefined : failedSearches.get(searchKey);
    if (remembered !== undefined) { spendAutoplaySearch(remembered); continue; }
    const workBefore = autoplaySearchWorkUsed() ?? 0;
    const candidates = state.tiles.flatMap(tile => {
      const candidate = candidateBuilding(kind, tile.tx, tile.ty);
      const covered = needsBuilding.filter(home => buildingFootprintDistance(home, candidate) <= definition.serviceRadius);
      if (covered.length === 0 || !hasAutoplayBuildingClearance(state, kind, tile)
        || !canPlaceBuildingBeforeRoad(state, kind, tile.tx, tile.ty).ok) return [];
      return [{ candidate }];
    });
    const roadDistance = serviceAccessDistances(state);
    const reachable = candidates.filter(({ candidate }) => Number.isFinite(roadDistance(candidate))
      && hasConnectedConstructionRoute(state, candidate));
    const ranked = rankServiceCandidates({ service: kind, allocation: { houses: state.houses, buildings: state.buildings, roadService },
      current, candidates: reachable.map(({ candidate }) => ({ building: candidate, roadDistance: roadDistance(candidate) })) });
    for (const { building: candidate } of ranked) {
      const action = { kind: 'place_building', building: kind, tx: candidate.tx, ty: candidate.ty } as const;
      if (!canPlaceBuilding(state, kind, candidate.tx, candidate.ty).ok || !accepts(action) || !preservesAutoplayWallSpace(state, kind, candidate)
        || !preservesAutoplayServiceSpace(state, action)) continue;
      return action;
    }
    for (const { building: candidate } of rankServiceRoadPlans(state, kind, candidates.map(entry => entry.candidate))) {
      const action = { kind: 'place_building', building: kind, tx: candidate.tx, ty: candidate.ty } as const;
      if (!accepts(action) || !preservesAutoplayWallSpace(state, kind, candidate) || !preservesAutoplayServiceSpace(state, action)) continue;
      const road = plannedBuildingRoadAction(state, candidate);
      if (road.kind !== 'none') return road;
    }
    if (searchKey !== null && !autoplaySearchExhausted()) {
      failedSearches.delete(searchKey);
      failedSearches.set(searchKey, (autoplaySearchWorkUsed() ?? 0) - workBefore);
      if (failedSearches.size > 32) failedSearches.delete(failedSearches.keys().next().value!);
    }
  }
  return NONE;
}
