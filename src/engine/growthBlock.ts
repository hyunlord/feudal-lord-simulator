/**
 * GROW-BLOCK-2a (the user's ruling 2026-10-11/12; renderer A's LS1-3 growth line "the town has not grown since N — because
 * …"): what holds the lord's town from growing now, and the lord's existing command that can lift it. Read from the
 * state the rules already keep; lord mode only, and the rules never read it.
 *  - `reason`: the first block in the town's growth path — the charter (its unmet condition, the town still searching,
 *    its request waiting for the lord, its wall not found), the wall's work, the food, the houses' next level (the church
 *    or market a house lacks, the church's stone), the lots inside the wall, a full town;
 *  - `lever`: one of the commands lord mode gives its player that lifts it (`order_timber`, `set_project_subsidy` for a
 *    building, `set_wall_construction_priority`, the town's request card), or null — the lord has no verb for it (a gap
 *    the screen design takes up: a full town, fields over the walled lots, a wall not found — drawing it is a build
 *    command, the sandbox's, GB2A-8);
 *  - `since`: the tick the town last grew — null until its save field comes with the next save version (v56, TRACE-LINK).
 */
import type { BuildingKind } from "../content/buildingConfig";
import { isWallConstructionSite } from "../economy/construction";
import { houseHasFood } from "../population/houseFood";
import { charterWallPlan } from "./charterPlan";
import type { GameState } from "./engine.types";
import { evaluateEraRequirements } from "./era";
import { householdServices } from "./householdServices";
import { LORD_MODE_POLICY, lordMode } from "./townAgency";
import { interiorHouseSites } from "./autoplayInteriorPlots";
import { autoplayCanPlace } from "./autoplayZones";

export type GrowthBlockReason = "era_condition" | "charter_search" | "wall_not_found" | "charter_asked" | "wall_building" | "service_missing"
  | "service_outside" | "food" | "no_lots" | "town_full";

export type GrowthLever =
  | { readonly kind: "order_timber" }
  | { readonly kind: "subsidy"; readonly building: BuildingKind }
  | { readonly kind: "wall_priority" }
  | { readonly kind: "answer_request" };

export interface GrowthBlock {
  readonly reason: GrowthBlockReason;
  /** The condition, service or failure behind the reason (`timber`, `church`, `service_space`, …). */
  readonly detail: string | null;
  readonly since: number | null;
  readonly lever: GrowthLever | null;
}

/** The building each era condition's project raises (the town's own `ERA_REQUIREMENT_PROJECT` beside the timber). */
const CONDITION_LEVER: Readonly<Record<string, GrowthLever | null>> = {
  timber: { kind: "order_timber" }, population: null, granary: { kind: "subsidy", building: "granary" },
  chapel: { kind: "subsidy", building: "chapel" }, market: { kind: "subsidy", building: "market" },
  masonry: { kind: "subsidy", building: "masonry" }, stone: { kind: "subsidy", building: "quarry" }, coin: null,
};

const block = (reason: GrowthBlockReason, detail: string | null, lever: GrowthLever | null): GrowthBlock => ({ reason, detail, since: null, lever });

/** GROW-BLOCK-2a API: why the lord's town is not growing now, and the lord's lever; null outside lord mode or while it grows. */
export function growthBlock(state: GameState): GrowthBlock | null {
  if (!lordMode(state)) return null;
  // The charter first: its unmet condition, the town still searching or waiting on its sites, its request, its failure.
  const plan = charterWallPlan(state);
  if (plan !== null && plan.stage !== "past") {
    const unmet = plan.requirements.find(requirement => !requirement.met);
    if (unmet !== undefined && unmet.key !== "population") return block("era_condition", unmet.key, CONDITION_LEVER[unmet.key] ?? null);
    if (plan.stage === "asked") return block("charter_asked", null, { kind: "answer_request" });
    // GB2A-8: the lord draws no wall himself — lord mode's player has no build command, so no lever.
    if (plan.stage === "failed") return block("wall_not_found", plan.failure?.reason ?? null, null);
    if (unmet === undefined) return block("charter_search", plan.stage, null);
  }
  const walls = state.constructionSites.filter(isWallConstructionSite);
  if (walls.length > 0) return block("wall_building", walls[0]!.stall ?? null, state.wallConstructionPriority === "priority" ? { kind: "order_timber" } : { kind: "wall_priority" });
  if (state.houses.some(house => house.residents > 0 && !houseHasFood(house))) return block("food", null, { kind: "subsidy", building: "farmstead" });
  // The houses' next level: the church or market a house below level 4 lacks (the church's stone: its chain's first missing link).
  const services = householdServices(state);
  const below = state.houses.filter(house => house.level < 4);
  for (const kind of ["church", "market"] as const) {
    const lacking = below.map(house => services.houses.get(house.buildingId)?.[kind].kind).filter(access => access !== undefined && access !== "served");
    if (lacking.length === 0) continue;
    if (lacking.includes("missing")) {
      const stoneUnmet = evaluateEraRequirements(state).some(requirement => requirement.key === "stone" && !requirement.met);
      const chain: BuildingKind | undefined = kind === "church" && stoneUnmet
        ? (["masonry", "quarry"] as const).find(link => !state.buildings.some(building => building.kind === link)) : undefined;
      return block("service_missing", kind, { kind: "subsidy", building: chain ?? kind });
    }
    return block("service_outside", kind, { kind: "subsidy", building: kind });
  }
  // The lots: none free inside the wall (fields, room) while the plan wants more.
  const lots = LORD_MODE_POLICY.maxHousingLots;
  if (state.houses.length < lots) {
    if (state.palisade === null) return null;
    const free = interiorHouseSites(state).filter(site => autoplayCanPlace(state, "house", site.tx, site.ty, "later"));
    return free.length === 0 ? block("no_lots", null, null) : null;
  }
  return below.length === 0 ? block("town_full", null, null) : null;
}
