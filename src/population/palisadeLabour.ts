import type { ConstructionLabourSite } from "./labour";

type PalisadeConstructionLabourSite = ConstructionLabourSite & {
  readonly kind: "palisade_segment";
  readonly wallId: string;
  readonly order: number;
  readonly builderTicks: number;
  readonly requiredBuilderTicks: number;
};

function materialAmount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function materialAmounts(source: object): ReadonlyMap<string, number> {
  return new Map(
    Object.entries(source).map(([resource, amount]) => [resource, materialAmount(amount)]),
  );
}

function materialsComplete(site: ConstructionLabourSite): boolean {
  const delivered = materialAmounts(site.delivered);
  return Object.entries(site.required).every(
    ([resource, required]) =>
      (delivered.get(resource) ?? 0) >= materialAmount(required),
  );
}

function isPalisadeConstructionLabourSite(
  site: ConstructionLabourSite,
): site is PalisadeConstructionLabourSite {
  return site.kind === "palisade_segment";
}

function palisadeLabourSiteComplete(site: PalisadeConstructionLabourSite): boolean {
  return materialsComplete(site) && site.builderTicks >= site.requiredBuilderTicks;
}

export function activePalisadeLabourSiteId(
  sites: readonly ConstructionLabourSite[],
  wallId: string,
): string | null {
  return [...sites]
    .filter(isPalisadeConstructionLabourSite)
    .filter((site) => site.wallId === wallId)
    .filter((site) => !palisadeLabourSiteComplete(site))
    .sort((left, right) => {
      const orderDelta = left.order - right.order;
      return orderDelta === 0 ? left.id.localeCompare(right.id) : orderDelta;
    })[0]?.id ?? null;
}

export function palisadeLabourSiteIsQueued(
  site: ConstructionLabourSite,
  sites: readonly ConstructionLabourSite[],
): boolean {
  if (!isPalisadeConstructionLabourSite(site)) return false;
  const activeId = activePalisadeLabourSiteId(sites, site.wallId);
  return activeId !== null && activeId !== site.id;
}
