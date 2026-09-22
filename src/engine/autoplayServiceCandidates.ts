import type { Building } from '../content/buildingConfig';
import { allocateHouseServices, type HouseholdService, type ServiceAllocation, type ServiceAllocationInput } from '../population/serviceAllocation';

export interface ReachableServiceCandidate {
  readonly building: Building;
  readonly roadDistance: number;
}
export interface RankedServiceCandidate extends ReachableServiceCandidate {
  readonly gainedLots: number;
}

/** Geometry adapters supply reachable positions; selection only evaluates actual allocation. */
export function rankServiceCandidates(input: {
  readonly service: HouseholdService;
  readonly allocation: ServiceAllocationInput;
  readonly current: ServiceAllocation;
  readonly candidates: readonly ReachableServiceCandidate[];
}): readonly RankedServiceCandidate[] {
  return input.candidates.flatMap(candidate => {
    const projected = allocateHouseServices({ ...input.allocation, buildings: [...input.allocation.buildings, candidate.building] });
    let gainedLots = 0;
    for (const [id, before] of input.current.houses) {
      const after = projected.houses.get(id)?.[input.service];
      if (before[input.service].kind === 'served' && after?.kind !== 'served') return [];
      if (before[input.service].kind !== 'served' && after?.kind === 'served') gainedLots += after.demand;
    }
    return gainedLots === 0 ? [] : [{ ...candidate, gainedLots }];
  }).sort((a, b) => b.gainedLots - a.gainedLots || a.roadDistance - b.roadDistance
    || a.building.ty - b.building.ty || a.building.tx - b.building.tx);
}
