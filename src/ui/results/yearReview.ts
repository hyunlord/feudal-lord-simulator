import { BALANCE } from "../../content/balanceConfig";
import { factionDisplayName } from "../../content/factionCopy.ko";
import type { GameState } from "../../engine/engine.types";
import type { HistoryRecord } from "../../engine/history.types";
import { scenarioOf, stateCalendar } from "../../engine/scenarioState";
import { CHRONICLE_SCREEN_COPY } from "../chronicle/chronicleScreenCopy.ko";
import { chronicleDate } from "../chronicle/chronicleScreenModel";
import { DECISION_CARD_COPY } from "../decisionCard/decisionCardCopy.ko";
import { recordSentence } from "../legacy/chapterRecords";
import { moneyFull } from "../money.ko";
import { perState } from "../perState";
import { metricsLine } from "./actualNews";
import { reasonIsSilence, reasonNamesAnswer, reasonWords, relationHeading, relationLine, RESULTS_COPY } from "./resultsCopy.ko";

// DEC-CARD year card v1 ("올해 당신의 결정이 바꾼 것"): what the year's decisions changed, from the ledger the engine already
// writes — the year's big decision records with their actuals (or the date the actual will be written), the lord's
// answers (a home petition, an audit, a registry entry, a negotiation, a promise), the factions' moves grouped by what
// moved them (only an answer's reason says "이 결정 때문에", P-C2), and the town's projects whose receipts name one of the
// year's decisions among their reasons (TA-6 receipt.decisionIds). A quiet year (GP-7 P-T1) still shows what changed in
// the town (the season ledgers' people and money); a year with nothing says so in one line. DEC-TRACE's `yearReview`
// will replace the string-reason links. Once per state; the hook opens it at the first tick of the next year.

const YEAR = BALANCE.TICKS_PER_YEAR;
/** A section shows this many lines; the rest are counted (the chronicle holds them all). */
const MAX_LINES = 8;

export type YearReviewDecision = Readonly<{ id: string; line: string; outcome: string }>;
export type YearReviewGroup = Readonly<{ key: string; heading: string; lines: readonly string[] }>;
export type YearReviewView = Readonly<{
  year: number;
  title: string;
  /** DEC-CARD-2: the engine's yearReview (lord mode) or v1 (the sandbox and the campaign). */
  lord: boolean;
  /** DEC-CARD-2 (lord mode): the house's big changes, first. */
  house: readonly string[];
  decisions: readonly YearReviewDecision[];
  /** DEC-CARD-2 (lord mode): the steward's answers by the standing policies (empty in v1). */
  steward: readonly YearReviewDecision[];
  /** DEC-CARD-2 (lord mode): what followed, grouped by the decision behind it; what the community built in a builder's place. */
  threads: readonly YearReviewGroup[];
  community: readonly string[];
  answers: readonly string[];
  relations: readonly YearReviewGroup[];
  receipts: readonly string[];
  town: readonly string[];
  /** The one line for a year in which nothing changed; null otherwise. */
  empty: string | null;
}>;

const ANSWER_TEMPLATES: ReadonlySet<string> = new Set(["manor.petition_answered", "stewardship.audit_answered", "registry.answered"]);
const isAnswer = (template: string) => ANSWER_TEMPLATES.has(template) || template.startsWith("negotiation.") || template.startsWith("promise.");

/** Lines kept to MAX_LINES, the rest counted. */
function capped(lines: readonly string[]): readonly string[] {
  return lines.length <= MAX_LINES ? lines : [...lines.slice(0, MAX_LINES - 1), RESULTS_COPY.year.more(lines.length - MAX_LINES + 1)];
}

/** The same sentence once, with its count. */
function counted(lines: readonly string[]): readonly string[] {
  const counts = new Map<string, number>();
  for (const line of lines) counts.set(line, (counts.get(line) ?? 0) + 1);
  return [...counts].map(([line, count]) => RESULTS_COPY.year.times(line, count));
}

