import { decisionRemembers, traceInRange } from "../../engine/decisionReads";
import { traceOf } from "../../engine/decisionTrace";
import type { GameState } from "../../engine/engine.types";
import type { HistoryRecord } from "../../engine/history.types";
import { lordMode } from "../../engine/townAgency";
import { recordSentence } from "../legacy/chapterRecords";
import { decisionAbout, threadLines } from "../results/decisionThread";
import { RESULTS_COPY } from "../results/resultsCopy.ko";
import { CHRONICLE_SCREEN_COPY as COPY } from "./chronicleScreenCopy.ko";
import { chronicleDate, yearOfTick } from "./chronicleScreenModel";
import { decisionBy, recordIndex } from "./historyIndex";

// DEC-CARD-2 (the result thread in the chronicle): the picked record's place in the thread (DEC-TRACE §2). A record that
// followed from decisions names each ("1300년 당신의 결정 때문에 — 장원 청원 '…': 들어준다", the main one first, a share
// marked) and opens it; a decision lists what followed it — the engine's `traceInRange` over its span, each line the
// record's own sentence — and who remembers it (`decisionRemembers`: the factions' minds it moved at once). Lord mode.

/** A decision's thread lists this many lines; the rest are counted. */
const MAX_FOLLOWED = 12;

export type ThreadLink = Readonly<{ key: string; line: string; recordId: string; tick: number }>;
export type DecisionThreadView = Readonly<{
  because: readonly ThreadLink[];
  /** What followed a traced decision (null: the record is no decision of the thread). */
  followed: readonly ThreadLink[] | null;
  more: number;
  remembers: readonly string[];
}>;

export function decisionThread(state: GameState, record: HistoryRecord): DecisionThreadView | null {
  if (!lordMode(state)) return null;
  const index = recordIndex(state);
  const because = (record.because ?? []).flatMap((entry, at): ThreadLink[] => {
    const decision = index.get(entry.decisionId);
    if (decision === undefined) return [];
    const heading = RESULTS_COPY.trace.because(yearOfTick(state, decision.tick), decisionBy(decision), entry.part === true);
    return [{ key: `because-${at}`, line: RESULTS_COPY.trace.prefixed(heading, decisionAbout(state, decision)), recordId: decision.id, tick: decision.tick }];
  });
  const traced = record.kind === "decision" && traceOf(state).decisions.some(decision => decision.id === record.id);
  if (!traced) return because.length === 0 ? null : { because, followed: null, more: 0, remembers: [] };
  // The factions' minds the decision moved at once are its memories ("기억하는 이" below); the rest followed later.
  const rows = traceInRange(state, record.tick, state.tick + 1).filter(row => row.decisionId === record.id && row.key !== "relation");
  const followed = rows.flatMap((row, at): ThreadLink[] => {
    const target = index.get(row.recordId);
    if (target === undefined) return [];
    const sentence = row.part ? RESULTS_COPY.trace.part(recordSentence(state, target)) : recordSentence(state, target);
    return [{ key: `${row.recordId}-${at}`, line: RESULTS_COPY.trace.dated(chronicleDate(state, row.tick), sentence), recordId: target.id, tick: row.tick }];
  });
  const remembered = decisionRemembers(state, record.id).map(entry => ({ recordId: entry.recordId, tick: entry.tick, key: "relation", actor: entry.actor, delta: entry.delta,
    part: false, decisionId: record.id, decisionTick: record.tick }));
  return { because, followed: followed.slice(0, MAX_FOLLOWED), more: Math.max(0, followed.length - MAX_FOLLOWED), remembers: threadLines(state, remembered).feelings };
}

/** The link's accessible name: its line and where it goes. */
export const threadLinkLabel = (link: ThreadLink) => COPY.threadOpenLabel(link.line);
