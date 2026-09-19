import {
  BUILDING_CONFIG_BY_KIND,
  type Building,
} from "../content/buildingConfig";
import { BALANCE } from "../content/balanceConfig";
import { RESOURCE_TYPES } from "../content/resourceConfig";
import type { ConstructionSite } from "../domain/constructionSite";
import { isWallConstructionSite, palisadeConstructionSchedule } from "../domain/palisadeConstructionSchedule";
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

export type LabourEligibility = (building: Building) => boolean;

const FOOD_KINDS = ["wheat_farm", "mill", "granary"] as const;

function foodBuilding(building: Building): boolean {
  return FOOD_KINDS.some((kind) => kind === building.kind);
}

function allocateBuildingWorkers(
  buildings: readonly Building[],
  available: number,
  eligible: LabourEligibility,
): BuildingLabourResult {
  const ordered = [...buildings].sort((a, b) => a.id.localeCompare(b.id));
  const coreFoodIds = FOOD_KINDS.map((kind) => ordered.find((b) => b.kind === kind && eligible(b))?.id);
  const priority = (building: Building): number => {
    const coreIndex = coreFoodIds.indexOf(building.id);
    if (coreIndex >= 0) return coreIndex;
    if (foodBuilding(building)) return 3;
    if (["sawmill", "logging_camp", "storehouse"].includes(building.kind)) return 4;
    return 5;
  };
  let remaining = available;
  const assigned = new Map<string, number>();
  ordered.sort((a, b) => priority(a) - priority(b) || a.id.localeCompare(b.id));
  for (const building of ordered) {
    const workers = eligible(building)
      ? Math.min(remaining, BUILDING_CONFIG_BY_KIND[building.kind].workersRequired)
      : 0;
    assigned.set(building.id, workers);
    remaining -= workers;
  }
  return {
    buildings: buildings.map((building) => ({ ...building, workers: assigned.get(building.id) ?? 0 })),
    idleWorkers: remaining,
  };
}

export function allocateBuildingLabour(
  buildings: readonly Building[],
  population: number,
  eligible: LabourEligibility = () => true,
): BuildingLabourResult {
  return allocateBuildingWorkers(buildings, availableWorkers(population), eligible);
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
  eligible: LabourEligibility = () => true,
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
        era: "hamlet",
        tick: 0,
        eraProclaimedTick: null,
      })
    : palisadeEraLabourReservation({
        constructionSites,
        availableWorkers: available,
        era: options.era ?? "palisade",
        tick: options.tick,
        eraProclaimedTick: options.eraProclaimedTick,
      });
  const readySites = [...constructionSites]
    .filter((site) => materialsComplete(site) && site.builderTicks < site.requiredBuilderTicks)
    .filter((site) => palisadeConstructionSchedule(site, constructionSites).kind === "active")
    .sort((a, b) => a.id.localeCompare(b.id));
  const ordinaryTarget = readySites.find((site) => !isWallConstructionSite(site));
  const buildingBudget = Math.max(0, available - reservation.reservedWorkers);
  const foodResult = allocateBuildingWorkers(buildings.filter(foodBuilding), buildingBudget, eligible);
  const ordinaryReserved = ordinaryTarget === undefined ? 0 : Math.min(1, foodResult.idleWorkers);
  const otherResult = allocateBuildingWorkers(
    buildings.filter((building) => !foodBuilding(building)),
    foodResult.idleWorkers - ordinaryReserved,
    eligible,
  );
  const staffed = new Map([...foodResult.buildings, ...otherResult.buildings].map((b) => [b.id, b]));
  let remaining = otherResult.idleWorkers;
  const allocations = new Map<string, number>();
  let palisadeAssignedBuilders = 0;

  for (const site of readySites) {
    if (site.id === reservation.activeSiteId) {
      palisadeAssignedBuilders = Math.min(reservation.reservedWorkers, MAX_BUILDERS_PER_SITE);
      allocations.set(site.id, palisadeAssignedBuilders);
      continue;
    }
    const guaranteed = site.id === ordinaryTarget?.id ? ordinaryReserved : 0;
    const extra = Math.min(remaining, MAX_BUILDERS_PER_SITE - guaranteed);
    allocations.set(site.id, guaranteed + extra);
    remaining -= extra;
  }
  const palisadeEraLabour = palisadeEraLabourWithAssignment(
    reservation,
    palisadeAssignedBuilders,
  );

  return {
    buildings: buildings.map((building) => staffed.get(building.id) ?? building),
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
