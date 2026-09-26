import type { Building } from '../content/buildingConfig';
import { allocateHouseServices, type HouseholdService } from '../population/serviceAllocation';
import { serviceAccessDistances } from './autoplayServiceAccess';
import { rankServiceCandidates, type RankedServiceCandidate } from './autoplayServiceCandidates';
import { potentialServiceRoads } from './autoplayServiceSpaceRoutes';
import { marketConnectionOnly } from './marketService';
import type { GameState } from './engine.types';

/** Rank future access only on traversable land; actual construction uses the road planner. */
export function rankServiceRoadPlans(state: GameState, service: HouseholdService, candidates: readonly Building[]): readonly RankedServiceCandidate[] {
  return candidates.flatMap(building => {
    const potential = potentialServiceRoads(state, [...state.buildings, building]);
    const roadDistance = serviceAccessDistances(potential)(building);
    if (!Number.isFinite(roadDistance)) return [];
    const allocation = { houses: state.houses, buildings: state.buildings, roadService: marketConnectionOnly(potential) };
    return rankServiceCandidates({ service, allocation, current: allocateHouseServices(allocation), candidates: [{ building, roadDistance }] });
  }).sort((a, b) => b.gainedLots - a.gainedLots || a.roadDistance - b.roadDistance
    || a.building.ty - b.building.ty || a.building.tx - b.building.tx);
}
