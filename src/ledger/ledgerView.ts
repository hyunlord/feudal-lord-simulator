/**
 * Read models over the ledger (spec L-7): period × account totals by category and by source.
 * Pure reads; nothing here posts.
 */
import type { SourceRef } from "../contracts";
import type { GameState } from "../engine/engine.types";
import { LEDGER_PERIOD_TICKS } from "./ledger";
import type { LedgerAccount, LedgerCategory, LedgerEntry } from "./ledger.types";

export type LedgerWindow = "recent" | "previous" | "all";

export interface LedgerSourceTotal {
  /** `type:id` of the first source; the detail (e.g. what was sold) is kept per entry. */
  readonly key: string;
  readonly source: SourceRef;
  readonly amount: number;
  readonly count: number;
  readonly entryIds: readonly string[];
}

export interface LedgerView {
  readonly account: LedgerAccount;
  readonly window: LedgerWindow;
  readonly total: number;
  readonly byCategory: readonly { readonly category: LedgerCategory; readonly amount: number }[];
  readonly bySource: readonly LedgerSourceTotal[];
  /** Entries in the window, newest first. Roll-ups (window `all` only) add to totals but have no entries. */
  readonly entries: readonly LedgerEntry[];
  readonly includesRollups: boolean;
}

function windowRange(tick: number, window: LedgerWindow): readonly [number, number] {
  if (window === "all") return [-Infinity, Infinity];
  const recentFirst = tick - LEDGER_PERIOD_TICKS + 1;
  return window === "recent" ? [recentFirst, tick] : [recentFirst - LEDGER_PERIOD_TICKS, recentFirst - 1];
}

export function ledgerView(state: Pick<GameState, "ledger" | "tick">, account: LedgerAccount, window: LedgerWindow): LedgerView {
  const ledger = state.ledger;
  const [first, last] = windowRange(state.tick, window);
  const entries = (ledger?.entries ?? []).filter(entry => entry.account === account && entry.tick >= first && entry.tick <= last);
  const byCategory = new Map<LedgerCategory, number>();
  const bySource = new Map<string, { source: SourceRef; amount: number; count: number; entryIds: string[] }>();
  for (const entry of entries) {
    byCategory.set(entry.category, (byCategory.get(entry.category) ?? 0) + entry.amount);
    const source = entry.sourceRefs[0];
    const key = `${source.type}:${source.id}`;
    const total = bySource.get(key) ?? { source: { type: source.type, id: source.id }, amount: 0, count: 0, entryIds: [] };
    total.amount += entry.amount;
    total.count += 1;
    total.entryIds.push(entry.id);
    bySource.set(key, total);
  }
  const rollups = window === "all" ? (ledger?.rollups ?? []).filter(rollup => rollup.account === account) : [];
  for (const rollup of rollups) {
    for (const [category, amount] of Object.entries(rollup.byCategory) as [LedgerCategory, number][]) {
      byCategory.set(category, (byCategory.get(category) ?? 0) + amount);
    }
  }
  const categories = [...byCategory].map(([category, amount]) => ({ category, amount }));
  return {
    account,
    window,
    total: categories.reduce((sum, row) => sum + row.amount, 0),
    byCategory: categories,
    bySource: [...bySource].map(([key, total]) => ({ key, ...total })).sort((left, right) => right.amount - left.amount || left.key.localeCompare(right.key)),
    entries: [...entries].reverse(),
    includesRollups: rollups.length > 0,
  };
}

/** Income of the recent window by category (positive cash entries): the "수입원" line (L-8, M-8). */
export function recentIncome(state: Pick<GameState, "ledger" | "tick">): { readonly total: number; readonly byCategory: readonly { readonly category: LedgerCategory; readonly amount: number }[] } {
  const byCategory = new Map<LedgerCategory, number>();
  for (const entry of ledgerView(state, "cash", "recent").entries) {
    if (entry.amount <= 0 || entry.category === "opening_balance") continue;
    byCategory.set(entry.category, (byCategory.get(entry.category) ?? 0) + entry.amount);
  }
  const rows = [...byCategory].map(([category, amount]) => ({ category, amount })).sort((left, right) => right.amount - left.amount);
  return { total: rows.reduce((sum, row) => sum + row.amount, 0), byCategory: rows };
}

/** Net cash change of the recent window, without the opening balance: the finance cell's trend (M-8). */
export function recentNetChange(state: Pick<GameState, "ledger" | "tick">): number {
  return ledgerView(state, "cash", "recent").entries
    .filter(entry => entry.category !== "opening_balance")
    .reduce((sum, entry) => sum + entry.amount, 0);
}

/** Building ids a source total points at, for the map highlight. */
export function sourceBuildingIds(sources: readonly SourceRef[]): readonly string[] {
  return [...new Set(sources.filter(source => source.type === "building").map(source => source.id))];
}
