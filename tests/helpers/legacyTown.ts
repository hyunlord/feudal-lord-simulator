/**
 * F5-A: a town in chapter 5 — the chapter-4 town (fixture `chapter-four-town`, winter 1368) moved on the calendar to
 * the spring of 1384 (the town's demand for a charter falls due), the charter answered as `charter` says (the game
 * command), run to chapter 5's first season. Then `runAnswering` and `movedTo` (tests/helpers/reorganisationTown.ts)
 * carry it through chapter 5.
 */
import { BOROUGH_CHARTER_PETITION_ID } from "../../src/content/reorganisationConfig";
import type { PetitionResponse } from "../../src/content/chapterConfig";
import type { GameState } from "../../src/engine/engine.types";
import { clothTown } from "./clothTown";
import { movedTo, runAnswering } from "./reorganisationTown";

export { movedTo, runAnswering } from "./reorganisationTown";

const YEAR = 4000;
const startYear = 1300;
export const at = (year: number, season = 0) => (year - startYear) * YEAR + season * 1000;

/** The chapter-4 town in chapter 5's first season (its charter answered `charter` in 1384). */
export function legacyTown(charter: PetitionResponse = "accept"): GameState {
  let state = movedTo(clothTown(), at(1384));
  const answers = { [BOROUGH_CHARTER_PETITION_ID]: charter };
  for (let step = 0; step < 8 && state.legacy === undefined; step += 1) state = runAnswering(state, state.tick + 1000, answers);
  if (state.legacy === undefined) throw new Error(`chapter 5 did not begin (chapter ${state.politics?.chapter.number}, tick ${state.tick})`);
  return state;
}
