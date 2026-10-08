import { BALANCE } from "../../content/balanceConfig";
import { HOME_ESTATE_ID } from "../../content/estateConfig";
import { factionDisplayName } from "../../content/factionCopy.ko";
import { HISTORY_CHOICE_LABELS, PETITION_SUBJECTS } from "../../content/historyCopy.ko";
import { V4_COPY } from "../../content/registry/v4Copy.generated";
import { traceInRange, type TraceRow } from "../../engine/decisionReads";
import type { GameState } from "../../engine/engine.types";
import type { HistoryRecord } from "../../engine/history.types";
import type { EstatePetitionKind, HomePetitionKind } from "../../engine/stewardship.types";
import { lordMode } from "../../engine/townAgency";
import { chronicleDate, yearOfTick } from "../chronicle/chronicleScreenModel";
import { decisionBy, recordIndex, type DecisionBy } from "../chronicle/historyIndex";
import { DECISION_CARD_COPY } from "../decisionCard/decisionCardCopy.ko";
import { recordSentence } from "../legacy/chapterRecords";
import { OFFMAP_PETITION_COPY } from "../lord/decisions/decisionCardsCopy.ko";
import { HOME_PETITION_COPY } from "../lordCardsCopy.ko";
import { perState } from "../perState";
import { decisionWords } from "./actualNews";
import { RESULTS_COPY } from "./resultsCopy.ko";

// DEC-CARD-2 (the result thread): "○○년 당신의 결정 때문에" — what followed a decision, shown as following from it. All of
// it is the engine's thread (DEC-TRACE §2, `traceInRange`): the history's records that carry the decision in `because`,
// and the factions' minds the decision moved at once (their memories). Each line is the engine's own sentence
// (`historySummary` by the record's id, CONSEQUENCE_WORDS), a share among other causes says so (P-C2), and the factions'
// moves are the decision card's feeling words. Lord mode (the thread is lord mode's). The season's news chips, the
// chronicle's thread and the lord's year card read these.

const SEASON = BALANCE.TICKS_PER_YEAR / 4;

/** What a decision answered, in words (the petition, the event, the setting), and the answer's own words when it has them. */
function decisionSubject(state: GameState, record: HistoryRecord, chosen: string): { readonly subject: string; readonly answer: string | null } {
  const copy = RESULTS_COPY.trace;
  const subjectId = String(record.params?.subjectId ?? "");
  const petition = state.stewardship?.petitions.find(entry => entry.id === subjectId);
  if (petition !== undefined) {
    if (petition.estateId === HOME_ESTATE_ID) return { subject: copy.manor(HOME_PETITION_COPY[petition.kind as HomePetitionKind]?.title ?? petition.kind), answer: null };
    const kind = OFFMAP_PETITION_COPY[petition.kind as EstatePetitionKind];
    return { subject: copy.estate(kind?.title ?? petition.kind), answer: kind === undefined ? null : chosen === "granted" ? kind.grant : chosen === "refused" ? kind.refuse : null };
  }
  const occurrence = state.registry?.occurrences.find(entry => entry.id === subjectId);
  if (occurrence !== undefined) {
    const words = V4_COPY[occurrence.entryId];
    return { subject: words?.title ?? recordSentence(state, record), answer: words?.choices[chosen]?.label ?? null };
  }
  const chapter = state.politics?.petitions.find(entry => entry.id === subjectId);
  if (chapter !== undefined) return { subject: PETITION_SUBJECTS[chapter.defId] ?? chapter.defId, answer: HISTORY_CHOICE_LABELS[chosen] ?? null };
  // The big decisions (the estate's policy, a subsidy, the dues …) by their own words; a card's other commands (a suit
  // filed, a marriage proposed) by the ledger's sentence, which says the answer.
  if (record.template !== "decision.card" && decisionBy(record) === "lord") return decisionWords(state, record);
  return { subject: recordSentence(state, record), answer: "" };
}

/** What a decision was about and how it was answered: "장원 청원 '공동 목초지': 들어준다", the steward's "… — 청지기가
 * 관습대로 처리했다 (들어줌)", a silence's "… — 답하지 않은 채 기한이 지났다". */
