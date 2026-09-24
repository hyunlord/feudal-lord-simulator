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
    .filter((site) => site.stall !== "no_route")
    .sort(byOrder)[0]?.id ?? null;
}

export const activePalisadeSiteId = activeWallConstructionSiteId;

export function palisadeConstructionSchedule(
  site: ConstructionSite,
  sites: readonly ConstructionSite[],
): PalisadeConstructionSchedule {
  if (!isWallConstructionSite(site)) return { kind: "active" };
  if (isStoneWallConstructionSite(site) && sites.some(candidate =>
    isPalisadeConstructionSite(candidate) && candidate.wallId === site.wallId
      && candidate.order === site.order && !isComplete(candidate))) {
    return { kind: "queued", position: site.order + 1 };
  }
  // S4-F1: wall material never serializes construction; route availability is
  // local to each segment. Gate order only prioritizes otherwise eligible work.
  return site.stall === "no_route" && !isComplete(site)
    ? { kind: "queued", position: site.order + 1 }
    : { kind: "active" };
}
