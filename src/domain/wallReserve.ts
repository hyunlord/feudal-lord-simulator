import type { ResourceType } from "../content/resourceConfig";

export type WallConstructionPriority = "balanced" | "priority";

export interface WallReserveSource {
  readonly id: string;
  readonly floor: number;
}

export interface WallConstructionReserve {
  readonly resource: "timber" | "stone";
  readonly sources: readonly WallReserveSource[];
  readonly proclaimedTick: number;
}

/**
 * FIX-16: the charter's buildings, in the order the town needs them (the market, then the church for L4 houses). While
 * the next of them waits for timber, a palisade must not take it all: Astra's first playthrough ran a 54-step palisade
 * (810 timber) that took each sawn log for years, so the market — which needs its 60 timber in stock to be placed —
 * could not be started.
 */
export const CHARTER_TIMBER_KINDS = ["market", "church"] as const;

export interface CharterTimberWait {
  /** Timber the next charter building needs in stock before it can be placed (0 once it is placed or stands). */
  readonly keep: number;
  /** The share of the stock above `keep`, permille, a palisade may take (1,000 when no charter building waits). */
  readonly wallSharePermille: number;
}

export const NO_CHARTER_WAIT: CharterTimberWait = { keep: 0, wallSharePermille: 1_000 };
/** FIX-16: a palisade takes at most half of the timber while a charter building waits. */
export const CHARTER_WAIT_WALL_SHARE_PERMILLE = 500;

type SiteView = { readonly kind: string; readonly required: Partial<Record<ResourceType, number>>; readonly delivered: Partial<Record<ResourceType, number>>; readonly reserved: Partial<Record<ResourceType, number>> };

/**
 * FIX-16: whether a charter building waits for timber, and how much a palisade must leave. The next charter building
 * (the first of `CHARTER_TIMBER_KINDS` that does not stand) waits when it is not placed yet — then the palisade leaves
 * its building cost in stock and takes at most half of the rest — or when its site still needs timber — then the
 * palisade takes at most half of the stock (the site is served first anyway, construction sites before walls).
 */
export function charterTimberWait(
  buildings: readonly { readonly kind: string }[],
  sites: readonly SiteView[],
  timberCost: (kind: string) => number,
  otherMaterialsHeld: (kind: (typeof CHARTER_TIMBER_KINDS)[number]) => boolean = () => true,
): CharterTimberWait {
  const next = CHARTER_TIMBER_KINDS.find(kind => !buildings.some(building => building.kind === kind));
  if (next === undefined) return NO_CHARTER_WAIT;
  const site = sites.find(candidate => candidate.kind === next);
  // GROW-BLOCK-2a ③: a charter building that cannot be placed for want of another material (the church's stone) holds
  // no timber of its own back — the wall's timber waited years for it (engine-GROW2a-wall-98667ca: seed 8's palisade at
  // 671 timber from 1311 to 1316, the stock 17–69 under the church's 100). What makes that material holds instead
  // (`withSupplierKeep`).
  if (site === undefined && !otherMaterialsHeld(next)) return NO_CHARTER_WAIT;
  if (site === undefined) return { keep: timberCost(next), wallSharePermille: CHARTER_WAIT_WALL_SHARE_PERMILLE };
  const need = (site.required.timber ?? 0) - (site.delivered.timber ?? 0) - (site.reserved.timber ?? 0);
  return need > 0 ? { keep: 0, wallSharePermille: CHARTER_WAIT_WALL_SHARE_PERMILLE } : NO_CHARTER_WAIT;
}

/**
 * GROW-BLOCK-2a ③⑥ (the user's rule 2026-10-10): the palisade leaves in stock what a material's supplier needs to be
 * built, when that supplier is wanted and short of it (`supplierKeep`, from the buildings' definitions).
 */
export function withSupplierKeep(wait: CharterTimberWait, keep: number): CharterTimberWait {
  return keep <= wait.keep ? wait : { keep, wallSharePermille: wait.wallSharePermille };
}

/**
 * FIX-16: of `available` timber at one source, what a palisade may take while a charter building waits — the source's
 * part of the town's allowance, `share × (stock − keep)`, spread over the sources by their stock.
 */
function charterLimited(wait: CharterTimberWait, available: number, townStock: number): number {
  if ((wait.wallSharePermille >= 1_000 && wait.keep <= 0) || townStock <= 0) return available;
  const allowance = Math.floor(Math.max(0, townStock - wait.keep) * wait.wallSharePermille / 1_000);
  return Math.min(available, Math.floor(available * allowance / townStock));
}

export function wallDeliveryAvailable(
  reserve: WallConstructionReserve | undefined,
  priority: WallConstructionPriority,
  sourceId: string,
  resource: ResourceType,
  available: number,
  charter: { readonly wait: CharterTimberWait; readonly townStock: number; readonly supplierKeep?: number } = { wait: NO_CHARTER_WAIT, townStock: 0 },
): number {
  // GROW-BLOCK-2a ③⑥: a wanted supplier's timber stays even when the wall has priority (the rule has no exception).
  if (priority === "priority") return resource === "timber" ? charterLimited({ keep: charter.supplierKeep ?? 0, wallSharePermille: 1_000 }, available, charter.townStock) : available;
  const floor = reserve?.resource !== resource ? 0 : reserve.sources.find((source) => source.id === sourceId)?.floor ?? 0;
  const aboveFloor = Math.max(0, available - floor);
  return resource === "timber" ? Math.min(aboveFloor, charterLimited(charter.wait, available, charter.townStock)) : aboveFloor;
}
