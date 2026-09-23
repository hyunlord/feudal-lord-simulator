import type { GameState } from "../engine/engine.types";

export const AUTOSAVE_INTERVAL_MS = 60_000;

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
