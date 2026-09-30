/** LM-E1 (TA-6 ③): the lord's market dues, permille of the usual stall fee (1000‰ outside lord mode). */
import type { GameState } from "./engine.types";

export function agencyDuesPermille(state: Pick<GameState, "agency">): number {
  return state.agency?.duesPermille ?? 1000;
}
