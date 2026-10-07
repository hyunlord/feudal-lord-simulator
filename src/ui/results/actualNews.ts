import { BALANCE } from "../../content/balanceConfig";
import { HISTORY_CHOICE_LABELS, PETITION_SUBJECTS } from "../../content/historyCopy.ko";
import type { GameState } from "../../engine/engine.types";
import { ACTUAL_AFTER_TICKS } from "../../engine/history";
import type { HistoryRecord } from "../../engine/history.types";
import { CHRONICLE_SCREEN_COPY } from "../chronicle/chronicleScreenCopy.ko";
import { chronicleDate } from "../chronicle/chronicleScreenModel";
import { answerWords } from "../legacy/chapterRecords";
import { lordChoiceLabel } from "../lord/policyModel";
import { perState } from "../perState";
import { DECISION_SUBJECTS, RESULTS_COPY } from "./resultsCopy.ko";

// DEC-CARD (result side): "the actual is in" — a big decision's record gets its `actual` from the ledger two seasons on
// (history.ts fillActuals, the ledger's only later write). For the season after that write, the decision is news: what
// was expected against what came, in words. Read from the ledger like the lord's moments (lordMomentBeats): one item per
// decision record, keyed by the record's id, so it is never announced twice. Every mode (the famine, a petition, the
// lord's conditions). Once per state (perState): the scan walks back only over the records that can be due this season.

const SEASON = BALANCE.TICKS_PER_YEAR / 4;

export type ActualNews = Readonly<{
  recordId: string;
  /** The decision's own kind and, for a petition's answer, its petition (its picture is the petition's). */
  kind: string;
  defId: string;
  line: string;
  /** Each number against its forecast ("금고 £2 3s — 예측보다 £1 적음"). */
  facts: readonly string[];
}>;

/** The forecast's or the actual's numbers in a line ("금고 £1 2s · 인구 120"), the chronicle's own words for each key. */
export function metricsLine(values: Readonly<Record<string, number>>): string {
  return Object.entries(values).map(([key, value]) => CHRONICLE_SCREEN_COPY.predictedValue(key, value)).join(" · ");
}

/** What the decision was about, and the answer, in words (a petition's by its own subject and answer words). */
export function decisionWords(state: GameState, record: HistoryRecord): Readonly<{ subject: string; answer: string }> {
  const kind = String(record.params?.decisionKind ?? record.template.slice("decision.".length));
  const chosen = record.decision?.chosen ?? String(record.params?.chosen ?? "");
  if (kind === "petition_response") {
    const defId = String(record.params?.defId ?? "");
    return { subject: PETITION_SUBJECTS[defId] ?? DECISION_SUBJECTS.petition_response!, answer: answerWords(state, defId, chosen) };
  }
  return { subject: DECISION_SUBJECTS[kind] ?? kind, answer: lordChoiceLabel(kind, chosen) ?? HISTORY_CHOICE_LABELS[chosen] ?? chosen };
}

function newsOf(state: GameState, record: HistoryRecord): ActualNews {
  const decision = record.decision!;
  const actual = decision.actual!;
  const words = decisionWords(state, record);
  const facts = Object.entries(decision.predicted).flatMap(([key, predicted]) => {
    const came = actual[key];
    if (came === undefined) return [];
    const difference = CHRONICLE_SCREEN_COPY.difference(key, Math.abs(came - predicted));
    const delta = came > predicted ? CHRONICLE_SCREEN_COPY.deltaUp(difference) : came < predicted ? CHRONICLE_SCREEN_COPY.deltaDown(difference) : CHRONICLE_SCREEN_COPY.deltaSame;
    return [RESULTS_COPY.actual.fact(CHRONICLE_SCREEN_COPY.predictedValue(key, came), delta)];
  });
  return {
    recordId: record.id, kind: String(record.params?.decisionKind ?? ""), defId: String(record.params?.defId ?? ""),
    line: RESULTS_COPY.actual.line(chronicleDate(state, record.tick), words.subject, words.answer, metricsLine(decision.predicted), metricsLine(actual)),
    facts,
  };
}

/** The decisions whose actual the ledger wrote within the last season, oldest first. */
export const actualNews = perState((state: GameState): readonly ActualNews[] => {
  const records = state.history?.records ?? [];
  const found: ActualNews[] = [];
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index]!;
    // A decision's actual is due ACTUAL_AFTER_TICKS after it: older records cannot have one written this season.
    if (state.tick - record.tick >= SEASON + ACTUAL_AFTER_TICKS) break;
    const decision = record.decision;
    if (decision?.actual === undefined || decision.actualDueTick === undefined) continue;
    if (state.tick < decision.actualDueTick || state.tick - decision.actualDueTick >= SEASON) continue;
    found.push(newsOf(state, record));
  }
  return found.reverse();
});
