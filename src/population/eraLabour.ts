import type { ConstructionLabourSite } from "./labour";
import { RESOURCE_TYPES } from "../content/resourceConfig";
import type { Era } from "../content/eraConfig";
import {
  palisadeConstructionSchedule,
  isPalisadeConstructionSite,
  isStoneWallConstructionSite,
} from "../domain/palisadeConstructionSchedule";

export type PalisadeEraLabourOptions = {
  readonly era?: Era;
  readonly tick: number;
  readonly eraProclaimedTick: number | null;
};

export type PalisadeEraLabourReservationInput = PalisadeEraLabourOptions & {
  readonly constructionSites: readonly ConstructionLabourSite[];
  readonly availableWorkers: number;
};

export type PalisadeEraLabourDiagnostics = {
  readonly active: boolean;
  readonly tickOffset: number | null;
  readonly availableWorkers: number;
  readonly reservedWorkers: number;
  readonly assignedBuilders: number;
  readonly activeSiteId: string | null;
  readonly unavailableReservedWorkers: number;
};

const PALISADE_LABOUR_WINDOW_TICKS = 600;
const PALISADE_LABOUR_QUOTA = 0.4;
const STONE_TOWN_LABOUR_WINDOW_TICKS = 900;
const STONE_TOWN_LABOUR_QUOTA = 0.5;

function tickOffset(options: PalisadeEraLabourOptions): number | null {
  return options.eraProclaimedTick === null ? null : options.tick - options.eraProclaimedTick;
}

function labourPolicy(era: Era): {
  readonly quota: number;
  readonly windowTicks: number;
} | null {
  switch (era) {
    case "palisade":
      return {
        quota: PALISADE_LABOUR_QUOTA,
        windowTicks: PALISADE_LABOUR_WINDOW_TICKS,
      };
    case "stone_town":
      return {
        quota: STONE_TOWN_LABOUR_QUOTA,
        windowTicks: STONE_TOWN_LABOUR_WINDOW_TICKS,
      };
    case "hamlet":
      return null;
  }
}

export function palisadeEraLabourReservation(
  input: PalisadeEraLabourReservationInput,
): PalisadeEraLabourDiagnostics {
  const era = input.era ?? "palisade";
  const policy = labourPolicy(era);
  const offset = tickOffset(input);
  const active =
    policy !== null && offset !== null && offset >= 0 && offset < policy.windowTicks;
  // R1 S5-F1: reserve only ready, schedulable site demand; waiting sites cost no labour.
  const readySites = active ? input.constructionSites.filter(site =>
    (era === 'palisade' ? isPalisadeConstructionSite(site) : isStoneWallConstructionSite(site)) &&
    site.builderTicks < site.requiredBuilderTicks &&
    RESOURCE_TYPES.every(resource => (site.delivered[resource] ?? 0) >= (site.required[resource] ?? 0)) &&
    palisadeConstructionSchedule(site, input.constructionSites).kind === 'active'
  ).sort((a, b) => a.id.localeCompare(b.id)) : [];
  const activeSiteId = readySites[0]?.id ?? null;
  const reservedWorkers =
    active && activeSiteId !== null && input.availableWorkers > 0
      ? Math.min(readySites.length * 3, Math.max(1, Math.floor(input.availableWorkers * policy.quota)))
      : 0;

  return {
    active,
    tickOffset: offset,
    availableWorkers: input.availableWorkers,
    reservedWorkers,
    assignedBuilders: 0,
    activeSiteId,
    unavailableReservedWorkers: reservedWorkers,
  };
}

export function palisadeEraLabourWithAssignment(
  diagnostics: PalisadeEraLabourDiagnostics,
  assignedBuilders: number,
): PalisadeEraLabourDiagnostics {
  return {
    ...diagnostics,
    assignedBuilders,
    unavailableReservedWorkers: Math.max(0, diagnostics.reservedWorkers - assignedBuilders),
  };
}