export function decisionAbout(state: GameState, record: HistoryRecord): string {
  const copy = RESULTS_COPY.trace;
  const chosen = record.decision?.chosen ?? String(record.params?.chosen ?? "");
  const by = decisionBy(record);
  const { subject, answer } = decisionSubject(state, record, chosen);
  if (by === "lord") return copy.about(subject, answer ?? copy.answers[chosen] ?? null);
  return copy.aboutBy(subject, recordSentence(state, record), by === "steward" ? answer ?? copy.stewardAnswers[chosen] ?? null : null);
}

export type ThreadLines = Readonly<{ lines: readonly string[]; feelings: readonly string[] }>;

/** A faction's name as the chronicle names it. */
function factionName(state: GameState, id: string): string {
  const faction = state.factions?.factions.find(entry => entry.id === id);
  return faction === undefined ? id : factionDisplayName(faction.id, faction.name);
}

/**
 * What followed, in lines: each record's own sentence (the same one once, with its count; a share marked as one cause
 * among others) and the factions' moves summed per faction in the card's feeling words.
 */
export function threadLines(state: GameState, rows: readonly TraceRow[]): ThreadLines {
  const index = recordIndex(state);
  const counts = new Map<string, number>();
  const moves = new Map<string, number>();
  for (const row of rows) {
    if (row.key === "relation") { if (row.delta !== null) moves.set(row.actor, (moves.get(row.actor) ?? 0) + row.delta); continue; }
    const record = index.get(row.recordId);
    if (record === undefined) continue;
    const sentence = row.part ? RESULTS_COPY.trace.part(recordSentence(state, record)) : recordSentence(state, record);
    counts.set(sentence, (counts.get(sentence) ?? 0) + 1);
  }
  return {
    lines: [...counts].map(([line, count]) => RESULTS_COPY.year.times(line, count)),
    feelings: [...moves].filter(([, delta]) => delta !== 0).map(([actor, delta]) => RESULTS_COPY.trace.feeling(factionName(state, actor), DECISION_CARD_COPY.feels(delta))),
  };
}

export type TraceGroup = Readonly<{ decisionId: string; decisionTick: number; by: DecisionBy; rows: readonly TraceRow[] }>;

/** The rows grouped by the decision behind them, in the order their first rows came. */
export function traceGroups(state: GameState, rows: readonly TraceRow[]): readonly TraceGroup[] {
  const index = recordIndex(state);
  const groups = new Map<string, { decisionId: string; decisionTick: number; by: DecisionBy; rows: TraceRow[] }>();
  for (const row of rows) {
    const record = index.get(row.decisionId);
    if (record === undefined) continue;
    const group = groups.get(row.decisionId) ?? { decisionId: row.decisionId, decisionTick: row.decisionTick ?? record.tick, by: decisionBy(record), rows: [] };
    group.rows.push(row);
    groups.set(row.decisionId, group);
  }
  return [...groups.values()];
}

/** The steward's answers that moved only the factions' minds at once: the season's steward report says those (dc2-steward). */
export const onlyMinds = (group: TraceGroup) => group.by === "steward" && group.rows.every(row => row.key === "relation");

export type TraceNews = Readonly<{
  /** The decision's record id: the chip's key with the season, and the record the chronicle opens on. */
  decisionId: string;
  decisionTick: number;
  title: string;
  line: string;
  facts: readonly string[];
}>;

/**
 * The season's news "○○년 당신의 결정 때문에": one per decision whose consequences landed this season (the steward's
 * answers that only moved minds are in his season report instead), oldest first. Lord mode. Once per state.
 */
export const traceNews = perState((state: GameState): readonly TraceNews[] => {
  if (!lordMode(state)) return [];
  const rows = traceInRange(state, state.tick - (state.tick % SEASON), state.tick + 1);
  if (rows.length === 0) return [];
  const index = recordIndex(state);
  return traceGroups(state, rows).filter(group => !onlyMinds(group)).map(group => {
    const record = index.get(group.decisionId)!;
    const lines = threadLines(state, group.rows);
    return { decisionId: group.decisionId, decisionTick: group.decisionTick, title: RESULTS_COPY.trace.title(yearOfTick(state, group.decisionTick), group.by),
      line: RESULTS_COPY.trace.dated(chronicleDate(state, group.decisionTick), decisionAbout(state, record)), facts: [...lines.lines, ...lines.feelings] };
  });
});
