import { RESOURCE_TYPES, type ResourceType } from "../content/resourceConfig";
import {
  CONSTRUCTION,
  type ConstructionResourceAmounts,
  type ConstructionSite,
  type ConstructionStall,
} from "./constructionSites";
export {
  CONSTRUCTION,
  InvalidPalisadeConstructionSiteError,
  constructionSiteId,
  createConstructionSite,
  createPalisadeConstructionSite,
  createStoneWallConstructionSite,
  requiredConstructionMaterials,
  type BuildingConstructionSite,
  type ConstructionResourceAmounts,
  type ConstructionSite,
  type ConstructionSiteFootprint,
  type ConstructionStall,
  type CreateConstructionSiteInput,
  type CreatePalisadeConstructionSiteInput,
  type CreateStoneWallConstructionSiteInput,
  type PalisadeConstructionSite,
  type StoneWallConstructionSite,
  type WallConstructionSite,
} from "./constructionSites";
export {
  constructionSiteAnchor,
  constructionSiteCacheKey,
  constructionSiteDisplayName,
  constructionSiteFootprint,
  isBuildingConstructionSite,
  isStoneWallConstructionSite,
  isWallConstructionSite,
} from "./constructionSiteAccessors";

export type ConstructionStage =
  | "marked_plot"
  | "foundation"
  | "frame"
  | "roof";

export type MaterialSource = {
  readonly id: string;
  readonly stock: Partial<Record<ResourceType, number>>;
  readonly hasRoute: boolean;
};

export type ConstructionMaterialStatus = {
  readonly complete: boolean;
  readonly delivered: ConstructionResourceAmounts;
  readonly outstanding: ConstructionResourceAmounts;
};

export type ConstructionRefunds = {
  readonly deliveredRefund: ConstructionResourceAmounts;
  readonly deliveredLost: ConstructionResourceAmounts;
  readonly reservedRelease: ConstructionResourceAmounts;
};

const RESOURCE_LABELS = {
  wheat: "밀",
  bread: "빵",
  logs: "통나무",
  timber: "목재",
  stone_raw: "원석",
  stone: "석재",
  coin: "금화",
} as const satisfies Record<ResourceType, string>;

function assertNever(value: never): never {
  throw new Error(`Unhandled construction variant: ${JSON.stringify(value)}`);
}

function amount(record: Partial<Record<ResourceType, number>>, resource: ResourceType): number {
  return record[resource] ?? 0;
}

function positiveResourceAmounts(
  valueForResource: (resource: ResourceType) => number,
): Partial<Record<ResourceType, number>> {
  const result: Partial<Record<ResourceType, number>> = {};
  for (const resource of RESOURCE_TYPES) {
    const value = valueForResource(resource);
    if (value > 0) result[resource] = value;
  }
  return result;
}

export function constructionMaterialStatus(site: ConstructionSite): ConstructionMaterialStatus {
  const outstanding = positiveResourceAmounts((resource) =>
    Math.max(0, amount(site.required, resource) - amount(site.delivered, resource)),
  );
  return {
    complete: RESOURCE_TYPES.every((resource) => amount(outstanding, resource) === 0),
    delivered: positiveResourceAmounts((resource) =>
      Math.min(amount(site.delivered, resource), amount(site.required, resource)),
    ),
    outstanding,
  };
}

export function constructionDeliveryNeed(
  site: ConstructionSite,
): Partial<Record<ResourceType, number>> {
  return positiveResourceAmounts((resource) =>
    Math.max(
      0,
      amount(site.required, resource) -
        amount(site.delivered, resource) -
        amount(site.reserved, resource),
    ),
  );
}

export function constructionStall(
  site: ConstructionSite,
  sources: readonly MaterialSource[],
): ConstructionStall {
  if (constructionMaterialStatus(site).complete) {
    return site.assignedBuilders > 0 ? "none" : "no_builders";
  }

  const deliveryNeed = constructionDeliveryNeed(site);
  const neededResources = RESOURCE_TYPES.filter((resource) => amount(deliveryNeed, resource) > 0);
  if (neededResources.length === 0) return "awaiting_materials";

  const everyNeedHasSource = neededResources.every((resource) =>
    sources.some((source) => amount(source.stock, resource) > 0),
  );
  if (!everyNeedHasSource) return "no_material_source";

  const everyNeedHasRoute = neededResources.every((resource) =>
    sources.some((source) => amount(source.stock, resource) > 0 && source.hasRoute),
  );
  return everyNeedHasRoute ? "awaiting_materials" : "no_route";
}

function firstOutstandingResource(site: ConstructionSite): ResourceType {
  for (const resource of RESOURCE_TYPES) {
    if (amount(site.required, resource) > amount(site.delivered, resource)) return resource;
  }
  return "timber";
}

export function constructionOnSiteLabel(site: ConstructionSite): string {
  const resource = firstOutstandingResource(site);
  switch (site.stall) {
    case "none":
      return "";
    case "awaiting_materials":
      return `🪵 ${RESOURCE_LABELS[resource]} 오는 중 (${amount(site.delivered, resource)}/${amount(site.required, resource)})`;
    case "no_material_source":
      return `🪵 창고에 ${RESOURCE_LABELS[resource]} 없음`;
    case "no_route":
      return "🚧 창고에서 길이 이어지지 않음";
    case "no_builders":
      return "👷 일꾼 없음";
    default:
      return assertNever(site.stall);
  }
}

export function constructionStage(site: ConstructionSite): ConstructionStage {
  const progress =
    site.requiredBuilderTicks === 0 ? 1 : site.builderTicks / site.requiredBuilderTicks;
  if (progress < 0.25) return "marked_plot";
  if (progress < 0.55) return "foundation";
  if (progress < 0.85) return "frame";
  return "roof";
}

export function canAdvanceConstructionWork(site: ConstructionSite): boolean {
  return constructionMaterialStatus(site).complete && site.assignedBuilders > 0;
}

export function advanceConstructionWork(site: ConstructionSite): ConstructionSite {
  if (!canAdvanceConstructionWork(site)) return site;
  return {
    ...site,
    builderTicks: Math.min(
      site.requiredBuilderTicks,
      site.builderTicks + site.assignedBuilders,
    ),
  };
}

export function canCompleteConstruction(site: ConstructionSite, wallTick: number): boolean {
  return (
    constructionMaterialStatus(site).complete &&
    site.builderTicks >= site.requiredBuilderTicks &&
    wallTick - site.startedTick >= CONSTRUCTION.MIN_VISIBLE_TICKS
  );
}

export function constructionCancellationRefunds(site: ConstructionSite): ConstructionRefunds {
  return {
    deliveredRefund: positiveResourceAmounts((resource) =>
      Math.floor(amount(site.delivered, resource) * 0.6),
    ),
    deliveredLost: positiveResourceAmounts((resource) =>
      amount(site.delivered, resource) - Math.floor(amount(site.delivered, resource) * 0.6),
    ),
    reservedRelease: positiveResourceAmounts((resource) => amount(site.reserved, resource)),
  };
}
