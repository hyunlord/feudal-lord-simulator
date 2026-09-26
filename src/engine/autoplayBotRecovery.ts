import { BUILDING_CONFIG_BY_KIND, operationSuspended, type Building, type BuildingKind } from '../content/buildingConfig';
import { houseFoodRation } from '../content/houseFoodConfig';
import { HOUSING_CONFIG } from '../content/housingConfig';
import { isBuildingConstructionSite } from '../economy/construction';
import { buildingFootprintDistance } from '../geometry/buildingDistance';
import { footprintCorners, isPointInsidePalisade } from '../world/palisadeGeometry';
import { getOrthogonalRoadNeighbors } from '../world/roadGraph';
import type { TileCoordinate } from '../world/grid';
import { housingLotCount } from '../population/housing';
import { foodFacilityWithinLimit } from './autoplayFoodLimits';
import { buildingRoadAccessTiles } from './routing';
import { allocateHouseServices, type ServiceAllocation } from '../population/serviceAllocation';
import { canPlaceBuilding, canPlaceBuildingBeforeRoad, isBuildingUnlocked, placementSpendableResource } from '../world/placement';
import { householdServices } from './householdServices';
import { anotherMarketAllowed, marketRoadService } from './marketService';
import { serviceAccessDistances } from './autoplayServiceAccess';
import { hasConnectedConstructionRoute } from './autoplayConstructionRoute';
import { hasAutoplayBuildingClearance } from './autoplaySetback';
import { preservesAutoplayWallSpace } from './autoplayWallSpace';
import { rankServiceRoadPlans } from './autoplayServiceRoadPlans';
import { plannedBuildingRoadAction } from './autoplayConstructionRoads';
import { projectServiceAction, serviceCandidate } from './autoplayServiceSpaceRoutes';
import type { AutoplayAction } from './autoplay.types';
import type { GameState } from './engine.types';

/**
 * BOT-1: recoveries for stalls the C3 guardrail exposed (decision LB9). They read the state only (no bot memory, no
 * save field) and act in a walled town while it still has room: once the interior is full neither stall can be
 * mended by placement (seed 3 at 792,000 ticks has no free granary site inside the wall; seed 2 at 408,000 has no free
 * market site that reaches all seven homes, and a third market would pass the facility cap).
 */
export type BotRecoveryKind = 'granary_gap' | 'market_gap' | 'market_relocation' | 'timber_demand' | 'interior_plots' | 'barn_mill' | 'log_overflow';
export interface BotRecoveryDiagnostic {
  readonly kind: BotRecoveryKind;
  readonly houses: readonly string[];
  readonly action: AdvisorAction['kind'];
  readonly building?: BuildingKind;
  readonly tx?: number;
  readonly ty?: number;
  /** Why no building was placed: no site in reach, not enough timber, or (AR-7) it would take the lots' house sites. */
  readonly note?: 'no_site' | 'unaffordable' | 'refused';
}
export interface BotRecoveryCollector { recovery?: readonly BotRecoveryDiagnostic[] }

/**
 * AR-5: the one advisor action beyond the placement set (decision BT6): demolish a house the markets can never reach,
 * so the lot is rebuilt where they do (the game's own `demolish_house`). It is the advisor's outward action type; the
 * placement pipeline inside the advisor keeps `AutoplayAction`.
 */
export interface DemolishHouseAdvice {
  readonly kind: 'demolish_house';
  readonly buildingId: string;
  /** Never set: callers read these off any advisor action. */
  readonly foodTransient?: never;
  readonly materialRecovery?: never;
}
/** F0-B EV-6: rebuild a burnt house (the game's `rebuild_house`), the bot's step after a fire. */
export interface RebuildHouseAdvice {
  readonly kind: 'rebuild_house';
  readonly buildingId: string;
  readonly foodTransient?: never;
  readonly materialRecovery?: never;
}
/** F0-C1 FC-2/FC-3: the bot answers the famine and the petition (the game's `famine_response` / `petition_response`). */
export interface FamineResponseAdvice {
  readonly kind: 'famine_response';
  readonly choice: import("../content/chapterConfig").FamineResponseChoice;
  readonly foodTransient?: never;
  readonly materialRecovery?: never;
}
export interface PetitionResponseAdvice {
  readonly kind: 'petition_response';
  readonly petitionId: string;
  readonly response: import("../content/chapterConfig").PetitionResponse;
  readonly foodTransient?: never;
  readonly materialRecovery?: never;
}
export type AdvisorAction = AutoplayAction | DemolishHouseAdvice | RebuildHouseAdvice | FamineResponseAdvice | PetitionResponseAdvice;