export function yearReview(state: GameState, year: number): YearReviewView {
  const copy = RESULTS_COPY.year;
  const from = (year - scenarioOf(state).startYear) * YEAR;
  const to = from + YEAR;
  const records = state.history?.records ?? [];
  const inYear: HistoryRecord[] = [];
  const projects: HistoryRecord[] = [];
  for (let index = records.length - 1; index >= 0 && records[index]!.tick >= from; index -= 1) {
    const record = records[index]!;
    if (record.template === "agency.project_started" && String(record.params?.decisions ?? "") !== "") projects.unshift(record);
    if (record.tick < to) inYear.unshift(record);
  }
  const dated = (record: HistoryRecord) => copy.dated(chronicleDate(state, record.tick), recordSentence(state, record));
  const decisionRecords = inYear.filter(record => record.kind === "decision" && record.decision !== undefined);
  const decisions = decisionRecords.map(record => {
    const decision = record.decision!;
    const outcome = decision.actual !== undefined ? copy.outcome(metricsLine(decision.predicted), metricsLine(decision.actual))
      : decision.actualDueTick !== undefined ? CHRONICLE_SCREEN_COPY.actualPending(chronicleDate(state, decision.actualDueTick)) : "";
    return { id: record.id, line: dated(record), outcome };
  });
  const answers = capped(counted(inYear.filter(record => isAnswer(record.template)).map(dated)));
  // The factions' moves: by the reason's prefix (an answer, the lord's silence, anything else), each faction's sum per reason.
  const groups = new Map<string, { heading: string; order: number; moves: Map<string, { reason: string; name: string; delta: number }> }>();
  for (const record of inYear) {
    if (record.template !== "faction.relation") continue;
    const reason = String(record.params?.reason ?? "");
    const delta = Number(record.params?.delta ?? 0);
    if (!Number.isFinite(delta) || delta === 0) continue;
    const prefix = reason.split(":")[0] ?? "";
    const silent = reasonIsSilence(reason);
    const key = `${prefix}:${silent ? "silent" : "said"}`;
    const group = groups.get(key) ?? { heading: relationHeading(prefix, silent), order: reasonNamesAnswer(reason) ? 0 : silent ? 1 : 2, moves: new Map() };
    const faction = String(record.params?.faction ?? record.subject.id);
    const moveKey = `${reason}|${faction}`;
    const move = group.moves.get(moveKey) ?? { reason, name: factionDisplayName(faction, String(record.params?.name ?? faction)), delta: 0 };
    move.delta += delta;
    group.moves.set(moveKey, move);
    groups.set(key, group);
  }
  const relations = [...groups.entries()].sort(([, a], [, b]) => a.order - b.order).map(([key, group]) => ({
    key, heading: group.heading,
    lines: capped([...group.moves.values()].filter(move => move.delta !== 0).map(move => relationLine(reasonWords(move.reason), move.name, DECISION_CARD_COPY.feels(move.delta)))),
  })).filter(group => group.lines.length > 0);
  // The projects whose receipt names one of the year's decisions among its reasons (one of the causes, not the cause).
  const receipts = decisionRecords.flatMap(record => {
    const moved = projects.filter(project => String(project.params?.decisions).split(",").includes(record.id));
    return moved.length === 0 ? [] : [copy.receipt(recordSentence(state, record), moved.length, recordSentence(state, moved[0]!))];
  });
  const ledgers = (state.seasons?.history ?? []).filter(ledger => ledger.year === year);
  const people = ledgers.reduce((sum, ledger) => sum + ledger.popDelta, 0);
  const income = ledgers.reduce((sum, ledger) => sum + ledger.income, 0);
  const expense = ledgers.reduce((sum, ledger) => sum + ledger.expense, 0);
  const town = ledgers.length === 0 ? [] : [copy.population(Math.round(people)), copy.money(moneyFull(Math.round(income)), moneyFull(Math.round(expense)))];
  const quiet = decisions.length === 0 && answers.length === 0 && relations.length === 0 && receipts.length === 0;
  const still = ledgers.length === 0 || (Math.round(people) === 0 && Math.round(income) === 0 && Math.round(expense) === 0);
  return { year, title: copy.title(year), lord: false, house: [], decisions, steward: [], answers, relations, receipts, threads: [], community: [],
    town: quiet && still ? [] : town, empty: quiet && still ? copy.nothing : null };
}

/** The town's year in its season ledgers: the people and the money (a quiet year still shows them, P-T1). */
export function yearTown(state: GameState, year: number): readonly string[] {
  const copy = RESULTS_COPY.year;
  const ledgers = (state.seasons?.history ?? []).filter(ledger => ledger.year === year);
  const people = Math.round(ledgers.reduce((sum, ledger) => sum + ledger.popDelta, 0));
  const income = Math.round(ledgers.reduce((sum, ledger) => sum + ledger.income, 0));
  const expense = Math.round(ledgers.reduce((sum, ledger) => sum + ledger.expense, 0));
  return ledgers.length === 0 || (people === 0 && income === 0 && expense === 0) ? [] : [copy.population(people), copy.money(moneyFull(income), moneyFull(expense))];
}

/** The year just ended: the card the hook opens at the first tick of the next year. */
export const lastYearReview = perState((state: GameState): YearReviewView => yearReview(state, stateCalendar(state).year - 1));
