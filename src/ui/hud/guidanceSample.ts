import type { GameSpeed, GameState } from "../../engine/engine.types";

/** The HUD's guidance sample while time runs: one state per this many ticks (3 s at 1×). */
export const GUIDANCE_SAMPLE_TICKS = 60;

/**
 * QA-030: the key of the state the HUD's guidance reads (the status pill's food days, the warning stack, stuck goods,
 * the settlement line). Running, it is the 60-tick bucket (the scans run at most once a sample). Paused, it is the
 * state itself: a paused HUD showed the bucket's first state, up to 59 ticks old (the QA's 208 days at t160783 were
 * t160740's; the save and the load held 204), and now shows the state a save captures. Paused, the state changes only
 * on a command, so this costs no extra scans while time stands.
 */
export function guidanceSampleKey(state: GameState, speed: GameSpeed): GameState | number {
  return speed === 0 ? state : Math.floor(state.tick / GUIDANCE_SAMPLE_TICKS);
}
