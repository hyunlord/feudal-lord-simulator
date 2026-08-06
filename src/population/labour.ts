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

export type BuildingAndConstructionLabourResult = {
  readonly buildings: readonly Building[];
  readonly constructionSites: readonly ConstructionLabourSite[];
  readonly idleWorkers: number;
};

export type ConstructionLabourStall = "awaiting_materials" | "no_builders" | "none";

export type ConstructionLabourSite = {
  readonly id: string;
  readonly tx: number;
  readonly ty: number;
  readonly required: object;
  readonly delivered: object;
  readonly assignedBuilders: number;
  readonly stall: string;
};

export type BuilderLabourWalker = {
  readonly id: string;
  readonly kind: "builder";
  readonly homeBuildingId: string;
  readonly siteId: string;
  readonly slotIndex: number;
  readonly position: { readonly tx: number; readonly ty: number };
  readonly path: readonly [];
  readonly pathIndex: 0;
  readonly previousTile: null;
  readonly cargo: null;
  readonly spawnedTick: 0;
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

const MAX_BUILDERS_PER_SITE = 3;

function materialAmount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function materialAmounts(source: object): ReadonlyMap<string, number> {
  return new Map(
    Object.entries(source).map(([resource, amount]) => [resource, materialAmount(amount)]),
  );
}

function materialsComplete(site: ConstructionLabourSite): boolean {
  const delivered = materialAmounts(site.delivered);
  return Object.entries(site.required).every(
    ([resource, required]) =>
      (delivered.get(resource) ?? 0) >= materialAmount(required),
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
): BuildingAndConstructionLabourResult & {
  readonly constructionSites: readonly (TSite & {
    readonly assignedBuilders: number;
    readonly stall: ConstructionLabourStall | string;
  })[];
} {
  const buildingResult = allocateBuildingLabour(buildings, population);
  let remaining = buildingResult.idleWorkers;
  const allocations = new Map<string, number>();

  for (const site of [...constructionSites].sort((left, right) => left.id.localeCompare(right.id))) {
    const assignedBuilders = Math.min(remaining, MAX_BUILDERS_PER_SITE);
    remaining -= assignedBuilders;
    allocations.set(site.id, assignedBuilders);
  }

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
  };
}

const BUILDER_ANCHORS = [
  { tx: 0.25, ty: 0.25 },
  { tx: 0.65, ty: 0.35 },
  { tx: 0.45, ty: 0.7 },
] as const;

export function builderWalkersForSites(
  constructionSites: readonly ConstructionLabourSite[],
): readonly BuilderLabourWalker[] {
  return [...constructionSites]
    .sort((left, right) => left.id.localeCompare(right.id))
    .flatMap((site) =>
      BUILDER_ANCHORS.slice(0, wholeNonnegative(site.assignedBuilders)).map(
        (anchor, slotIndex): BuilderLabourWalker => ({
          id: `builder:${site.id}:${slotIndex}`,
          kind: "builder",
          homeBuildingId: site.id,
          siteId: site.id,
          slotIndex,
          position: { tx: site.tx + anchor.tx, ty: site.ty + anchor.ty },
          path: [],
          pathIndex: 0,
          previousTile: null,
          cargo: null,
          spawnedTick: 0,
        }),
      ),
    );
}
