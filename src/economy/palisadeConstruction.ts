import {
  constructionMaterialStatus,
  type ConstructionSite,
  type PalisadeConstructionSite,
} from "./construction";

export const PALISADE_CANCELLATION_DISABLED_REASON =
  "목책 시대 선포 후에는 성벽 구간 공사를 취소할 수 없습니다";

export type PalisadeConstructionSchedule =
  | { readonly kind: "active" }
  | { readonly kind: "queued"; readonly position: number };

function byPalisadeOrder(
  left: PalisadeConstructionSite,
  right: PalisadeConstructionSite,
): number {
  const orderDelta = left.order - right.order;
  return orderDelta === 0 ? left.id.localeCompare(right.id) : orderDelta;
}

export function isPalisadeConstructionSite(
  site: ConstructionSite,
): site is PalisadeConstructionSite {
  return site.kind === "palisade_segment";
}

export function isPalisadeSiteComplete(site: PalisadeConstructionSite): boolean {
  return (
    constructionMaterialStatus(site).complete &&
    site.builderTicks >= site.requiredBuilderTicks
  );
}

export function activePalisadeSiteId(
  sites: readonly ConstructionSite[],
  wallId: string,
): string | null {
  return [...sites]
    .filter(isPalisadeConstructionSite)
    .filter((site) => site.wallId === wallId)
    .filter((site) => !isPalisadeSiteComplete(site))
    .sort(byPalisadeOrder)[0]?.id ?? null;
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
