/**
 * GB-3 (GROW-BLOCK, the user's ruling 2026-10-09; renderer A's engine-play2-reads.md §4): "the town's palisade plan —
 * where it stands and what blocks it", read from the town agency's own state. Its stage:
 *  - `past`: the market charter is proclaimed (or the town is past the hamlet);
 *  - `waiting`: a condition unmet — each with the project that meets it (`ERA_REQUIREMENT_PROJECT`);
 *  - `sites`: every condition met, but the search waits for the building sites open (with the oldest's age);
 *  - `searching`: the town's turn to find the wall (its next week's walk);
 *  - `asked`: it found one and asks the lord to proclaim (`lordRequests`);
 *  - `failed`: the last search found none — why (`CharterWallFailureReason`), the homes a wall would cut from their
 *    service space, how often it failed, and when it searches again (a wider ring, or the lord's ring first).
 * Lord mode only; the rules never read it.
 */
import { ERA_REQUIREMENT_PROJECT } from "../content/charterRingConfig";
import type { EraRequirementKey } from "../content/eraConfig";
import { isBuildingConstructionSite } from "../economy/construction";
import type { GameState } from "./engine.types";
import { evaluateEraRequirements } from "./era";
import { charterRetryTick, lordMode, lordRequests } from "./townAgency";
import type { CharterWallFailureReason } from "./townAgency.types";

export interface CharterWallPlan {
  readonly stage: "past" | "waiting" | "sites" | "searching" | "asked" | "failed";
  readonly requirements: readonly { readonly key: EraRequirementKey; readonly label: string; readonly current: number; readonly target: number; readonly met: boolean; readonly project: string | null }[];
  /** `sites`: the building sites the search waits on, oldest first, each with the tick it was laid out (when known). */
  readonly sites: readonly { readonly id: string; readonly kind: string; readonly since: number | null }[];
  readonly failure: { readonly tick: number; readonly reason: CharterWallFailureReason; readonly homes: readonly string[]; readonly attempts: number; readonly retryTick: number } | null;
}

/** GB-3 API: the market charter's wall as the town sees it now; null outside lord mode. */
export function charterWallPlan(state: GameState): CharterWallPlan | null {
  if (!lordMode(state)) return null;
  const agency = state.agency!;
  const requirements = state.era === "hamlet" ? evaluateEraRequirements(state).map(requirement => ({ key: requirement.key, label: requirement.label,
    current: requirement.current, target: requirement.target, met: requirement.met, project: ERA_REQUIREMENT_PROJECT[requirement.key] })) : [];
  const failed = agency.charterWallFailure;
  const failure = failed === undefined ? null : { ...failed, retryTick: charterRetryTick(failed) };
  const sites = state.constructionSites.filter(isBuildingConstructionSite)
    .map(site => ({ id: site.id, kind: site.kind, since: site.startedTick }))
    .sort((left, right) => (left.since ?? 0) - (right.since ?? 0));
  const stage: CharterWallPlan["stage"] = state.era !== "hamlet" ? "past"
    : requirements.some(requirement => !requirement.met) ? "waiting"
    : lordRequests(state).some(action => action.kind === "proclaim_era") ? "asked"
    : sites.length > 0 ? "sites"
    : failure !== null ? "failed" : "searching";
  return { stage, requirements, sites: stage === "sites" ? sites : [], failure };
}
