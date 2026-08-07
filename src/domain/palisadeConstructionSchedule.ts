import { RESOURCE_TYPES } from "../content/resourceConfig";
import type { ConstructionSite, PalisadeConstructionSite } from "./constructionSite";

export type PalisadeConstructionSchedule =
  | { readonly kind: "active" }
  | { readonly kind: "queued"; readonly position: number };

export function isPalisadeConstructionSite(
  site: ConstructionSite,
): site is PalisadeConstructionSite {
  return site.kind === "palisade_segment";
}

function isComplete(site: PalisadeConstructionSite): boolean {
  return RESOURCE_TYPES.every(
    (resource) => (site.delivered[resource] ?? 0) >= (site.required[resource] ?? 0),
  ) && site.builderTicks >= site.requiredBuilderTicks;
}

function byOrder(left: PalisadeConstructionSite, right: PalisadeConstructionSite): number {
  const orderDelta = left.order - right.order;
  return orderDelta === 0 ? left.id.localeCompare(right.id) : orderDelta;
}

export function activePalisadeSiteId(
  sites: readonly ConstructionSite[],
  wallId: string,
): string | null {
  return [...sites]
    .filter(isPalisadeConstructionSite)
    .filter((site) => site.wallId === wallId)
    .filter((site) => !isComplete(site))
    .sort(byOrder)[0]?.id ?? null;
}

export function palisadeConstructionSchedule(
  site: ConstructionSite,
  sites: readonly ConstructionSite[],
): PalisadeConstructionSchedule {
  if (!isPalisadeConstructionSite(site)) return { kind: "active" };
  const activeId = activePalisadeSiteId(sites, site.wallId);
  return activeId === null || activeId === site.id
    ? { kind: "active" }
    : { kind: "queued", position: site.order + 1 };
}
