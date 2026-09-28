/**
 * F4-A: the town in chapter 4 (fixture `chapter-four-town`, the F3-A guardrail's seed 1 at the winter of 1368) and a
 * run of it that answers each petition as it comes — the game command, as the player's card or the bot sends it.
 */
import type { PetitionResponse } from "../../src/content/chapterConfig";
import type { GameState } from "../../src/engine/engine.types";
import { openPetitions } from "../../src/engine/politics";
import { advanceTick } from "../../src/engine/tick";
import { gameReducer } from "../../src/state/gameStore";

export { clothTown as reorganisationTown, placeNear } from "./clothTown";

export type Answers = Partial<Record<string, PetitionResponse>>;

/** Ticks to `until`, answering each petition in `answers` as it comes (the rest left open). */
export function runAnswering(state: GameState, until: number, answers: Answers, watch?: (state: GameState) => void): GameState {
  let next = state;
  while (next.tick < until) {
    next = advanceTick(next);
    for (const petition of openPetitions(next)) {
      const response = answers[petition.defId];
      if (response !== undefined) next = gameReducer(next, { type: "petition_response", petitionId: petition.id, response });
    }
    watch?.(next);
  }
  return next;
}

/** The state moved to just before `tick` (a later clause's start): the calendar only, nothing else edited. */
export function movedTo(state: GameState, tick: number): GameState {
  return { ...state, tick: tick - 1 };
}
