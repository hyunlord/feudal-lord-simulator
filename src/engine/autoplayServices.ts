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
import { canPlaceBuilding, isBuildingUnlocked } from '../world/placement';
import type { GameState } from './engine.types';
import type { AutoplayAction } from './autoplay.types';
import { householdServices } from './householdServices';
import { marketRoadService } from './marketService';
import { hasConnectedConstructionRoute } from './autoplayConstructionRoute';
import { plannedBuildingRoadAction, roadActionToTargets } from './autoplayConstructionRoads';
import { hasAutoplayBuildingClearance } from './autoplaySetback';
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

export function urbanServiceAction(state: GameState, diagnostic?: ServicePlanningCollector): AutoplayAction {
  if (!isBuildingUnlocked('market', state.era)) return NONE;
  const current = householdServices(state);
  const roadService = marketRoadService(state);
  for (const kind of ['market', 'church'] as const) {
    if (!isBuildingUnlocked(kind, state.era)) continue;
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
    const cap = Math.ceil(housingLotCount(state) / (kind === 'market' ? 24 : 32)) + 1;
    if (providers.length + planned.filter(site => site.kind === kind).length >= cap) {
      if (diagnostic !== undefined) diagnostic.services = [...(diagnostic.services ?? []), { service: kind, reason: 'facility_limit' }];
      continue;
    }
    const committed = state.buildings.reduce((sum, building) => sum + BUILDING_CONFIG_BY_KIND[building.kind].workersRequired, 0)
      + planned.reduce((sum, site) => sum + BUILDING_CONFIG_BY_KIND[site.kind].workersRequired, 0);
    if (state.idleWorkers < definition.workersRequired || availableWorkers(state.population) - committed < definition.workersRequired) {
      if (diagnostic !== undefined) diagnostic.services = [...(diagnostic.services ?? []), { service: kind, reason: 'worker_shortage' }];
      continue;
    }
    const candidates = state.tiles.flatMap(tile => {
      const candidate = candidateBuilding(kind, tile.tx, tile.ty);
      const covered = needsBuilding.filter(home => buildingFootprintDistance(home, candidate) <= definition.serviceRadius);
      if (covered.length === 0 || !hasAutoplayBuildingClearance(state, kind, tile)
        || !canPlaceBuilding(state, kind, tile.tx, tile.ty).ok) return [];
      return [{ candidate }];
    });
    const roadDistance = serviceAccessDistances(state);
    const reachable = candidates.filter(({ candidate }) => Number.isFinite(roadDistance(candidate))
      && hasConnectedConstructionRoute(state, candidate));
    const ranked = rankServiceCandidates({ service: kind, allocation: { houses: state.houses, buildings: state.buildings, roadService },
      current, candidates: reachable.map(({ candidate }) => ({ building: candidate, roadDistance: roadDistance(candidate) })) });
    for (const { building: candidate } of ranked) {
      if (!preservesAutoplayWallSpace(state, kind, candidate) || !preservesAutoplayServiceSpace(state, { kind: 'place_building', building: kind, tx: candidate.tx, ty: candidate.ty })) continue;
      return { kind: 'place_building', building: kind, tx: candidate.tx, ty: candidate.ty };
    }
    for (const { building: candidate } of rankServiceRoadPlans(state, kind, candidates.map(entry => entry.candidate))) {
      if (!preservesAutoplayWallSpace(state, kind, candidate) || !preservesAutoplayServiceSpace(state, { kind: 'place_building', building: kind, tx: candidate.tx, ty: candidate.ty })) continue;
      const road = plannedBuildingRoadAction(state, candidate);
      if (road.kind !== 'none') return road;
    }
  }
  return NONE;
}
