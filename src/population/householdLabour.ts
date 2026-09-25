import type { BuildingKind } from "../content/buildingConfig";
import type { GameState } from "../engine/engine.types";

/** LB-6: one household's share of the tick's labour allocation (derived, not stored). */
export interface HouseholdLabour {
  readonly houseId: string;
  readonly adults: number;
  /** Facility jobs by building kind, in the order they were filled. */
  readonly facilities: readonly { readonly kind: BuildingKind; readonly workers: number }[];
  /** LB-5 seasonal field hands. */
  readonly fieldHands: number;
  /** Day pool: construction and granary hauling. */
  readonly dayLabour: number;
  readonly household: number;
  readonly idle: number;
}

type Job = { readonly kind: "facility"; readonly building: BuildingKind } | { readonly kind: "field" | "day" | "household" };

/**
 * LB-6: hands the tick's allocation (building `workers`, `fieldHands`, `haulers`, site builders, `labour.household`)
 * to households — houses in building-id order, jobs in the LB-4 order (construction floor and facilities by
 * building id, field hands, hauling, household slots); whatever is left in a house is idle.
 */
export function householdLabour(state: Pick<GameState, "houses" | "buildings" | "constructionSites" | "labour">): ReadonlyMap<string, HouseholdLabour> {
  const jobs: { job: Job; count: number }[] = [];
  const builders = state.constructionSites.reduce((total, site) => total + Math.max(0, site.assignedBuilders), 0);
  const buildings = [...state.buildings].sort((a, b) => a.id.localeCompare(b.id));
  for (const building of buildings) if (building.workers > 0) jobs.push({ job: { kind: "facility", building: building.kind }, count: building.workers });
  const fieldHands = buildings.reduce((total, building) => total + Math.max(0, building.fieldHands ?? 0), 0);
  const hauling = buildings.reduce((total, building) => total + Math.max(0, building.haulers ?? 0), 0);
  jobs.push({ job: { kind: "field" }, count: fieldHands });
  jobs.push({ job: { kind: "day" }, count: builders + hauling });
  jobs.push({ job: { kind: "household" }, count: Math.max(0, state.labour?.household ?? 0) });
  const result = new Map<string, HouseholdLabour>();
  let jobIndex = 0;
  let leftInJob = jobs[0]?.count ?? 0;
  for (const house of [...state.houses].sort((a, b) => a.buildingId.localeCompare(b.buildingId))) {
    const adults = Math.max(0, house.members?.adults ?? 0);
    let free = adults;
    const facilities = new Map<BuildingKind, number>();
    let field = 0;
    let day = 0;
    let household = 0;
    while (free > 0 && jobIndex < jobs.length) {
      if (leftInJob === 0) {
        jobIndex += 1;
        leftInJob = jobs[jobIndex]?.count ?? 0;
        continue;
      }
      const taken = Math.min(free, leftInJob);
      free -= taken;
      leftInJob -= taken;
      const job = jobs[jobIndex]!.job;
      if (job.kind === "facility") facilities.set(job.building, (facilities.get(job.building) ?? 0) + taken);
      else if (job.kind === "field") field += taken;
      else if (job.kind === "day") day += taken;
      else household += taken;
    }
    result.set(house.buildingId, {
      houseId: house.buildingId, adults,
      facilities: [...facilities].map(([kind, workers]) => ({ kind, workers })),
      fieldHands: field, dayLabour: day, household, idle: free,
    });
  }
  return result;
}
