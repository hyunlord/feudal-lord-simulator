import {
  operationSuspended,
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
/** AF-7: a farmstead is the grain producer of the food chain, in the wheat farm's labour slot. */
const GRAIN_KINDS: readonly string[] = ["wheat_farm", "farmstead"];

function foodBuilding(building: Building): boolean {
  return building.kind === "farmstead" || FOOD_KINDS.some((kind) => kind === building.kind);
}

function sameFoodSlot(building: Building, kind: (typeof FOOD_KINDS)[number]): boolean {
  return kind === "wheat_farm" ? GRAIN_KINDS.includes(building.kind) : building.kind === kind;
}

function allocateBuildingWorkers(
  buildings: readonly Building[],
  available: number,
  eligible: LabourEligibility,
  protectTimberChain = false,
): BuildingLabourResult {
  const ordered = [...buildings].sort((a, b) => a.id.localeCompare(b.id));
  const coreFoodIds = FOOD_KINDS.map((kind) => ordered.find((b) => sameFoodSlot(b, kind) && !operationSuspended(b) && eligible(b))?.id);
  const coreTimberIds = ['logging_camp', 'sawmill'].map(kind => ordered.find(b => b.kind === kind && !operationSuspended(b) && eligible(b))?.id);
  const priority = (building: Building): number => {
    const coreIndex = coreFoodIds.indexOf(building.id);
    if (coreIndex >= 0) return coreIndex;
    if (protectTimberChain && coreTimberIds.includes(building.id)) return 3;
    if (foodBuilding(building)) return 4;
    if (["sawmill", "logging_camp", "storehouse"].includes(building.kind)) return 5;
    return 6;
  };
  let remaining = available;
  const assigned = new Map<string, number>();
  ordered.sort((a, b) => priority(a) - priority(b) || a.id.localeCompare(b.id));
  for (const building of ordered) {
    const workers = !operationSuspended(building) && eligible(building)
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
  /** PERSON-0 PS-1: the town's adults when persons are known (else half the population, the old rule). */
  workers?: number,
): BuildingAndConstructionLabourResult & {
  readonly constructionSites: readonly (TSite & {
    readonly assignedBuilders: number;
    readonly stall: ConstructionLabourStall | string;
  })[];
} {
  const available = workers ?? availableWorkers(population);
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
    .sort((a, b) => isWallConstructionSite(a) && isWallConstructionSite(b) && a.wallId === b.wallId
      ? a.order - b.order || a.id.localeCompare(b.id)
      : a.id.localeCompare(b.id));
  // R1 S5-F2: reserve a capped construction floor before the normal production pool.
  // A single essential food chain remains first; with prepared work the timber chain
  // precedes duplicate food facilities, so expansion cannot starve its own materials.
  const minimum = readySites.length === 0 ? 0
    : Math.min(available, readySites.length * MAX_BUILDERS_PER_SITE,
      Math.max(MAX_BUILDERS_PER_SITE, Math.ceil(available * BALANCE.CONSTRUCTION_MIN_WORKER_SHARE)));
  const reservedTotal = Math.max(reservation.reservedWorkers, minimum);
  const staffed = allocateBuildingWorkers(buildings, available - reservedTotal, eligible, readySites.length > 0);
  let remaining = staffed.idleWorkers;
  let reservedRemaining = reservedTotal;
  let wallReservedRemaining = reservation.reservedWorkers;
  const allocations = new Map<string, number>();
  let palisadeAssignedBuilders = 0;
  // Ceremony shares are part of (not additional to) the construction floor.
  for (const site of readySites.filter(isWallConstructionSite)) {
    const assigned = Math.min(wallReservedRemaining, MAX_BUILDERS_PER_SITE);
    allocations.set(site.id, assigned);
    reservedRemaining -= assigned;
    wallReservedRemaining -= assigned;
  }
  for (const site of readySites) {
    const preassigned = allocations.get(site.id) ?? 0;
    const guaranteed = Math.min(reservedRemaining, MAX_BUILDERS_PER_SITE - preassigned);
    reservedRemaining -= guaranteed;
    const extra = Math.min(remaining, MAX_BUILDERS_PER_SITE - preassigned - guaranteed);
    const assigned = preassigned + guaranteed + extra;
    allocations.set(site.id, assigned);
    if (isWallConstructionSite(site)) palisadeAssignedBuilders += assigned;
    remaining -= extra;
  }
  const palisadeEraLabour = palisadeEraLabourWithAssignment(
    reservation,
    palisadeAssignedBuilders,
  );

  return {
    buildings: staffed.buildings,
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
