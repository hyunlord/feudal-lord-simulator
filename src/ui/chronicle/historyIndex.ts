import type { GameState } from "../../engine/engine.types";
import type { HistoryRecord } from "../../engine/history.types";

// DEC-CARD-2: the history's records by id, and who made a decision — read by the chronicle's cards and the result thread.

/**
 * The records by id, once per records array (AGENTS rule 10): (a) the key is the records array itself — the engine makes
 * a new one whenever it writes a record; (b) nothing else enters; (c) cached because the season's chips and the chronicle's
 * cards look up the decision behind a record on every state, and the history holds thousands of records.
 */
const indexes = new WeakMap<readonly HistoryRecord[], ReadonlyMap<string, HistoryRecord>>();
export function recordIndex(state: Partial<Pick<GameState, "history">>): ReadonlyMap<string, HistoryRecord> {
  const records = state.history?.records ?? [];
  let index = indexes.get(records);
  if (index === undefined) { index = new Map(records.map(record => [record.id, record] as const)); indexes.set(records, index); }
  return index;
}

export type DecisionBy = "lord" | "steward" | "lapsed";

/** Who decided (DEC-TRACE §1): the steward by the lord's standing policy, a silence that let it lapse, else the lord himself. */
export const decisionBy = (record: Pick<HistoryRecord, "template">): DecisionBy =>
  record.template === "decision.steward" ? "steward" : record.template === "decision.lapsed" ? "lapsed" : "lord";