export function recordBotRecovery(collector: BotRecoveryCollector | undefined, kind: BotRecoveryKind, houses: readonly Building[], action: AdvisorAction,
  note?: BotRecoveryDiagnostic['note']): void {
  if (collector === undefined) return;
  const placed = action.kind === 'place_building' ? { building: action.building, tx: action.tx, ty: action.ty } : {};
  collector.recovery = [...(collector.recovery ?? []), { kind, houses: houses.map(home => home.id), action: action.kind, ...placed,
    ...(note === undefined ? {} : { note }) }];
}

/** Fewest stalled homes that count as a gap (one home short of bread is noise, not a distribution hole). */
export const BOT_RECOVERY_MIN_HOUSES = 3;
/** The L3 granary radius, reused as the road reach a granary's distributors serve first. */
const GRANARY_REACH = HOUSING_CONFIG.find(definition => definition.level === 3)?.granaryRadius ?? 12;
/** Candidate granary rings around the stalled homes' centre, nearest first. */
const GRANARY_SITE_RINGS = [4, 8, GRANARY_REACH] as const;

const key = (tile: TileCoordinate): string => `${tile.tx},${tile.ty}`;

/** Road edges from a building's access tiles to every road tile. */
function roadDistancesFrom(state: GameState, building: Building): ReadonlyMap<string, number> {
  const queue = [...buildingRoadAccessTiles(state, building)];
  const distances = new Map(queue.map(tile => [key(tile), 0]));
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (current === undefined) continue;
    const distance = distances.get(key(current)) ?? 0;
    for (const neighbour of getOrthogonalRoadNeighbors(state, current)) {
      if (distances.has(key(neighbour))) continue;
      distances.set(key(neighbour), distance + 1);
      queue.push(neighbour);
    }
  }
  return distances;
}

/** Inside the proclaimed wall line, finished or not (the gaps must be caught while the interior still has room). */
export function insideWall(state: GameState, kind: BuildingKind, coordinate: TileCoordinate): boolean {
  const polygon = state.palisade?.polygon;
  if (polygon === undefined) return false;
  const { width, height } = BUILDING_CONFIG_BY_KIND[kind];
  return footprintCorners({ id: 'autoplay-inside-wall', ...coordinate, width, height }).every(corner => isPointInsidePalisade(corner, polygon));
}

/**
 * `granary_gap`: homes inside the wall down to their last ration whose nearest operating granary is more than
 * GRANARY_REACH road edges away. A granary's two distributors feed nearer homes first, so these homes run dry between
 * visits and never hold bread for the L2 promotion (seed 3: five west homes held at L1, the only granary inside the
 * wall 13–21 edges away, the outer ones 40+ behind the wall).
 */
export function granaryGapHouses(state: GameState): readonly Building[] {
  if (state.palisade === null) return [];
  const granaries = state.buildings.filter(building => building.kind === 'granary' && !operationSuspended(building)
    && building.workers >= BUILDING_CONFIG_BY_KIND.granary.workersRequired);
  const stalled = state.houses.filter(house => house.residents > 0 && house.breadStock <= houseFoodRation(house));
  if (stalled.length < BOT_RECOVERY_MIN_HOUSES) return [];
  const reach = granaries.map(granary => roadDistancesFrom(state, granary));
  const homes = new Map(state.buildings.map(building => [building.id, building]));
  const gap = stalled.flatMap(house => {
    const home = homes.get(house.buildingId);
    if (home === undefined || !insideWall(state, 'house', home)) return [];
    const access = buildingRoadAccessTiles(state, home);
    const nearest = Math.min(...reach.flatMap(distances => access.map(tile => distances.get(key(tile)) ?? Infinity)));
    return nearest > GRANARY_REACH ? [home] : [];
  });
  return gap.length >= BOT_RECOVERY_MIN_HOUSES ? gap : [];
}

