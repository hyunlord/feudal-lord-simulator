import { BALANCE } from "../../content/balanceConfig";
import type { GameState } from "../../engine/engine.types";
import { lordSlice, lordSliceOutcome } from "../../engine/lordSlice";
import { storySeen } from "../../engine/storySeen";

// LM-R3 phase 2a: when the lord slice's two pages open (docs/design/lord-slice.md LS-1, LS-5).
// - The opening page: once, as a lord-slice game the welcome's house step started begins — within its first season and
//   not marked seen (`slice-start`). The request is the start's (the welcome sends start_new_game, which remounts the app,
//   so it is kept outside React as the start hint is); a load or a harness's state is no start and opens no page.
// - The end: once, when `lordSliceOutcome(state).ended` turns true — within the end's season and not marked opened
//   (`slice-end`, the engine's seen mark, kept in the save), so a load does not open it again. It stops time (a modal).
//   The player reopens it from the chronicle or the pause menu (`sliceEnded`).

export const SLICE_START_ID = "slice-start";
export const SLICE_END_ID = "slice-end";
/** A page is due only this long after its moment (one season, as a chapter's page). */
const SEASON = BALANCE.TICKS_PER_YEAR / 4;

let startRequested = false;

/** The welcome started a lord-slice game: its opening page is due once the game is up. */
export function requestSliceStart(): void {
  startRequested = true;
}

/** The start's request, taken as its page opens (only then: the old game's state may still be up as the start is sent). */
export function takeSliceStart(): void {
  startRequested = false;
}

/**
 * The opening page is due: a slice game the welcome just started, from its first tick (the factions and the neighbour
 * houses are set then — at tick 0 the estates still carry the opening's names) to the end of its first season, not seen.
 */
export function sliceStartDue(state: GameState, requested = startRequested): boolean {
  return requested && lordSlice(state) && state.tick >= 1 && state.tick < SEASON && storySeen(state, SLICE_START_ID) === null;
}

/** The slice has ended (its page can be reopened). */
export const sliceEnded = (state: GameState): boolean => lordSliceOutcome(state)?.ended === true;

/** The end page is due: ended, within the end's season, not opened before (the save's mark). */
export function sliceEndDue(state: GameState): boolean {
  const outcome = lordSliceOutcome(state);
  return outcome?.ended === true && state.tick - outcome.endTick < SEASON && storySeen(state, SLICE_END_ID)?.opened !== true;
}

/** Which of the slice's pages the story hook opens now (the start before anything; the end after the year's card). */
export function slicePageDue(state: GameState, yearCardWaiting: boolean): "slice_start" | "slice_end" | null {
  if (sliceStartDue(state)) return "slice_start";
  return !yearCardWaiting && sliceEndDue(state) ? "slice_end" : null;
}
