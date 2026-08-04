import {
  BUILDING_CONFIG_BY_KIND,
  type Building,
} from "../content/buildingConfig";
import { BALANCE } from "../content/balanceConfig";

export interface LabourRequest {
  readonly buildingId: string;
  readonly workersRequired: number;
}

export interface LabourAllocation {
  readonly buildingId: string;
  readonly workersAssigned: number;
}

export type BuildingLabourResult = {
  readonly buildings: readonly Building[];
  readonly idleWorkers: number;
};

const wholeNonnegative = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

export function availableWorkers(population: number): number {
  return Math.floor(
    wholeNonnegative(population) * BALANCE.WORKERS_PER_RESIDENT,
  );
}

export function allocateLabour(
  requests: readonly LabourRequest[],
  available: number,
): readonly LabourAllocation[] {
  let remaining = wholeNonnegative(available);
  return [...requests]
    .sort((left, right) => left.buildingId.localeCompare(right.buildingId))
    .map((request) => {
      const workersAssigned = Math.min(
        remaining,
        wholeNonnegative(request.workersRequired),
      );
      remaining -= workersAssigned;
      return {
        buildingId: request.buildingId,
        workersAssigned,
      };
    });
}

export function allocateBuildingLabour(
  buildings: readonly Building[],
  population: number,
): BuildingLabourResult {
  const available = availableWorkers(population);
  const allocations = allocateLabour(
    buildings.map((building) => ({
      buildingId: building.id,
      workersRequired:
        BUILDING_CONFIG_BY_KIND[building.kind].workersRequired,
    })),
    available,
  );
  const byId = new Map(
    allocations.map((allocation) => [
      allocation.buildingId,
      allocation.workersAssigned,
    ]),
  );
  const assigned = allocations.reduce(
    (total, allocation) => total + allocation.workersAssigned,
    0,
  );

  return {
    buildings: buildings.map((building) => ({
      ...building,
      workers: byId.get(building.id) ?? 0,
    })),
    idleWorkers: available - assigned,
  };
}
