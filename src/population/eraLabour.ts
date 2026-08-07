import type { ConstructionLabourSite } from "./labour";
import { activePalisadeLabourSiteId } from "./palisadeLabour";

export type PalisadeEraLabourOptions = {
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

function wallIds(sites: readonly ConstructionLabourSite[]): readonly string[] {
  return [
    ...new Set(
      sites.flatMap((site) => {
        if (site.kind !== "palisade_segment" || !("wallId" in site)) return [];
        const wallId = site.wallId;
        return typeof wallId === "string" ? [wallId] : [];
      }),
    ),
  ].sort((left, right) => left.localeCompare(right));
}

function activePalisadeSiteId(sites: readonly ConstructionLabourSite[]): string | null {
  for (const wallId of wallIds(sites)) {
    const activeId = activePalisadeLabourSiteId(sites, wallId);
    if (activeId !== null) return activeId;
  }
  return null;
}

function tickOffset(options: PalisadeEraLabourOptions): number | null {
  return options.eraProclaimedTick === null ? null : options.tick - options.eraProclaimedTick;
}

export function palisadeEraLabourReservation(
  input: PalisadeEraLabourReservationInput,
): PalisadeEraLabourDiagnostics {
  const offset = tickOffset(input);
  const active =
    offset !== null && offset >= 0 && offset < PALISADE_LABOUR_WINDOW_TICKS;
  const activeSiteId = active ? activePalisadeSiteId(input.constructionSites) : null;
  const reservedWorkers =
    active && activeSiteId !== null && input.availableWorkers > 0
      ? Math.max(1, Math.floor(input.availableWorkers * PALISADE_LABOUR_QUOTA))
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
