import type { GameState } from "../../engine/engine.types";
import { LEDGER_CATEGORY_LABELS } from "../../ledger/ledgerCopy.ko";
import { ledgerView } from "../../ledger/ledgerView";
import type { LedgerCategory } from "../../ledger/ledger.types";
import { WAGE_LEDGER_COPY } from "./wageLedgerCopy.ko";

// UI-8 (F3-A PL-5…PL-7): the four plague money categories that appear only in chapter 3.
const PLAGUE_CATEGORIES: readonly LedgerCategory[] = ["wages", "statute_fine", "church_fee", "entry_fine"];

export interface WageLedgerRow {
  readonly category: LedgerCategory;
  readonly label: string;
  readonly thisSeason: number;
  readonly lastSeason: number;
  readonly chapterTotal: number;
  /** The three amounts as shown (this period, last period, chapter 3). */
  readonly shown: readonly [string, string, string];
}

export interface WageLedgerView {
  readonly heading: string;
  readonly rows: readonly WageLedgerRow[];
}

/**
 * UI-8 (F3-A): the wage-ledger section in the LedgerDrawer stock tab. Returns null when chapter 3's
 * plague has not yet arrived (state.plague is absent); otherwise returns the four categories with
 * this-period, last-period and chapter-3 totals. The four categories are plague-exclusive, so the
 * "all" ledger window gives an accurate chapter-3 total with no pre-plague contamination.
 */
export function wageLedgerView(state: GameState): WageLedgerView | null {
  if (state.plague === null || state.plague === undefined) return null;
  const recent = ledgerView(state, "cash", "recent");
  const previous = ledgerView(state, "cash", "previous");
  const all = ledgerView(state, "cash", "all");
  const amountFor = (rows: typeof recent.byCategory, cat: LedgerCategory) =>
    rows.find(row => row.category === cat)?.amount ?? 0;
  const rows = PLAGUE_CATEGORIES.map(category => {
    const thisSeason = amountFor(recent.byCategory, category);
    const lastSeason = amountFor(previous.byCategory, category);
    const chapterTotal = amountFor(all.byCategory, category);
    const label = LEDGER_CATEGORY_LABELS[category];
    return { category, label, thisSeason, lastSeason, chapterTotal,
      shown: [WAGE_LEDGER_COPY.amount(thisSeason), WAGE_LEDGER_COPY.amount(lastSeason), WAGE_LEDGER_COPY.amount(chapterTotal)] as const };
  });
  return { heading: WAGE_LEDGER_COPY.heading, rows };
}
