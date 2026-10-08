import { BUILDING_CONFIG_BY_KIND, type BuildingKind } from "../../../content/buildingConfig";
import { WEAK_POINTS } from "../../../content/historyCopy.ko";
import { preparedness, type Preparedness } from "../../../engine/crisisReads";
import type { GameState } from "../../../engine/engine.types";
import { famineShortHouses } from "../../../engine/eventSchedule";
import { famineStatus } from "../../../engine/politics";
import { lordMode } from "../../../engine/townAgency";
import { lordLevers, townStatus, type TownNeed } from "./lordAdvice";
import { FAMINE_AFTER_COPY as COPY } from "./famineAfterCopy.ko";

// PLAY-2 (Astra's second lord-mode play, 2026-10-08: after answering the famine "I did not know what was still wrong or
// what to do next"): once the famine is answered, its card says the bottleneck the town still meets it with — the
// households its price still shuts out (`famineShortHouses`, the famine card's own count) and the engine's preparedness
// (`preparedness`, the same as `crisisReview(state).now`: its weak points and their numbers); none left says what was
// checked, with its numbers — and, in lord mode, the next condition the lord can set: the lord's first lever
// (lordAdvice: a waiting request, a zone, the policy, a subsidy) for the first weak point, in the engine's order, that
// has a town project. SUIT-THREAD: which project answers which weak point is the engine's (`preparedness().levers`, a
// building kind or `zone:<kind>`); households already short have none (relief feeds them), and those the price shuts out
// have no project here either. Read on every sampled state while the famine lasts (storyBeats): `preparedness` counts
// the buildings and the short households, `lordLevers` reads the policy weights.

type WeakPoint = Preparedness["weakPoints"][number];

/** The engine's project for a weak point as the lord's advice reads a need: `zone:arable` the fields, else a building. */
function needOfProject(project: string | null): TownNeed | null {
  if (project === null) return null;
  if (project === "zone:arable") return { kind: "arable" };
  return project in BUILDING_CONFIG_BY_KIND ? { kind: "building", building: project as BuildingKind } : null;
}

const answered = (state: GameState): boolean => (famineStatus(state)?.response ?? null) !== null;

/** A weak point in the chronicle's own words (the engine's WEAK_POINTS), with the engine's number where it has one. */
function pointWords(now: Preparedness, point: WeakPoint): string {
  const words = WEAK_POINTS[point] ?? point;
  switch (point) {
    case "food_under_a_season": return now.foodDays === null ? words : COPY.withDays(words, now.foodDays);
    case "households_short": return COPY.withCount(words, now.shortHouseholds);
    default: return words;
  }
}

function needOf(now: Preparedness): TownNeed | null {
  for (const lever of now.levers) { const need = needOfProject(lever.project); if (need !== null) return need; }
  return null;
}

/** The town need behind the first weak point a project answers (null: the famine not answered, or no such point). */
export function famineNeed(state: GameState): TownNeed | null {
  return answered(state) ? needOf(preparedness(state)) : null;
}

/** The famine card's lines once answered: the bottleneck left, then (lord mode) what the town is doing and the next lever; [] before. */
export function famineAfterFacts(state: GameState): readonly string[] {
  if (!answered(state)) return [];
  const now = preparedness(state);
  // The famine's own bottleneck first: the households its price still shuts out after the answer (none under relief).
  const shut = famineShortHouses(state).length;
  const points = [...(shut > 0 ? [COPY.priceShut(shut)] : []), ...now.weakPoints.map(point => pointWords(now, point))];
  const left = points.length === 0 ? COPY.none(now.granaries, now.markets, now.foodDays) : COPY.left(points.join(COPY.joiner));
  const need = lordMode(state) ? needOf(now) : null;
  if (need === null) return [left];
  // The report's "대기 상태": what the town is doing about it now (lordAdvice's townStatus), then the lever.
  const status = townStatus(state, need);
  const lever = lordLevers(state, need)[0];
  return [left, ...(status === null ? [] : [status]), ...(lever === undefined ? [] : [COPY.next(lever)])];
}
