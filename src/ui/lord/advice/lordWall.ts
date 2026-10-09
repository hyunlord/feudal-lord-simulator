import { BALANCE } from "../../../content/balanceConfig";
import { BUILDING_CONFIG_BY_KIND, type BuildingKind } from "../../../content/buildingConfig";
import { charterWallPlan, type CharterWallPlan } from "../../../engine/charterPlan";
import type { GameState } from "../../../engine/engine.types";
import { history } from "../../../engine/history";
import { scenarioOf } from "../../../engine/scenarioState";
import type { TileCoordinate } from "../../../world/grid";
import { calendarArrivalLabel } from "../../calendarArrival";
import { ERA_CONSOLE_COPY } from "../../eraConsoleCopy.ko";
import { LORD_CARDS_COPY } from "../../lordCardsCopy.ko";
import { perState } from "../../perState";
import { lordLeverPlaces, needOfProject, whoBuilds, type LordLever } from "./lordAdvice";
import { LORD_WALL_COPY as COPY } from "./lordWallCopy.ko";

// GROW-BLOCK (the user's ruling 2026-10-09; PLAY-2 friction 10 before it): in lord mode the palisade's line is the
// town's — its charter search finds one and asks the lord to proclaim (`lordRequests`: proclaim_era, TA-7/TA-11) — so
// the era console's one primary is "마을의 목책 계획": where the plan stands and what holds it, all read from the
// engine's `charterWallPlan` (its stage, each condition with the project that meets it, the sites the search waits on,
// the last failure) and the town's own records (the sites it gave up: `agency.site_abandoned`'s sentence). Nothing here
// decides a stage or a project: the engine's are quoted (P-D4). Per stage:
//  - waiting: each unmet condition, who builds its project and the lord's first lever, with the way to where he sets it;
//  - sites: the sites holding the search, how long each has stood, and the sites the town gave up lately;
//  - searching / asked: the town's turn (its week's walk) / its request (answered on its own chip, as before);
//  - failed: why, the homes a wall would cut off (and the way to look at one), the attempts, when it searches again.
// Drawing the line by hand is the sandbox's (the console keeps no drawing button in lord mode). Null outside lord mode
// or past the hamlet (the console's normal state).

export type WallPlanCondition = Readonly<{ key: string; progress: string; project: string; lever: LordLever | null }>;

export type LordWallPlanView = Readonly<{
  stage: Exclude<CharterWallPlan["stage"], "past">;
  /** Where the plan stands: the line under the console's primary. */
  line: string;
  /** searching / asked: what happens next (the opened plan's own line); null in the other stages. */
  detail: string | null;
  conditions: readonly WallPlanCondition[];
  sites: readonly string[];
  abandoned: readonly string[];
  failure: Readonly<{ why: string; homes: string | null; homeTile: TileCoordinate | null; attempts: string; retry: string }> | null;
  /**
   * The seam for "성벽 둘레 지정" (the lord's own ring for the town's search): shown only while the search failed. The
   * engine has no lord command for it yet — its request §4 brings one; the console's button drops in on this flag then.
   */
  ringAllowed: boolean;
}>;

/** The town's last few given-up sites, newest first, as its records say them. */
const ABANDONED_SHOWN = 3;

function siteAge(state: GameState, since: number | null): string {
  if (since === null) return COPY.ageUnknown;
  const age = Math.max(0, state.tick - since);
  const years = Math.floor(age / BALANCE.TICKS_PER_YEAR);
  return COPY.age(years, Math.floor((age - years * BALANCE.TICKS_PER_YEAR) * 4 / BALANCE.TICKS_PER_YEAR));
}

const kindName = (kind: string): string => kind in BUILDING_CONFIG_BY_KIND ? BUILDING_CONFIG_BY_KIND[kind as BuildingKind].name : kind;

function abandonedLines(state: GameState): readonly string[] {
  const kept = [...(state.agency?.abandonedSites ?? [])].sort((left, right) => right.tick - left.tick).slice(0, ABANDONED_SHOWN);
  if (kept.length === 0) return [];
  const records = history.query(state, { kinds: ["event"], range: { from: kept.at(-1)!.tick } }).filter(record => record.template === "agency.site_abandoned");
  return kept.flatMap(site => {
    const record = records.find(entry => entry.params?.site === site.id);
    return record === undefined ? [] : [history.summary(record, state)];
  });
}

/** The view of an engine plan on its state (the tests give it the engine's read of a state they build). */
export function wallPlanView(state: GameState, plan: CharterWallPlan | null): LordWallPlanView | null {
  if (plan === null || plan.stage === "past") return null;
  const unmet = plan.requirements.filter(requirement => !requirement.met);
  const conditions = plan.stage !== "waiting" ? [] : unmet.map(requirement => {
    const need = needOfProject(requirement.project);
    const builder = requirement.project !== null && requirement.project in BUILDING_CONFIG_BY_KIND ? whoBuilds(requirement.project as BuildingKind) : null;
    return { key: requirement.key, progress: COPY.progress(requirement.label, ERA_CONSOLE_COPY.requirementProgress(requirement.key, requirement.current, requirement.target)),
      project: builder ?? COPY.noProject, lever: need === null ? null : lordLeverPlaces(state, need)[0] ?? null };
  });
  const failed = plan.stage === "failed" ? plan.failure : null;
  const home = failed === null ? undefined : state.buildings.find(building => failed.homes.includes(building.id));
  return {
    stage: plan.stage,
    line: plan.stage === "waiting" ? COPY.stage.waiting(unmet.length) : plan.stage === "sites" ? COPY.stage.sites(plan.sites.length) : COPY.stage[plan.stage],
    detail: plan.stage === "searching" ? COPY.detail.searching : plan.stage === "asked" ? COPY.detail.asked(LORD_CARDS_COPY.request.proclaim_era.title) : null,
    conditions,
    sites: plan.sites.map(site => COPY.site(kindName(site.kind), siteAge(state, site.since))),
    abandoned: plan.stage === "sites" ? abandonedLines(state) : [],
    failure: failed === null ? null : {
      why: COPY.reasons[failed.reason],
      homes: failed.homes.length === 0 ? null : COPY.homes(failed.homes.length),
      homeTile: home === undefined ? null : { tx: home.tx, ty: home.ty },
      attempts: COPY.attempts(failed.attempts),
      retry: COPY.retry(calendarArrivalLabel(state.tick, failed.retryTick, scenarioOf(state).startYear)),
    },
    ringAllowed: plan.stage === "failed",
  };
}

/** The palisade plan as the lord's era console shows it; null outside lord mode or past the hamlet. Once per state. */
export const lordWallPlan: (state: GameState) => LordWallPlanView | null = perState(state => wallPlanView(state, charterWallPlan(state)));
