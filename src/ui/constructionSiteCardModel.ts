import { RESOURCE_TYPES, type ResourceType } from "../content/resourceConfig";
import {
  constructionOnSiteLabel,
  constructionSiteAnchor,
  constructionSiteDisplayName,
  type ConstructionSite,
} from "../economy/construction";
import {
  palisadeConstructionSchedule,
  PALISADE_CANCELLATION_DISABLED_REASON,
} from "../economy/palisadeConstruction";

const RESOURCE_LABELS = {
  wheat: "밀",
  bread: "빵",
  logs: "통나무",
  timber: "목재",
  stone_raw: "원석",
  stone: "석재",
  coin: "금화",
} as const satisfies Record<ResourceType, string>;

export type ConstructionSiteCardRow = Readonly<{
  label: "부지" | "자재 확보" | "자재 배달" | "건축 작업";
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
    ? `대기 중 · 성문 기준 ${schedule.position}번째 구간`
    : constructionOnSiteLabel(site);
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
      { label: "건축 작업", value: `${site.builderTicks}/${site.requiredBuilderTicks}틱 · 일꾼 ${site.assignedBuilders}명` },
    ],
  };
}

export function constructionCancellationDisabledReason(site: ConstructionSite): string | null {
  return site.kind === "palisade_segment" ? PALISADE_CANCELLATION_DISABLED_REASON : null;
}
