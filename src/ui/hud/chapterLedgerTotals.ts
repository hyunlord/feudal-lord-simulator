import type { GameState } from "../../engine/engine.types";
import { chapterEnd } from "../../engine/politics";
import type { LedgerCategory } from "../../ledger/ledger.types";

// UI-10: the ledger drawer's chapter sections (chapter 3's wages, chapter 4's reorganisation, chapter 5's legacy) count
// a chapter's money up to its end — chapter 4's fee farm, paid from the spring after the 1382 charter, is chapter 5's,
// not chapter 4's. The cash is cumulative up to a tick: the entries of that tick and before, and the folded periods
// (spec L-4) that began by then — a period folded across the tick counts wholly (at most one 2,400-tick period; the
// archive of periods older than 120 counts from its start). A chapter's money is the cumulative at its end (or now,
// while it is played) less the cumulative at the end of the chapter before.

/** Cash in `category` up to and including `tick`. */
export function cashUpTo(state: Pick<GameState, "ledger">, category: LedgerCategory, tick: number): number {
  const entries = (state.ledger?.entries ?? []).filter(entry => entry.account === "cash" && entry.category === category && entry.tick <= tick)
    .reduce((sum, entry) => sum + entry.amount, 0);
  const folded = (state.ledger?.rollups ?? []).filter(rollup => rollup.account === "cash" && rollup.periodStart <= tick)
    .reduce((sum, rollup) => sum + (rollup.byCategory[category] ?? 0), 0);
  return entries + folded;
}

/** The tick a chapter's money stops: its end once it has ended, else now. */
export const chapterUntil = (state: Pick<GameState, "politics" | "tick">, chapter: number): number => chapterEnd(state, chapter)?.tick ?? state.tick;

/**
 * A chapter's money in `category`: up to its end (or now). `fromStart` false: less what came by the end of the chapter
 * before (chapter 5's section, whose fee farm and nave share categories with chapter 4's); true: from the game's start
 * (chapters 3 and 4, whose categories begin with them).
 */
export function chapterCash(state: Pick<GameState, "ledger" | "politics" | "tick">, chapter: number, category: LedgerCategory, fromStart: boolean): number {
  const until = cashUpTo(state, category, chapterUntil(state, chapter));
  const before = fromStart ? null : chapterEnd(state, chapter - 1);
  return before === null ? until : until - cashUpTo(state, category, before.tick);
}
