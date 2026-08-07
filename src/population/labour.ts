import {
  BUILDING_CONFIG_BY_KIND,
  type Building,
} from "../content/buildingConfig";
import { BALANCE } from "../content/balanceConfig";
import { RESOURCE_TYPES } from "../content/resourceConfig";
import type { ConstructionSite } from "../domain/constructionSite";
import { palisadeConstructionSchedule } from "../domain/palisadeConstructionSchedule";
export {
  builderWalkersForSites,
  type BuilderLabourWalker,
} from "./builderLabourWalkers";
import {
  palisadeEraLabourReservation,
  palisadeEraLabourWithAssignment,
  type PalisadeEraLabourDiagnostics,
  type PalisadeEraLabourOptions,
} from "./eraLabour";

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

export type BuildingAndConstructionLabourResult = {
  readonly buildings: readonly Building[];
  readonly constructionSites: readonly ConstructionLabourSite[];
  readonly idleWorkers: number;
  readonly diagnostics: LabourDiagnostics;
};

export type LabourDiagnostics = {
  readonly palisadeEraLabour: PalisadeEraLabourDiagnostics;
};

export type ConstructionLabourStall = "awaiting_materials" | "no_builders" | "none";

export type ConstructionLabourSite = ConstructionSite;

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

const MAX_BUILDERS_PER_SITE = 3;

function materialsComplete(site: ConstructionLabourSite): boolean {
  return RESOURCE_TYPES.every(
    (resource) => (site.delivered[resource] ?? 0) >= (site.required[resource] ?? 0),
  );
}

function siteStall(
  site: ConstructionLabourSite,
  assignedBuilders: number,
): ConstructionLabourStall | string {
  if (!materialsComplete(site)) return site.stall;
  return assignedBuilders === 0 ? "no_builders" : "none";
}

export function allocateBuildingAndConstructionLabour<TSite extends ConstructionLabourSite>(
  buildings: readonly Building[],
  constructionSites: readonly TSite[],
  population: number,
  options?: PalisadeEraLabourOptions,
): BuildingAndConstructionLabourResult & {
  readonly constructionSites: readonly (TSite & {
    readonly assignedBuilders: number;
    readonly stall: ConstructionLabourStall | string;
  })[];
} {
  const available = availableWorkers(population);
  const reservation = options === undefined
    ? palisadeEraLabourReservation({
        constructionSites,
        availableWorkers: available,
        tick: 0,
        eraProclaimedTick: null,
      })
    : palisadeEraLabourReservation({
        constructionSites,
        availableWorkers: available,
        tick: options.tick,
        eraProclaimedTick: options.eraProclaimedTick,
      });
  const buildingResult = allocateBuildingLabour(
    buildings,
    Math.max(0, available - reservation.reservedWorkers) / BALANCE.WORKERS_PER_RESIDENT,
  );
  let remaining = buildingResult.idleWorkers;
  const allocations = new Map<string, number>();
  let palisadeAssignedBuilders = 0;

  for (const site of [...constructionSites].sort((left, right) => left.id.localeCompare(right.id))) {
    if (palisadeConstructionSchedule(site, constructionSites).kind === "queued") {
      allocations.set(site.id, 0);
      continue;
    }
    const assignedBuilders = site.id === reservation.activeSiteId
      ? Math.min(
          reservation.reservedWorkers,
          MAX_BUILDERS_PER_SITE,
          materialsComplete(site) ? Number.POSITIVE_INFINITY : 0,
        )
      : Math.min(remaining, MAX_BUILDERS_PER_SITE);
    if (site.id === reservation.activeSiteId) {
      palisadeAssignedBuilders = assignedBuilders;
    } else {
      remaining -= assignedBuilders;
    }
    allocations.set(site.id, assignedBuilders);
  }
  const palisadeEraLabour = palisadeEraLabourWithAssignment(
    reservation,
    palisadeAssignedBuilders,
  );

  return {
    buildings: buildingResult.buildings,
    constructionSites: constructionSites.map((site) => {
      const assignedBuilders = allocations.get(site.id) ?? 0;
      return {
        ...site,
        assignedBuilders,
        stall: siteStall(site, assignedBuilders),
      };
    }),
    idleWorkers: remaining,
    diagnostics: { palisadeEraLabour },
  };
}
