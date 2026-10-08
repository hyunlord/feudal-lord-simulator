import { BALANCE } from "../../content/balanceConfig";
import type { GameState } from "../../engine/engine.types";
import { lordSlice, lordSliceOutcome } from "../../engine/lordSlice";
import { storySeen } from "../../engine/storySeen";
import { yearOfTick } from "../chronicle/chronicleScreenModel";
import { perState } from "../perState";

// LM-R3 phase 2a: when the lord slice's two pages open (docs/design/lord-slice.md LS-1, LS-5).
// - The opening page: once, as a lord-slice game the welcome's house step started begins (its first tick) — within its first season and
//   not marked seen (`slice-start`). The request is the start's (the welcome sends start_new_game, which remounts the app,
//   so it is kept outside React as the start hint is); a load or a harness's state is no start and opens no page.
// - The end: once, when `lordSliceOutcome(state).ended` turns true — within the end's season and not marked opened
//   (`slice-end`, the engine's seen mark, kept in the save), so a load does not open it again. It stops time (a modal).
//   The player reopens it from the chronicle or the pause menu (`sliceEnded`).
// - The user's ruling (2026-10-09): at the live end the page replaces the slice's last year card and the season card of
//   the end's season — neither opens by itself (`sliceEndOwnsTurn`); the page links to both, and as it opens it marks the
//   last year's card seen (`year-review:<year>`), so it never pops later.

export const SLICE_START_ID = "slice-start";
export const SLICE_END_ID = "slice-end";
/** A page is due only this long after its moment (one season, as a chapter's page). */
const SEASON = BALANCE.TICKS_PER_YEAR / 4;

let startRequested = false;
/** The slice's outcome, once per state (the story hook and App read it every render). */
const outcomeOf = perState(lordSliceOutcome);

/** The welcome started a lord-slice game: its opening page is due once the game is up. */
export function requestSliceStart(): void {
  startRequested = true;
}

/** The start's request, taken as its page opens (only then: the old game's state may still be up as the start is sent). */
export function takeSliceStart(): void {
  startRequested = false;
}

/**
 * The opening page is due: a slice game the welcome just started, from its first tick to the end of its first season,
 * not seen. A new game stands at tick 0 until the player starts time; the first tick seats the factions and the
 * neighbour houses (at tick 0 the estates still carry the opening's names), so the page waits for it.
 */
export function sliceStartDue(state: GameState, requested = startRequested): boolean {
  return requested && lordSlice(state) && state.tick >= 1 && state.tick < SEASON && storySeen(state, SLICE_START_ID) === null;
}

/** The slice has ended (its page can be reopened). */
export const sliceEnded = (state: GameState): boolean => outcomeOf(state)?.ended === true;

/** The end page is due: ended, within the end's season, not opened before (the save's mark). */
export function sliceEndDue(state: GameState): boolean {
  const outcome = outcomeOf(state);
  return outcome?.ended === true && state.tick - outcome.endTick < SEASON && storySeen(state, SLICE_END_ID)?.opened !== true;
}

/** The slice's last year (the year of the tick before its end), or null outside the slice. */
export function sliceLastYear(state: GameState): number | null {
  const outcome = outcomeOf(state);
  return outcome === null ? null : yearOfTick(state, outcome.endTick - 1);
}

/** The end page is due now, so the turn's own cards stay shut: the last year's card (`year`) and the season card. */
export function sliceEndOwnsTurn(state: GameState, year: number | null = null): boolean {
  return sliceEndDue(state) && (year === null || year === sliceLastYear(state));
}

/** The marks the end page writes as it opens: its own, and the last year's card's (`yearCardId`), which it replaces. */
export function sliceEndMarkIds(state: GameState, yearCardId: (year: number) => string): readonly string[] {
  const last = sliceLastYear(state);
  return last === null ? [SLICE_END_ID] : [SLICE_END_ID, yearCardId(last)];
}

/** Which of the slice's pages the story hook opens now (the start before anything; the end in the turn's cards' place). */
export function slicePageDue(state: GameState): "slice_start" | "slice_end" | null {
  if (sliceStartDue(state)) return "slice_start";
  return sliceEndDue(state) ? "slice_end" : null;
}
