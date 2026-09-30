import { HISTORY_CHOICE_LABELS, PETITION_SUBJECTS, WAR_CHOICES } from "../../content/historyCopy.ko";
import { HEIR_RELATION_COPY } from "../../content/legacyCopy.ko";
import { HEIR_CHOICE_PETITION_ID, LEGACY_CARD_PETITION_IDS } from "../../content/legacyConfig";
import type { GameState } from "../../engine/engine.types";
import { history } from "../../engine/history";
import type { HistoryRecord } from "../../engine/history.types";
import type { HeirCandidate } from "../../engine/legacy.types";
import type { ChronicleQuote } from "../../engine/politics.types";
import { PETITION_COPY } from "../petitionCopy.ko";
import { LEGACY_SCREEN_COPY } from "./legacyScreenCopy.ko";

// UI-10 gate fixes (UI side of the chapter pages and the book; the engine's page is unchanged — handoffs in the report):
//  - A chapter opens on the tick the one before it closed: the records of that tick are the closing chapter's (its end,
//    chapter 4's charter line), except the new chapter's own start milestone.
//  - The engine's page quotes three decisions (`CHAPTER_ONE.quotedDecisions`, the earliest petitions first), so chapter
//    5's page lost its own four cards' answers (the heir, the charter, the legacy) to the interlude's petitions; the
//    page adds the chapter's card decisions from the ledger (the same decision records, nothing made up).
//  - The heir's "refuse" answer names the nephew; where the heir seated was a distant kinsman (LG-3: the lord had no
//    brother or sister), the words follow the heir's real relation, as the heir card does.

/** The tick a chapter opened (the one before it closed), or null for chapter 1 (it owns every tick from 0). */
export function chapterOpenedTick(state: Pick<GameState, "politics">, chapter: number): number | null {
  if (chapter <= 1) return null;
  return state.politics?.chapterEnds.find(end => end.chapter === chapter - 1)?.tick ?? null;
}

/** The record is the chapter's own: after the tick it opened on, or its own start milestone on that tick. */
export function chapterOwnsRecord(record: Pick<HistoryRecord, "tick" | "template" | "params">, chapter: number, openedTick: number | null): boolean {
  if (openedTick === null || record.tick > openedTick) return true;
  return record.template === "milestone.chapter_start" && String(record.params?.chapter ?? "") === String(chapter);
}

/** Chapter 5's four cards (LG-2…LG-5): their answers are the chapter's own decisions. */
const CARD_DECISIONS: ReadonlySet<string> = new Set(LEGACY_CARD_PETITION_IDS);

/**
 * The decisions a chapter's page quotes: the engine's (those of the tick it opened on dropped), and in chapter 5 also
 * its cards' answers the engine's three left out, from the ledger's decision records — in order of time.
 */
export function chapterQuotes(state: Pick<GameState, "history" | "politics">, chapter: number, quotes: readonly ChronicleQuote[], toTick: number): readonly ChronicleQuote[] {
  const opened = chapterOpenedTick(state, chapter);
  const records = state.history?.records ?? [];
  const byId = new Map(records.map(record => [record.id, record]));
  const own = quotes.filter(quote => { const record = byId.get(quote.recordId); return record === undefined || chapterOwnsRecord(record, chapter, opened); });
  if (chapter !== 5) return own;
  const quoted = new Set(own.map(quote => quote.recordId));
  const cards = records.filter(record => record.kind === "decision" && record.decision !== undefined && !quoted.has(record.id)
    && record.tick <= toTick && chapterOwnsRecord(record, chapter, opened) && CARD_DECISIONS.has(String(record.params?.defId ?? "")))
    .map(record => ({ recordId: record.id, kind: String(record.params?.decisionKind ?? ""), tick: record.tick, chosen: record.decision!.chosen,
      alternatives: record.decision!.alternatives, predicted: record.decision!.predicted, ...(record.decision!.actual === undefined ? {} : { actual: record.decision!.actual }) }));
  return [...own, ...cards].sort((a, b) => a.tick - b.tick);
}

/** The seated heir's relation to the old lord (LG-3), or null before the succession. */
export function seatedHeirRelation(state: Partial<Pick<GameState, "legacy">>): HeirCandidate["relation"] | null {
  const legacy = state.legacy;
  const heir = legacy?.heir;
  if (heir === undefined) return null;
  return legacy!.candidates.find(candidate => candidate.personId === heir.personId)?.relation ?? null;
}

/** The nephew's place is (or was) a distant kinsman's: the seated heir's relation, else the one offered. */
function kinsmanForNephew(state: Partial<Pick<GameState, "legacy">>): boolean {
  const seated = seatedHeirRelation(state);
  if (seated !== null) return seated === "kinsman";
  return (state.legacy?.candidates ?? []).some(candidate => candidate.kind === "nephew" && candidate.relation === "kinsman");
}

/** An answer's words (the war's and chapter 5's own, else the ledger's), the heir's by the heir's real relation. */
export function answerWords(state: Partial<Pick<GameState, "legacy">>, defId: string, key: string): string {
  if (defId === HEIR_CHOICE_PETITION_ID && key === "refuse" && kinsmanForNephew(state)) return PETITION_COPY.heir_choice.kinsmanLabel;
  return WAR_CHOICES[defId]?.[key] ?? HISTORY_CHOICE_LABELS[key] ?? key;
}

/** The heir the stats line names: the seated heir's relation in words, or null to keep the page's own word. */
export function heirRelationWord(state: Partial<Pick<GameState, "legacy">>): string | null {
  const relation = seatedHeirRelation(state);
  return relation === null ? null : HEIR_RELATION_COPY[relation] ?? null;
}

/** A record's sentence (the ledger's), with the heir answer in the heir's real relation. */
export function recordSentence(state: Partial<Pick<GameState, "legacy">>, record: Pick<HistoryRecord, "template" | "params">): string {
  const defId = String(record.params?.defId ?? "");
  const chosen = String(record.params?.chosen ?? "");
  if (record.template === "decision.petition_response" && defId === HEIR_CHOICE_PETITION_ID && chosen === "refuse" && kinsmanForNephew(state)) {
    return LEGACY_SCREEN_COPY.answered(PETITION_SUBJECTS[defId] ?? defId, PETITION_COPY.heir_choice.kinsmanLabel);
  }
  return history.summary(record);
}
