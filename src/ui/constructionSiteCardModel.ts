import { GAME_TIME_COPY } from "./gameTimeCopy.ko";
import { RESOURCE_TYPES, type ResourceType } from "../content/resourceConfig";
import {
  constructionOnSiteLabel,
  constructionSiteAnchor,
  constructionSiteDisplayName,
  type ConstructionSite,
} from "../economy/construction";
import {
  isWallConstructionSite,
  palisadeConstructionSchedule,
  PALISADE_CANCELLATION_DISABLED_REASON,
} from "../economy/palisadeConstruction";
import {
  constructionMaterialDiagnosis,
  type ConstructionMaterialDiagnosisState,
} from "./constructionMaterialDiagnosis";
import { constructionAccessModel, currentConstructionSiteLabel, groupedConstructionCause } from './constructionAccessModel';
import { A_TRIPLE_PRIME_ROAD_COPY } from './aTriplePrimeRoadCopy';
import type { GameState } from '../engine/engine.types';
import { calendarArrivalLabel } from "./calendarArrival";
import { scenarioOf } from "../engine/scenarioState";
import { resourceName } from "../content/resourceCatalog.ko";
import { CONSTRUCTION_SITE_CARD_COPY } from "./constructionSiteCardCopy.ko";

export type ConstructionSiteCardRow = Readonly<{
  label: typeof CONSTRUCTION_SITE_CARD_COPY.siteTerm | typeof CONSTRUCTION_SITE_CARD_COPY.securedTerm | typeof CONSTRUCTION_SITE_CARD_COPY.deliveryTerm | typeof CONSTRUCTION_SITE_CARD_COPY.builderWorkTerm | typeof CONSTRUCTION_SITE_CARD_COPY.materialDiagnosisTerm | typeof CONSTRUCTION_SITE_CARD_COPY.causeTerm | typeof CONSTRUCTION_SITE_CARD_COPY.connectingRoadTerm;
  value: string;
}>;

export type ConstructionSiteCardModel = Readonly<{
  siteId: string;
  name: string;
  currentStallLabel: string;
  /** UX-3R2: the first line while it waits for materials (constructionBlockerLine), set by the map card. */
  blockerLine?: string | null;
  rows: readonly ConstructionSiteCardRow[];
  cancellation?: Readonly<
    | { readonly enabled: true; readonly reason: null }
    | { readonly enabled: false; readonly reason: string }
  >;
}>;

export type ConstructionSiteCardModelOptions = Readonly<{
  constructionSites?: readonly ConstructionSite[];
  cancellationDisabledReason?: string | null;
  materialDiagnosisState?: ConstructionMaterialDiagnosisState;
  accessState?: GameState;
}>;

function amount(record: Partial<Record<ResourceType, number>>, resource: ResourceType): number {
  return record[resource] ?? 0;
}

function materialParts(site: ConstructionSite, valueForResource: (resource: ResourceType) => string | null): readonly string[] {
  return RESOURCE_TYPES.flatMap((resource) => {
    const required = amount(site.required, resource);
    return required === 0 ? [] : valueForResource(resource) ?? [];
  });
}

/** Each assigned builder adds one builder tick per tick (economy/construction), so the crew sets the time left. */
function builderWorkLabel(site: ConstructionSite, state?: GameState): string {
  const required = Math.max(1, site.requiredBuilderTicks);
  const percent = Math.min(100, Math.floor((site.builderTicks / required) * 100));
  const remaining = Math.max(0, site.requiredBuilderTicks - site.builderTicks);
  const left = site.assignedBuilders > 0 && remaining > 0 ? Math.ceil(remaining / site.assignedBuilders) : null;
  // F0-V: with the state known, the time left reads as the calendar point it ends at.
  if (state !== undefined && left !== null) {
    return GAME_TIME_COPY.builderWorkUntil(percent, site.assignedBuilders, calendarArrivalLabel(state.tick, state.tick + left, scenarioOf(state).startYear));
  }
  return GAME_TIME_COPY.builderWork(percent, site.assignedBuilders, left);
}

