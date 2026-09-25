import { MONEY_LABEL } from "../content/moneyCopy.ko";
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

const RESOURCE_LABELS = {
  wheat: "밀",
  bread: "빵",
  logs: "통나무",
  timber: "목재",
  stone_raw: "원석",
  stone: "석재",
  coin: MONEY_LABEL,
} as const satisfies Record<ResourceType, string>;

export type ConstructionSiteCardRow = Readonly<{
  label: "부지" | "자재 확보" | "자재 배달" | "건축 작업" | "자재 진단" | "원인" | "연결 길";
  value: string;
}>;

export type ConstructionSiteCardModel = Readonly<{
  siteId: string;
  name: string;
  currentStallLabel: string;
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
function builderWorkLabel(site: ConstructionSite): string {
  const required = Math.max(1, site.requiredBuilderTicks);
  const percent = Math.min(100, Math.floor((site.builderTicks / required) * 100));
  const remaining = Math.max(0, site.requiredBuilderTicks - site.builderTicks);
  return GAME_TIME_COPY.builderWork(percent, site.assignedBuilders,
    site.assignedBuilders > 0 && remaining > 0 ? Math.ceil(remaining / site.assignedBuilders) : null);
}

function securedLabel(site: ConstructionSite): string {
  const parts = materialParts(site, (resource) => {
    const delivered = amount(site.delivered, resource);
    const required = amount(site.required, resource);
    const reserved = amount(site.reserved, resource);
    const suffix = reserved > 0 ? ` · 예약 ${reserved}` : "";
    return `${RESOURCE_LABELS[resource]} ${delivered}/${required} 확보${suffix}`;
  });
  return parts.length === 0 ? "필요 없음" : parts.join(" · ");
}

function deliveryLabel(site: ConstructionSite): string {
  const parts = materialParts(site, (resource) => {
    const remaining = Math.max(
      0,
      amount(site.required, resource) - amount(site.delivered, resource) - amount(site.reserved, resource),
    );
    return remaining > 0 ? `${RESOURCE_LABELS[resource]} ${remaining} 남음` : null;
  });
  return parts.length === 0 ? "배달 대기 없음" : parts.join(" · ");
}

function currentStallLabel(
  site: ConstructionSite,
  options: ConstructionSiteCardModelOptions,
): string {
  const schedule = palisadeConstructionSchedule(site, options.constructionSites ?? [site]);
  return schedule.kind === "queued"
    ? site.kind === 'palisade_segment' ? '대기(경로 없음)' : `대기 중 · 성문 기준 ${schedule.position}번째 구간`
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
    label: "자재 진단",
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
    name: `${name} 부지`,
    currentStallLabel: currentStallLabel(site, options),
    cancellation: cancellationReason === null
      ? { enabled: true, reason: null }
      : { enabled: false, reason: cancellationReason },
    rows: [
      { label: "부지", value: `${anchor.tx}, ${anchor.ty} · ${name}` },
      { label: "자재 확보", value: securedLabel(site) },
      { label: "자재 배달", value: deliveryLabel(site) },
      { label: "건축 작업", value: builderWorkLabel(site) },
      ...materialDiagnosisRows(site, options),
      ...(options.accessState === undefined ? [] : (() => {
        const access = constructionAccessModel(options.accessState, site);
        const grouped = groupedConstructionCause(options.accessState, access.cause);
        const routeInstruction = access.missingRoadTiles.length === 0 ? [] : [{
          label: '연결 길' as const,
          value: access.missingRoadTiles.length === 1
            ? A_TRIPLE_PRIME_ROAD_COPY.oneTileInstruction
            : A_TRIPLE_PRIME_ROAD_COPY.multipleTileInstruction,
        }];
        return [...(grouped === null ? [] : [{ label: '원인' as const, value: grouped }]), ...routeInstruction];
      })()),
    ],
  };
}

export function constructionCancellationDisabledReason(site: ConstructionSite): string | null {
  return isWallConstructionSite(site) ? PALISADE_CANCELLATION_DISABLED_REASON : null;
}
