import { BALANCE } from "../content/balanceConfig";
import { formatSaveSummaryLine, type SaveProblemKey } from "../content/saveCopy.ko";
import type { GameState } from "../engine/engine.types";
import { getSettlementView } from "../engine/settlementView";
import type { SaveSummary } from "./saveTypes";

export function createSaveSummary(state: GameState): SaveSummary {
  const crisis = getSettlementView(state).crisis;
  const problem: SaveProblemKey | null = crisis === "none" ? null : crisis;
  const elapsedMinutes = Math.floor(state.tick / BALANCE.TICKS_PER_SECOND / 60);
  const summary = { elapsedTicks: state.tick, elapsedMinutes, population: state.population, era: state.era, problem };
  return { ...summary, line: formatSaveSummaryLine(summary) };
}