function centre(homes: readonly Building[]): Building {
  const tx = Math.round(homes.reduce((sum, home) => sum + home.tx, 0) / homes.length);
  const ty = Math.round(homes.reduce((sum, home) => sum + home.ty, 0) / homes.length);
  return { id: 'autoplay-gap-centre', kind: 'house', tx, ty, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
}

export type GapBuildAction = (state: GameState, kind: BuildingKind, accepts: (coordinate: TileCoordinate) => boolean) => AutoplayAction;

/** One granary inside the wall beside the gap homes, nearest ring first (the placement search and its road fallback). */
export function granaryGapAction(state: GameState, build: GapBuildAction, collector?: BotRecoveryCollector): AutoplayAction {
  const none = { kind: 'none' } as const;
  if (state.palisade === null || !foodFacilityWithinLimit(state, 'granary')
    || state.constructionSites.some(site => isBuildingConstructionSite(site) && site.kind === 'granary')) return none;
  const gap = granaryGapHouses(state);
  if (gap.length === 0) return none;
  if ((BUILDING_CONFIG_BY_KIND.granary.buildCost.timber ?? 0) > placementSpendableResource(state, 'timber')) {
    recordBotRecovery(collector, 'granary_gap', gap, none, 'unaffordable');
    return none;
  }
  const middle = centre(gap);
  for (const ring of GRANARY_SITE_RINGS) {
    const action = build(state, 'granary', coordinate => insideWall(state, 'granary', coordinate)
      && buildingFootprintDistance(middle, { ...middle, kind: 'granary', tx: coordinate.tx, ty: coordinate.ty }) <= ring);
    if (action.kind !== 'none') {
      recordBotRecovery(collector, 'granary_gap', gap, action);
      return action;
    }
  }
  recordBotRecovery(collector, 'granary_gap', gap, none, 'no_site');
  return none;
}

const SERVICES = ['water', 'market', 'church'] as const;

/**
 * `market_gap`: homes that stand outside every market's reach (inside the wall once one is proclaimed) while the
 * town-wide service planner places none (seed 2: seven homes at L3 with every other L4 requirement met for 300,000+
 * ticks, the one market 17/24 used but more than 8 tiles away). The service-space guard
 * (`preservesAutoplayServiceSpace`) rejects every market site there because the town's future-layout plan is already
 * impossible, and it keeps rejecting them.
 */
export function marketGapHouses(state: GameState): readonly Building[] {
  if (marketCapReached(state)) return [];
  const services = householdServices(state);
  const homes = new Map(state.buildings.map(building => [building.id, building]));
  const gap = state.houses.flatMap(house => {
    const home = homes.get(house.buildingId);
    const served = services.houses.get(house.buildingId);
    if (home === undefined || served === undefined || house.residents === 0 || served.market.kind !== 'outside'
      || (state.palisade !== null && !insideWall(state, 'house', home))) return [];
    return [home];
  });
  return gap.length >= BOT_RECOVERY_MIN_HOUSES ? gap : [];
}

/** MARKET-1 (MK-2): no further market is allowed (fewer than 12 lots unserved) — the cap the planner and the guardrail keep. */
function marketCapReached(state: GameState): boolean {
  return !anotherMarketAllowed(state, householdServices(state));
}

const marketAffordable = (state: GameState): boolean =>
  (BUILDING_CONFIG_BY_KIND.market.buildCost.timber ?? 0) <= placementSpendableResource(state, 'timber');

const servedIds = (allocation: ServiceAllocation, service: typeof SERVICES[number]): ReadonlySet<string> =>
  new Set([...allocation.houses].filter(([, access]) => access[service].kind === 'served').map(([id]) => id));

/** Gap homes a market at `candidate` would serve, or null when any home would lose a service it has now. */
function marketGain(state: GameState, current: ServiceAllocation, gap: readonly Building[], candidate: Building): number | null {
  const projected = projectServiceAction(state, { kind: 'place_building', building: 'market', tx: candidate.tx, ty: candidate.ty });
  const next = allocateHouseServices({ houses: projected.houses, buildings: projected.buildings, roadService: marketRoadService(projected) });
  for (const service of SERVICES) {
    const after = servedIds(next, service);
    if ([...servedIds(current, service)].some(id => !after.has(id))) return null;
  }
  const after = servedIds(next, 'market');
  return gap.filter(home => after.has(home.id)).length;
}

/** A market that serves the most gap homes without taking a service from anyone; a road toward one otherwise. */
export function marketGapAction(state: GameState, collector?: BotRecoveryCollector): AutoplayAction {
  const none = { kind: 'none' } as const;
  const definition = BUILDING_CONFIG_BY_KIND.market;
  if (!isBuildingUnlocked('market', state.era, state.scenarioId)
    || state.constructionSites.some(site => isBuildingConstructionSite(site) && site.kind === 'market')
    || state.idleWorkers < definition.workersRequired) return none;
  const gap = marketGapHouses(state);
  if (gap.length === 0) return none;
  if (!marketAffordable(state)) {
    recordBotRecovery(collector, 'market_gap', gap, none, 'unaffordable');
    return none;
  }
  const current = householdServices(state);
  const candidates = state.tiles.flatMap(tile => {
    const candidate = serviceCandidate('market', tile, 'autoplay-market-gap');
    if (!gap.some(home => buildingFootprintDistance(home, candidate) <= definition.serviceRadius)
      || !hasAutoplayBuildingClearance(state, 'market', tile) || !canPlaceBuildingBeforeRoad(state, 'market', tile.tx, tile.ty).ok
      || !preservesAutoplayWallSpace(state, 'market', tile)) return [];
    return [candidate];
  });
  const roadDistance = serviceAccessDistances(state);
  const ranked = candidates.flatMap(candidate => {
    const distance = roadDistance(candidate);
    if (!Number.isFinite(distance) || !canPlaceBuilding(state, 'market', candidate.tx, candidate.ty).ok || !hasConnectedConstructionRoute(state, candidate)) return [];
    const gain = marketGain(state, current, gap, candidate);
    return gain === null || gain === 0 ? [] : [{ candidate, gain, distance }];
  }).sort((a, b) => b.gain - a.gain || a.distance - b.distance || a.candidate.ty - b.candidate.ty || a.candidate.tx - b.candidate.tx);
  const best = ranked[0];
  if (best !== undefined) {
    const action = { kind: 'place_building', building: 'market', tx: best.candidate.tx, ty: best.candidate.ty } as const;
    recordBotRecovery(collector, 'market_gap', gap, action);
    return action;
  }
  for (const { building } of rankServiceRoadPlans(state, 'market', candidates)) {
    const road = plannedBuildingRoadAction(state, building);
    if (road.kind !== 'none') {
      recordBotRecovery(collector, 'market_gap', gap, road);
      return road;
    }
  }
  recordBotRecovery(collector, 'market_gap', gap, none, 'no_site');
  return none;
}

/** AR-5 with MARKET-1 (MK-2): the markets are at their cap when no further market is allowed and none is being built. */
function marketsAtTargetCap(state: GameState, _targetLots: number): readonly Building[] | null {
  const markets = state.buildings.filter(building => building.kind === 'market');
  if (markets.length === 0 || !marketCapReached(state)
    || state.constructionSites.some(site => isBuildingConstructionSite(site) && site.kind === 'market')) return null;
  return markets;
}

/**
 * AR-5 `market_relocation`: homes with residents outside every market's reach (inside the wall once one is
 * proclaimed) while the markets already fill the cap for the policy's lots. No placement can serve them any more
 * (seed 2: the palisade took the last site that reached (46,39); two markets reach 23 of 24 homes).
 */
export function strandedMarketHouses(state: GameState, targetLots: number): readonly Building[] {
  if (marketsAtTargetCap(state, targetLots) === null) return [];
  const services = householdServices(state);
  const homes = new Map(state.buildings.map(building => [building.id, building]));
  return state.houses.flatMap(house => {
    const home = homes.get(house.buildingId);
    if (home === undefined || house.residents === 0 || services.houses.get(house.buildingId)?.market.kind !== 'outside'
      || (state.palisade !== null && !insideWall(state, 'house', home))) return [];
    return [home];
  });
}

/**
 * At the lot target the advisor demolishes one stranded home; the housing rule then rebuilds the lot where a standing
 * market reaches it (`keepsHouseInMarketReach`). Below the target nothing is demolished, so a regrowing town is never
 * thinned twice.
 */
export function marketRelocationAction(state: GameState, targetLots: number, collector?: BotRecoveryCollector): AdvisorAction {
  const stranded = strandedMarketHouses(state, targetLots);
  if (stranded.length === 0 || housingLotCount(state) < targetLots) return { kind: 'none' };
  const target = [...stranded].sort((a, b) => a.id.localeCompare(b.id))[0]!;
  const action: DemolishHouseAdvice = { kind: 'demolish_house', buildingId: target.id };
  recordBotRecovery(collector, 'market_relocation', stranded, action);
  return action;
}

/**
 * Once the markets fill the cap for the policy's lots, a new house goes only where a standing market reaches it, and
 * inside the wall when there is one (otherwise the lot could never reach L4). Before that, every site passes.
 */
export function keepsHouseInMarketReach(state: GameState, targetLots: number): (coordinate: TileCoordinate) => boolean {
  const markets = marketsAtTargetCap(state, targetLots);
  if (markets === null) return () => true;
  const reach = BUILDING_CONFIG_BY_KIND.market.serviceRadius;
  return coordinate => {
    const home: Building = { id: 'autoplay-market-reach-house', kind: 'house', tx: coordinate.tx, ty: coordinate.ty,
      workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
    return (state.palisade === null || insideWall(state, 'house', coordinate))
      && markets.some(market => buildingFootprintDistance(home, market) <= reach);
  };
}
