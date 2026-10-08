import { preparedness, type Preparedness } from "../../../engine/crisisReads";
import type { GameState } from "../../../engine/engine.types";
import { famineShortHouses } from "../../../engine/eventSchedule";
import { famineStatus } from "../../../engine/politics";
import { lordMode } from "../../../engine/townAgency";
import { lordLevers, type TownNeed } from "./lordAdvice";
import { FAMINE_AFTER_COPY as COPY } from "./famineAfterCopy.ko";

// PLAY-2 (Astra's second lord-mode play, 2026-10-08: after answering the famine "I did not know what was still wrong or
// what to do next"): once the famine is answered, its card says the bottleneck the town still meets it with — the
// households its price still shuts out (`famineShortHouses`, the famine card's own count) and the engine's preparedness
// (`preparedness`, the same as `crisisReview(state).now`: its weak points and their numbers); none left says what was
// checked, with its numbers — and, in lord mode, the next condition the lord can set: the lord's first lever
// (lordAdvice: a waiting request, a zone, the policy, a subsidy) for the first weak point, in the engine's order, that a
// town project answers. Which project answers
// which weak point is the screen's reading of the point's own words (no granary → a granary, no market → a market, the
// stores under a season → the fields); the engine names no lever per weak point (docs/requests/engine-play2-reads.md).
// Households already short, and those the price shuts out, have no project of their own here. Read on every sampled state while the famine lasts
// (storyBeats): `preparedness` counts the buildings and the short households, `lordLevers` reads the policy weights.

type WeakPoint = Preparedness["weakPoints"][number];

const NEED: Readonly<Partial<Record<WeakPoint, TownNeed>>> = {
  no_granary: { kind: "building", building: "granary" }, no_market: { kind: "building", building: "market" }, food_under_a_season: { kind: "arable" },
};

const answered = (state: GameState): boolean => (famineStatus(state)?.response ?? null) !== null;

function pointWords(now: Preparedness, point: WeakPoint): string {
  switch (point) {
    case "food_under_a_season": return COPY.points.food_under_a_season(now.foodDays);
    case "households_short": return COPY.points.households_short(now.shortHouseholds);
    default: return COPY.points[point]();
  }
}

function needOf(now: Preparedness): TownNeed | null {
  const point = now.weakPoints.find(entry => NEED[entry] !== undefined);
  return point === undefined ? null : NEED[point]!;
}

/** The town need behind the first weak point a project answers (null: the famine not answered, or no such point). */
export function famineNeed(state: GameState): TownNeed | null {
  return answered(state) ? needOf(preparedness(state)) : null;
}

/** The famine card's lines once answered: the bottleneck left, then (lord mode) the next lever; [] before the answer. */
export function famineAfterFacts(state: GameState): readonly string[] {
  if (!answered(state)) return [];
  const now = preparedness(state);
  // The famine's own bottleneck first: the households its price still shuts out after the answer (none under relief).
  const shut = famineShortHouses(state).length;
  const points = [...(shut > 0 ? [COPY.priceShut(shut)] : []), ...now.weakPoints.map(point => pointWords(now, point))];
  const left = points.length === 0 ? COPY.none(now.granaries, now.markets, now.foodDays) : COPY.left(points.join(COPY.joiner));
  const need = lordMode(state) ? needOf(now) : null;
  const lever = need === null ? undefined : lordLevers(state, need)[0];
  return lever === undefined ? [left] : [left, COPY.next(lever)];
}
