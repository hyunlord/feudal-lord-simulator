import { BALANCE } from "../../content/balanceConfig";
import { traceInRange } from "../../engine/decisionReads";
import type { GameState } from "../../engine/engine.types";
import { lordMode } from "../../engine/townAgency";
import { yearOfTick } from "../chronicle/chronicleScreenModel";
import { recordIndex } from "../chronicle/historyIndex";
import { perState } from "../perState";
import { decisionSubjectWords, preparedOnly, traceGroups } from "./decisionThread";
import { RESULTS_COPY } from "./resultsCopy.ko";

const YEAR = BALANCE.TICKS_PER_YEAR;

export type YearResults = Readonly<{
  year: number;
  /** Everything that followed the lord's decisions this year (each record or mind it moved: the engine's trace rows). */
  count: number;
  /** By decision, the most first: its chip title and how many followed it. */
  items: readonly Readonly<{ decisionId: string; decisionTick: number; title: string; count: number }>[];
}>;

/**
 * LS1-4 (lord-screen-v1.md): what the lord's decisions (his answers and his silences) led to this calendar year — the
 * engine's `traceInRange` from the year's first tick, grouped by decision; the steward's answers are his season report's
 * (the design's table, layer ④). Null when nothing followed yet (no chip). Lord mode.
 */
export const yearResults = perState((state: GameState): YearResults | null => {
  if (!lordMode(state)) return null;
  const from = state.tick - (state.tick % YEAR);
  const groups = traceGroups(state, traceInRange(state, from, state.tick + 1)).filter(group => group.by !== "steward");
  if (groups.length === 0) return null;
  const index = recordIndex(state);
  const items = groups.map(group => {
    const subject = decisionSubjectWords(state, index.get(group.decisionId)!);
    const year = yearOfTick(state, group.decisionTick);
    return { decisionId: group.decisionId, decisionTick: group.decisionTick, count: group.rows.length,
      title: preparedOnly(group.rows) ? RESULTS_COPY.trace.preparedChip(year, subject) : RESULTS_COPY.trace.chipTitle(year, group.by, subject) };
  }).sort((left, right) => right.count - left.count || left.decisionTick - right.decisionTick);
  return { year: yearOfTick(state, from), count: items.reduce((sum, item) => sum + item.count, 0), items };
});
