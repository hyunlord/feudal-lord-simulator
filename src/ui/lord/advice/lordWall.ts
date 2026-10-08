import { BUILDING_CONFIG_BY_KIND, type BuildingKind } from "../../../content/buildingConfig";
import type { GameState } from "../../../engine/engine.types";
import { evaluateEraRequirements } from "../../../engine/era";
import { lordMode, lordRequests } from "../../../engine/townAgency";
import { lordLevers, type TownNeed } from "./lordAdvice";
import { LORD_WALL_COPY as COPY } from "./lordWallCopy.ko";

// PLAY-2 (Astra's second lord-mode play, friction 10: the goal drawer said "추천 경로를 만들지 못했습니다 · 직접 그어
// 주세요" beside "영주는 방침과 장려금으로 그 순서를 움직입니다"): in lord mode the palisade's line is the town's — its
// charter search finds one and asks the lord to proclaim (`lordRequests`: proclaim_era, TA-7/TA-11) — so the era
// console says where the market charter stands, read from the town agency's own state:
//  - the town's request is waiting: answer it (its chip);
//  - a condition is unmet: the request comes once it is met; the lord's first lever for it (lordAdvice) — the houses for
//    the population, the building for a building's count; a stock (the timber) has no project of its own here;
//  - all met and the town's last search found no line (`charterWallTried`): only then does the lord draw it himself, and
//    the guidance says so (with the recommendation's own failure when it gives one);
//  - all met otherwise: the town's turn to find it.
// The engine still takes the lord's own drawing (`confirm_palisade_proclamation` is not shut in lord mode); the console
// keeps its button. Null outside lord mode or past the hamlet.

export type LordWallGuidance = Readonly<{ line: string; next: string | null }>;

function needOf(key: string): TownNeed | null {
  if (key === "population") return { kind: "houses" };
  return key in BUILDING_CONFIG_BY_KIND ? { kind: "building", building: key as BuildingKind } : null;
}

export function lordWallGuidance(state: GameState, failure: string | null): LordWallGuidance | null {
  if (!lordMode(state) || state.era !== "hamlet") return null;
  if (lordRequests(state).some(action => action.kind === "proclaim_era")) return { line: COPY.asked, next: null };
  const unmet = evaluateEraRequirements(state).find(requirement => !requirement.met);
  if (unmet !== undefined) {
    const need = needOf(unmet.key);
    return { line: COPY.waiting(unmet.label, unmet.current, unmet.target), next: need === null ? null : lordLevers(state, need)[0] ?? null };
  }
  if (state.agency?.charterWallTried !== undefined) return { line: COPY.notFound, next: COPY.drawWhy(failure) };
  return { line: COPY.searching, next: null };
}
