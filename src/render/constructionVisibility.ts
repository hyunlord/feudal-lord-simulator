import type { ResourceType } from "../content/resourceConfig";
import { constructionMaterialStatus, type ConstructionSite } from "../economy/construction";
import { CONSTRUCTION } from "../economy/constructionSites";

// F0-V construction visibility model (visibility design 2절 "건설 확정본"): what a building site shows, derived from the
// saved site only (required / delivered materials, builder ticks, stall), never stored.
//  - Two phases: materials (the carters bring the timber / stone; work cannot start before, `canAdvanceConstructionWork`)
//    and work (builder ticks run through the four stages at 25 / 55 / 85 %).
//  - Piles: in the materials phase each material's pile has 1-3 levels by its delivered share (0-30 / 30-70 / 70-100 %,
//    the Wave 6 records' bands; nothing delivered, no pile); in the work phase each stage uses one level up (3 at the
//    plot, 0 at the roof).
//  - Bar: four cells with the stage boundaries; in the materials phase the bar is the delivered share instead.
//  - Blocker (priority: road cut > no material in store > no builders); materials merely on the way are not a blocker.

export type ConstructionPhase = "materials" | "work";
export type ConstructionBlocker = "road" | "materials" | "workers";
export const STAGE_BOUNDS = [0, 0.25, 0.55, 0.85, 1] as const;
const PILE_RESOURCES = [["timber", "wood"], ["stone", "stone"]] as const satisfies readonly (readonly [ResourceType, string])[];

export function constructionWorkProgress(site: ConstructionSite, presentationProgress?: number): number {
  if (presentationProgress !== undefined && Number.isFinite(presentationProgress)) return Math.max(0, Math.min(1, presentationProgress));
  return site.requiredBuilderTicks === 0 ? 1 : Math.min(1, site.builderTicks / site.requiredBuilderTicks);
}

/** 0 plot, 1 foundation, 2 frame, 3 roof (the art's stage bands). */
export function constructionStageIndex(progress: number): 0 | 1 | 2 | 3 {
  return progress < STAGE_BOUNDS[1] ? 0 : progress < STAGE_BOUNDS[2] ? 1 : progress < STAGE_BOUNDS[3] ? 2 : 3;
}

export function constructionPhase(site: ConstructionSite): ConstructionPhase {
  return constructionMaterialStatus(site).complete ? "work" : "materials";
}

/** Delivered share of all required materials (1 when nothing is required). */
export function constructionMaterialShare(site: ConstructionSite): number {
  let required = 0, delivered = 0;
  for (const [resource, amount] of Object.entries(site.required) as [ResourceType, number][]) {
    required += amount;
    delivered += Math.min(amount, site.delivered[resource] ?? 0);
  }
  return required === 0 ? 1 : delivered / required;
}

export type PileLevels = Readonly<{ wood: 0 | 1 | 2 | 3; stone: 0 | 1 | 2 | 3 }>;
export function constructionPileLevels(site: ConstructionSite, progress: number): PileLevels {
  const phase = constructionPhase(site);
  const stage = constructionStageIndex(progress);
  const level = (resource: ResourceType): 0 | 1 | 2 | 3 => {
    const required = site.required[resource] ?? 0;
    if (required === 0) return 0;
    if (phase === "work") return Math.max(0, 3 - stage) as 0 | 1 | 2 | 3;
    const share = Math.min(required, site.delivered[resource] ?? 0) / required;
    return share <= 0 ? 0 : share < 0.3 ? 1 : share < 0.7 ? 2 : 3;
  };
  const levels = Object.fromEntries(PILE_RESOURCES.map(([resource, pile]) => [pile, level(resource)]));
  return levels as unknown as PileLevels;
}

/** Fill of each of the four stage cells (work phase), 0..1. */
export function constructionBarCells(progress: number): readonly [number, number, number, number] {
  const cell = (index: number) => Math.max(0, Math.min(1, (progress - STAGE_BOUNDS[index]!) / (STAGE_BOUNDS[index + 1]! - STAGE_BOUNDS[index]!)));
  return [cell(0), cell(1), cell(2), cell(3)];
}

/** The blocker of a stall (the live stall: `currentConstructionStall`). */
export function constructionBlocker(site: ConstructionSite, stall: ConstructionSite["stall"] = site.stall): ConstructionBlocker | null {
  switch (stall) {
    case "no_route": return "road";
    case "no_material_source": case "reserve_held": return "materials";
    case "no_builders": return "workers";
    default: return null;
  }
}

/** The first material still owed (its delivered / required), for the materials phase line. */
export function constructionOwedMaterial(site: ConstructionSite): { readonly resource: ResourceType; readonly delivered: number; readonly required: number } | null {
  for (const [resource, required] of Object.entries(site.required) as [ResourceType, number][]) {
    const delivered = Math.min(required, site.delivered[resource] ?? 0);
    if (delivered < required) return { resource, delivered, required };
  }
  return null;
}

/**
 * Work-phase arrival tick: the builder ticks left at the site's builders (each adds one per tick), no sooner than the
 * minimum visible time. Null when no work can run (materials phase or no builders): the plaque shows the reason.
 */
export function constructionArrivalEstimate(site: ConstructionSite, tick: number): number | null {
  if (constructionPhase(site) !== "work" || site.assignedBuilders <= 0) return null;
  const left = Math.max(0, site.requiredBuilderTicks - site.builderTicks) / site.assignedBuilders;
  return Math.max(tick + Math.ceil(left), site.startedTick + CONSTRUCTION.MIN_VISIBLE_TICKS);
}

// Shown arrivals only move earlier (design: "줄어들기만"). Presentation memory, not state: key = site id (a site's id
// is never reused); the estimate reads only the site and the tick, so nothing outside the key changes it; entries of
// sites that are gone are dropped when the next estimate is asked for (at most the live sites, a few dozen numbers).
const shownArrival = new Map<string, number>();
export function shownConstructionArrival(site: ConstructionSite, tick: number, liveIds?: ReadonlySet<string>): number | null {
  if (liveIds !== undefined) for (const id of shownArrival.keys()) if (!liveIds.has(id)) shownArrival.delete(id);
  const estimate = constructionArrivalEstimate(site, tick);
  if (estimate === null) return null;
  const previous = shownArrival.get(site.id);
  const shown = previous === undefined ? estimate : Math.min(previous, estimate);
  shownArrival.set(site.id, shown);
  return shown;
}
