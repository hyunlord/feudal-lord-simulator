import { BALANCE } from "../content/balanceConfig";
import type { GameState } from "../engine/engine.types";

export const AUTOSAVE_INTERVAL_MS = 60_000;
/**
 * SMOOTH-2E: a save (but a manual one or the tab's hiding) starts no sooner than this after the season turns — the
 * turn's own work, the season's card and the pause it brings all land in that second (SMOOTH-1: 65 % of autosaves).
 */
export const AUTOSAVE_SEASON_GAP_MS = 2_000;

export type SaveReason = "interval" | "pause" | "hidden" | "palisade_proclaimed" | "era_changed" | "manual";

/** Major decisions that deserve a save right after the tick that applied them. */
export function decisionSaveReason(previous: GameState, next: GameState): SaveReason | null {
  if (previous.palisade === null && next.palisade !== null) return "palisade_proclaimed";
  if (previous.era !== next.era) return "era_changed";
  return null;
}

/**
 * GameState is immutable between ticks, so "changed" is identity against the last saved
 * state. An untouched new game (or a just-loaded one) never overwrites older saves.
 */
export function shouldAutosave(input: {
  readonly reason: SaveReason;
  readonly state: GameState;
  readonly lastSavedState: GameState | null;
  readonly lastSavedAtMs: number;
  readonly nowMs: number;
}): boolean {
  if (input.reason === "manual") return true;
  if (input.state === input.lastSavedState) return false;
  if (input.reason === "interval") return input.nowMs - input.lastSavedAtMs >= AUTOSAVE_INTERVAL_MS;
  return true;
}

/** The tick crossed into another season (the calendar's quarter of `BALANCE.TICKS_PER_YEAR`). */
export function seasonTurned(previous: Pick<GameState, "tick">, next: Pick<GameState, "tick">): boolean {
  return Math.floor((previous.tick * 4) / BALANCE.TICKS_PER_YEAR) !== Math.floor((next.tick * 4) / BALANCE.TICKS_PER_YEAR);
}

/** How long a save asked for now waits: until `AUTOSAVE_SEASON_GAP_MS` after the last season turn (never for a manual or hidden-tab save). */
export function autosaveDelayMs(reason: SaveReason, lastSeasonTurnAtMs: number | null, nowMs: number): number {
  if (reason === "manual" || reason === "hidden" || lastSeasonTurnAtMs === null) return 0;
  return Math.max(0, lastSeasonTurnAtMs + AUTOSAVE_SEASON_GAP_MS - nowMs);
}
