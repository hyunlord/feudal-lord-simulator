import {
  BUILDING_CONFIG_BY_KIND,
} from "../content/buildingConfig";
import { RESOURCE_TYPES, type ResourceType } from "../content/resourceConfig";
import type { ConstructionSite, ConstructionStall } from "../economy/construction";

const RESOURCE_LABELS = {
  wheat: "밀",
  bread: "빵",
  logs: "통나무",
  timber: "목재",
} as const satisfies Record<ResourceType, string>;

export type ConstructionSiteCardRow = Readonly<{
  label: "부지" | "자재 확보" | "자재 배달" | "건축 작업";
  value: string;
}>;

export type ConstructionSiteCardModel = Readonly<{
  siteId: string;
  name: string;
  currentStall: ConstructionStall;
  rows: readonly ConstructionSiteCardRow[];
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
  const summary = parts.length === 0 ? "배달 대기 없음" : parts.join(" · ");
  return `${summary} · 정체 ${site.stall}`;
}

export function constructionSiteCardModel(site: ConstructionSite): ConstructionSiteCardModel {
  const name = BUILDING_CONFIG_BY_KIND[site.kind].name;
  return {
    siteId: site.id,
    name: `${name} 부지`,
    currentStall: site.stall,
    rows: [
      { label: "부지", value: `${site.tx}, ${site.ty} · ${name}` },
      { label: "자재 확보", value: securedLabel(site) },
      { label: "자재 배달", value: deliveryLabel(site) },
      { label: "건축 작업", value: `${site.builderTicks}/${site.requiredBuilderTicks}틱 · 일꾼 ${site.assignedBuilders}명` },
    ],
  };
}