function securedLabel(site: ConstructionSite): string {
  const parts = materialParts(site, (resource) => {
    const delivered = amount(site.delivered, resource);
    const required = amount(site.required, resource);
    const reserved = amount(site.reserved, resource);
    const suffix = reserved > 0 ? CONSTRUCTION_SITE_CARD_COPY.reservedSuffix(reserved) : "";
    return CONSTRUCTION_SITE_CARD_COPY.secured(resourceName(resource), delivered, required, suffix);
  });
  return parts.length === 0 ? CONSTRUCTION_SITE_CARD_COPY.noneNeeded : parts.join(" · ");
}

function deliveryLabel(site: ConstructionSite): string {
  const parts = materialParts(site, (resource) => {
    const remaining = Math.max(
      0,
      amount(site.required, resource) - amount(site.delivered, resource) - amount(site.reserved, resource),
    );
    return remaining > 0 ? CONSTRUCTION_SITE_CARD_COPY.remaining(resourceName(resource), remaining) : null;
  });
  return parts.length === 0 ? CONSTRUCTION_SITE_CARD_COPY.noDeliveryWaiting : parts.join(" · ");
}

function currentStallLabel(
  site: ConstructionSite,
  options: ConstructionSiteCardModelOptions,
): string {
  const schedule = palisadeConstructionSchedule(site, options.constructionSites ?? [site]);
  return schedule.kind === "queued"
    ? site.kind === 'palisade_segment' ? CONSTRUCTION_SITE_CARD_COPY.queuedNoRoute : CONSTRUCTION_SITE_CARD_COPY.queuedFromGate(schedule.position)
    : options.accessState === undefined
      ? constructionOnSiteLabel(site)
      : currentConstructionSiteLabel(options.accessState, site);
}

function materialDiagnosisRows(
  site: ConstructionSite,
  options: ConstructionSiteCardModelOptions,
): readonly ConstructionSiteCardRow[] {
  if (options.materialDiagnosisState === undefined) return [];
  const diagnoses = constructionMaterialDiagnosis(site, options.materialDiagnosisState);
  return diagnoses.length === 0 ? [] : [{
    label: CONSTRUCTION_SITE_CARD_COPY.materialDiagnosisTerm,
    value: diagnoses.map((diagnosis) => diagnosis.label).join(" / "),
  }];
}

export function constructionSiteCardModel(
  site: ConstructionSite,
  options: ConstructionSiteCardModelOptions = {},
): ConstructionSiteCardModel {
  const name = constructionSiteDisplayName(site);
  const anchor = constructionSiteAnchor(site);
  const cancellationReason = options.cancellationDisabledReason ?? null;
  return {
    siteId: site.id,
    name: CONSTRUCTION_SITE_CARD_COPY.siteName(name),
    currentStallLabel: currentStallLabel(site, options),
    cancellation: cancellationReason === null
      ? { enabled: true, reason: null }
      : { enabled: false, reason: cancellationReason },
    rows: [
      { label: CONSTRUCTION_SITE_CARD_COPY.siteTerm, value: `${anchor.tx}, ${anchor.ty} · ${name}` },
      { label: CONSTRUCTION_SITE_CARD_COPY.securedTerm, value: securedLabel(site) },
      { label: CONSTRUCTION_SITE_CARD_COPY.deliveryTerm, value: deliveryLabel(site) },
      { label: CONSTRUCTION_SITE_CARD_COPY.builderWorkTerm, value: builderWorkLabel(site, options.accessState) },
      ...materialDiagnosisRows(site, options),
      ...(options.accessState === undefined ? [] : (() => {
        const access = constructionAccessModel(options.accessState, site);
        const grouped = groupedConstructionCause(options.accessState, access.cause);
        const routeInstruction = access.missingRoadTiles.length === 0 ? [] : [{
          label: CONSTRUCTION_SITE_CARD_COPY.connectingRoadTerm,
          value: access.missingRoadTiles.length === 1
            ? A_TRIPLE_PRIME_ROAD_COPY.oneTileInstruction
            : A_TRIPLE_PRIME_ROAD_COPY.multipleTileInstruction,
        }];
        return [...(grouped === null ? [] : [{ label: CONSTRUCTION_SITE_CARD_COPY.causeTerm, value: grouped }]), ...routeInstruction];
      })()),
    ],
  };
}

export function constructionCancellationDisabledReason(site: ConstructionSite): string | null {
  return isWallConstructionSite(site) ? PALISADE_CANCELLATION_DISABLED_REASON : null;
}
