import { BUILDING_COPY } from "../../content/buildingCatalog.ko";
import type { GameState } from "../../engine/engine.types";
import { answerOutlook } from "../../state/decisionOutlook";
import type { GameAction } from "../../state/gameStore.types";
import { dateWord, factionWord, holderName } from "./answerWords";
import { DECISION_CARD_COPY } from "./decisionCardCopy.ko";
import type { Rememberer } from "./decisionCardTypes";
import { OUTLOOK_COPY as COPY } from "./outlookCopy.ko";

// DEC-CARD-2 (DC-D7, the lead's decision): every card reads an answer from the engine's outlook (`answerOutlook`: the
// command run on a copy by the engine's own reducer — DEC-TRACE §3). Its treasury goes in 지금, its later keys in 나중에,
// its `remembers` in 기억하는 이; null is the shut answer. The outlook's relation rows in `now` are the same moves as its
// `remembers` (decisionOutlook.ts: one row per remembered move at the answer's tick), so the card says them once, as who
// remembers. What it does not give stays with each family's dry run (`afterAnswer`). The cards run it only when they are
// up, once per state (`perState`), never for a chip.

export type AnswerOutlook = NonNullable<ReturnType<typeof answerOutlook>>;
export type OutlookLater = AnswerOutlook["later"][number];

/** The engine's outlook for an answer, or null when the engine refuses it (the answer is shown shut). */
export function outlookOf(state: GameState, command: GameAction): AnswerOutlook | null {
  return answerOutlook(state, command);
}

/** The pennies the answer moves now (the outlook's treasury row; 0 when it moves none). */
export function outlookTreasury(outlook: AnswerOutlook): number {
  return outlook.now.reduce((sum, row) => row.key === "treasury" ? sum + (row.amount ?? 0) : sum, 0);
}

/** Who remembers the answer: the outlook's factions, each faction's moves summed, the strongest first, in words. */
export function outlookRemembers(state: GameState, outlook: AnswerOutlook): readonly Rememberer[] {
  const moves = new Map<string, number>();
  for (const entry of outlook.remembers) moves.set(entry.actor, (moves.get(entry.actor) ?? 0) + entry.delta);
  return [...moves].filter(([, delta]) => delta !== 0).sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
    .map(([actor, delta]) => ({ who: factionWord(state, actor), how: DECISION_CARD_COPY.feels(delta), delta }));
}

const building = (kind: string | undefined) => kind === undefined ? "" : BUILDING_COPY[kind as keyof typeof BUILDING_COPY]?.name ?? kind;

/** The promises the answer leaves open (promise_due), one line per promisee and sum: its deadline, or the first and the last. */
function promiseDue(state: GameState, rows: readonly OutlookLater[]): readonly string[] {
  const groups = new Map<string, OutlookLater[]>();
  for (const row of [...rows].sort((a, b) => (a.tick ?? 0) - (b.tick ?? 0))) {
    const key = `${row.actor ?? ""}|${row.amount ?? ""}`;
    groups.set(key, [...groups.get(key) ?? [], row]);
  }
  return [...groups.values()].map(group => {
    const [first, last] = [group[0]!, group.at(-1)!];
    const date = (row: OutlookLater) => row.tick === null ? "" : dateWord(state, row.tick);
    if (first.actor === "lord") return COPY.promiseToLord(date(first));
    const who = holderName(state, first.actor ?? "");
    const amount = first.amount ?? null;
    return group.length === 1 ? COPY.promiseDue(who, date(first), amount) : COPY.promisesDue(who, group.length, date(first), date(last), amount);
  });
}

/** Each later key in words (DC-D7): a family may say a key its own way (`words`), with what its dry run adds. */
export type LaterWords = Partial<Record<string, (rows: readonly OutlookLater[]) => readonly string[]>>;

const LATER: Readonly<Record<string, (state: GameState, rows: readonly OutlookLater[]) => readonly string[]>> = {
  promise_due: promiseDue,
  war_tax: (_state, rows) => [COPY.warTax(rows.at(-1)?.perSeason ?? 0)],
  subsidy_paid_when_built: (_state, rows) => rows.map(row => COPY.subsidy(building(row.actor), row.amount ?? 0)),
  subsidy_withdrawn: (_state, rows) => rows.map(row => COPY.subsidyGone(building(row.actor))),
  suit_stage: (_state, rows) => rows.map(row => COPY.suitStage(COPY.suitStages[row.actor ?? ""] ?? COPY.suitStageUnknown)),
  timber_order: (_state, rows) => [COPY.timber(rows.at(-1)?.amount ?? 0)],
  stall_dues: (_state, rows) => [COPY.dues(Math.round((rows.at(-1)?.amount ?? 1000) / 10))],
  faction_mind: (state, rows) => [COPY.factionMind(COPY.list([...new Set(rows.map(row => factionWord(state, row.actor ?? "")))]))],
};

/** The keys the card words (the engine's `LaterRow.key`s; a key with no words is not shown as a raw key). */
export const OUTLOOK_LATER_KEYS: readonly string[] = Object.keys(LATER);

/** What the answer sets going, in words, key by key in the outlook's order. */
export function outlookLater(state: GameState, outlook: AnswerOutlook, words: LaterWords = {}): string[] {
  const keys = [...new Set(outlook.later.map(row => row.key))];
  return keys.flatMap(key => {
    const rows = outlook.later.filter(row => row.key === key);
    const own = words[key];
    return [...own === undefined ? LATER[key]?.(state, rows) ?? [] : own(rows)];
  });
}
