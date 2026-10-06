import { BUILDING_CONFIG_BY_KIND, type BuildingKind } from "../../../content/buildingConfig";
import { SCENARIO_COPY } from "../../../content/scenario/scenarioCopy.ko";
import {
  AGENCY_WEEK_TICKS, builderOfKind, CHARTER_HOLD_WEEKS, OPEN_SITES_MAX, OPPORTUNITY_KINDS, policyWeight, START_SCORE, SUBSIDY_POINTS_PER_10D,
} from "../../../content/townAgencyConfig";
import { isBuildingConstructionSite } from "../../../economy/constructionSiteAccessors";
import type { GameState } from "../../../engine/engine.types";
import { stateCalendar } from "../../../engine/scenarioState";
import { lordMode, lordRequests } from "../../../engine/townAgency";
import type { EstatePolicy } from "../../../engine/townAgency.types";
import { moneyFull } from "../../money.ko";
import { POLICY_COPY } from "../policyCopy.ko";
import { LORD_ADVICE_COPY as COPY } from "./lordAdviceCopy.ko";

// DEC-CARD A1 (Astra's lord-mode play, 2026-10-06): "곡창을 하나 더 지으세요" told a lord to build, and in lord mode he
// cannot (TA-1: the town builds; the engine refuses his placements but the keep). Every lord-mode advice that names a
// thing the town lacks goes through here instead: first what the town is doing about it — read from the town agency's
// own state (a site of that kind open, the charter hold, every site busy, the last week's candidates with their score
// and their builder's money, the week's receipts) — then what the lord can set: the estate policy that weighs the
// kind most (POLICY_WEIGHTS, as the policy panel shows them), a subsidy on it (the kinds the town takes subsidies on),
// the encouraged zones (명령 › 장려 구역) and a request of the town's that waits for him. Nothing here decides what
// the town will do: the engine's scores and checks are only quoted (P-D4). Why one candidate is not started this week
// is not exposed as one reason (the engine request `townWaiting`, in the DEC-CARD report); the facts it would weigh are.

/** What the town lacks, as a project the town itself would start (TA-3's `what`). */
export type TownNeed =
  | Readonly<{ kind: "building"; building: BuildingKind }>
  | Readonly<{ kind: "road" }>
  | Readonly<{ kind: "houses" }>
  | Readonly<{ kind: "arable" }>;

const POLICIES: readonly EstatePolicy[] = ["growth", "revenue", "stability", "defence"];
const SUBSIDY_KINDS: ReadonlySet<BuildingKind> = new Set(OPPORTUNITY_KINDS);

/** The town agency's project key (a building kind, "road", "house", "zone:arable") and the policy weight's key. */
function keysOf(need: TownNeed): Readonly<{ what: string; policy: string; name: string }> {
  switch (need.kind) {
    case "building": return { what: need.building, policy: need.building, name: BUILDING_CONFIG_BY_KIND[need.building].name };
    case "road": return { what: "road", policy: "road", name: COPY.projects.road };
    case "houses": return { what: "house", policy: "house", name: COPY.projects.house };
    case "arable": return { what: "zone:arable", policy: "zone", name: COPY.projects.arable };
  }
}

const when = (state: GameState, tick: number): string => {
  const date = stateCalendar({ ...state, tick });
  return `${date.year}년 ${SCENARIO_COPY.seasons[date.season] ?? ""}`;
};

/** What the town is doing about the need now, from its own state; null outside lord mode. */
export function townStatus(state: GameState, need: TownNeed): string | null {
  const agency = state.agency;
  if (!lordMode(state) || agency === undefined) return null;
  const { what, name } = keysOf(need);
  const sites = state.constructionSites.filter(isBuildingConstructionSite);
  if (need.kind === "building" && sites.some(site => site.kind === need.building)) return COPY.underway(name);
  // TA-12: a town ready for its charter holds new buildings for a while (the engine's charterSince and hold).
  const since = agency.charterSince;
  if (need.kind !== "road" && since !== undefined && state.tick - since < CHARTER_HOLD_WEEKS * AGENCY_WEEK_TICKS) return COPY.charterHold(when(state, since));
  if (sites.length >= OPEN_SITES_MAX) return COPY.sitesFull(sites.length, OPEN_SITES_MAX);
  // TA-13: the walk kept while the week started nothing — its candidates, best first (the engine's order).
  const walk = agency.lastWalk;
  if (walk !== undefined) {
    const candidate = walk.proposals.find(proposal => proposal.what === what);
    if (candidate === undefined) return COPY.notProposed(name);
    const actor = COPY.actors[candidate.actor];
    const funds = agency.actors.find(entry => entry.kind === candidate.actor)?.funds ?? 0;
    const line = COPY.candidate(name, actor, candidate.score, START_SCORE);
    return candidate.cost > funds ? `${line} · ${COPY.funds(actor, moneyFull(funds), moneyFull(candidate.cost))}` : line;
  }
  const week = agency.receipts.filter(receipt => receipt.tick > state.tick - AGENCY_WEEK_TICKS);
  if (week.length === 0) return COPY.startedNone;
  const names = [...new Set(week.map(receipt => receipt.what in BUILDING_CONFIG_BY_KIND ? BUILDING_CONFIG_BY_KIND[receipt.what as BuildingKind].name
    : receipt.what === "road" ? COPY.projects.road : receipt.what === "zone:arable" ? COPY.projects.arable : receipt.what === "zone:burgage" ? COPY.projects.burgage : null)
    .filter((entry): entry is string => entry !== null))];
  return names.length === 0 ? COPY.startedNone : COPY.started(names.join(" · "));
}

