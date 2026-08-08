import type { ConstructionLabourSite } from "./labour";
import type { Era } from "../content/eraConfig";
import {
  activePalisadeSiteId as activePalisadeSiteIdForWall,
  isPalisadeConstructionSite,
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

function wallIds(sites: readonly ConstructionLabourSite[]): readonly string[] {
  return [
    ...new Set(
      sites.flatMap((site) => {
        if (!isPalisadeConstructionSite(site)) return [];
        return [site.wallId];
      }),
    ),
  ].sort((left, right) => left.localeCompare(right));
}

function firstActivePalisadeSiteId(sites: readonly ConstructionLabourSite[]): string | null {
  for (const wallId of wallIds(sites)) {
    const activeId = activePalisadeSiteIdForWall(sites, wallId);
    if (activeId !== null) return activeId;
  }
  return null;
}

function firstActiveStoneTownSiteId(sites: readonly ConstructionLabourSite[]): string | null {
  const activeSites = sites
    .filter((site) => {
      if (isPalisadeConstructionSite(site)) {
        return activePalisadeSiteIdForWall(sites, site.wallId) === site.id;
      }
      return true;
    })
    .sort((left, right) => left.id.localeCompare(right.id));
  return activeSites[0]?.id ?? null;
}

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

function activeConstructionTargetId(
  era: Era,
  sites: readonly ConstructionLabourSite[],
): string | null {
  switch (era) {
    case "palisade":
      return firstActivePalisadeSiteId(sites);
    case "stone_town":
      return firstActiveStoneTownSiteId(sites);
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
  const activeSiteId = active ? activeConstructionTargetId(era, input.constructionSites) : null;
  const reservedWorkers =
    active && activeSiteId !== null && input.availableWorkers > 0
      ? Math.max(1, Math.floor(input.availableWorkers * policy.quota))
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
