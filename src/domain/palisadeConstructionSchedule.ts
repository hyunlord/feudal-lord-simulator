import { RESOURCE_TYPES } from "../content/resourceConfig";
import type { ConstructionSite, PalisadeConstructionSite, StoneWallConstructionSite, WallConstructionSite } from "./constructionSite";

export type PalisadeConstructionSchedule =
  | { readonly kind: "active" }
  | { readonly kind: "queued"; readonly position: number };

export function isPalisadeConstructionSite(
  site: ConstructionSite,
): site is PalisadeConstructionSite {
  return site.kind === "palisade_segment";
}

export function isStoneWallConstructionSite(
  site: ConstructionSite,
): site is StoneWallConstructionSite {
  return site.kind === "stone_wall_segment";
}

export function isWallConstructionSite(site: ConstructionSite): site is WallConstructionSite {
  return isPalisadeConstructionSite(site) || isStoneWallConstructionSite(site);
}

function isComplete(site: WallConstructionSite): boolean {
  return RESOURCE_TYPES.every(
    (resource) => (site.delivered[resource] ?? 0) >= (site.required[resource] ?? 0),
  ) && site.builderTicks >= site.requiredBuilderTicks;
}

function byOrder(left: WallConstructionSite, right: WallConstructionSite): number {
  const orderDelta = left.order - right.order;
  if (orderDelta !== 0) return orderDelta;
  const materialDelta = wallMaterialPriority(left) - wallMaterialPriority(right);
  return materialDelta === 0 ? left.id.localeCompare(right.id) : materialDelta;
}

function wallMaterialPriority(site: WallConstructionSite): number {
  switch (site.kind) {
    case "palisade_segment":
      return 0;
    case "stone_wall_segment":
      return 1;
    default:
      return assertNever(site);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled wall construction variant: ${JSON.stringify(value)}`);
}

export function activeWallConstructionSiteId(
  sites: readonly ConstructionSite[],
  wallId: string,
): string | null {
  return [...sites]
    .filter(isWallConstructionSite)
    .filter((site) => site.wallId === wallId)
    .filter((site) => !isComplete(site))
    .sort(byOrder)[0]?.id ?? null;
}

export const activePalisadeSiteId = activeWallConstructionSiteId;

export function palisadeConstructionSchedule(
  site: ConstructionSite,
  sites: readonly ConstructionSite[],
): PalisadeConstructionSchedule {
  if (!isWallConstructionSite(site)) return { kind: "active" };
  const activeId = activeWallConstructionSiteId(sites, site.wallId);
  return activeId === null || activeId === site.id
    ? { kind: "active" }
    : { kind: "queued", position: site.order + 1 };
}