/** What the lord can set for the need, the strongest first: a waiting request, a zone, the policy, a subsidy. */
export function lordLevers(state: GameState, need: TownNeed): readonly string[] {
  const agency = state.agency;
  if (!lordMode(state) || agency === undefined) return [];
  const { policy: key, name } = keysOf(need);
  const levers: string[] = [];
  // TA-12: while the town holds its buildings for the charter, the lord's answer to its request is what moves it.
  if (agency.charterSince !== undefined && lordRequests(state).some(action => action.kind === "proclaim_era")) levers.push(COPY.request(COPY.requests.proclaim_era));
  if (need.kind === "arable") levers.push(COPY.zone(COPY.projects.arable));
  if (need.kind === "houses") levers.push(COPY.zone(COPY.projects.burgage));
  const best = POLICIES.map(policy => ({ policy, points: policyWeight(policy, key) })).filter(entry => entry.points > 0)
    .sort((left, right) => right.points - left.points)[0];
  const policyLine = best === undefined ? null : best.policy === agency.policy
    ? COPY.policyOn(POLICY_COPY.policies[best.policy], name, best.points) : COPY.policyOff(POLICY_COPY.policies[best.policy], name, best.points);
  const subsidy = need.kind === "building" && SUBSIDY_KINDS.has(need.building) ? agency.subsidies.find(entry => entry.kind === need.building) : undefined;
  const subsidyLine = need.kind !== "building" || !SUBSIDY_KINDS.has(need.building) ? null
    : subsidy !== undefined ? COPY.subsidyOn(name, moneyFull(subsidy.amount)) : COPY.subsidyOff(name, SUBSIDY_POINTS_PER_10D);
  // A policy already in force is no lever: the subsidy comes first then.
  const ordered = best !== undefined && best.policy === agency.policy ? [subsidyLine, policyLine] : [policyLine, subsidyLine];
  levers.push(...ordered.filter((line): line is string => line !== null));
  return levers;
}

/** The lord-mode advice for a need: what the town is doing, then the lord's levers (at most `max` lines). */
export function lordAdvice(state: GameState, need: TownNeed, max = 2): readonly string[] {
  const status = townStatus(state, need);
  return [...(status === null ? [] : [status]), ...lordLevers(state, need)].slice(0, max);
}

/** Who builds a kind in lord mode, in words ("곡창을 상인 가문이 짓습니다"). */
export function whoBuilds(kind: BuildingKind): string {
  return COPY.builds(BUILDING_CONFIG_BY_KIND[kind].name, COPY.actors[builderOfKind(kind)]);
}

/** The lean season's card in lord mode (the first winter's warning): a granary while the town has none, else fields —
 *  the sandbox's two, said as what the town does about it and the lord's lever; no button arms a placement. */
export function lordLeanSeason(state: GameState): Readonly<{ why: string; steward: string }> | null {
  if (!lordMode(state)) return null;
  const need: TownNeed = state.buildings.some(entry => entry.kind === "granary") ? { kind: "arable" } : { kind: "building", building: "granary" };
  return { why: COPY.leanWhy(COPY.join(lordAdvice(state, need))), steward: COPY.leanSteward };
}

/** The season card's next-objective hint in lord mode: the sandbox's words for what the town needs, then who answers
 *  it and the lord's first lever (its button opens 명령, where the lord's levers are); null keeps the sandbox's hint. */
export function lordSeasonHint(state: GameState, hint: string, text: string,
  needs: Readonly<{ arableCells: number; farmstead: boolean; mill: boolean }> | undefined): string | null {
  if (!lordMode(state)) return null;
  if (hint === "rebuild") return COPY.fireAftermath;
  const need: TownNeed | null = hint === "fire_break" ? { kind: "building", building: "well" }
    : hint !== "food_reserve" && hint !== "harvest_reserve" ? null
      : needs !== undefined && needs.arableCells > 0 ? { kind: "arable" }
        : needs?.farmstead === true ? { kind: "building", building: "farmstead" } : needs?.mill === true ? { kind: "building", building: "mill" }
          : { kind: "building", building: "granary" };
  const lever = need === null ? undefined : lordLevers(state, need)[0];
  return lever === undefined ? null : COPY.seasonHint(text, lever);
}
