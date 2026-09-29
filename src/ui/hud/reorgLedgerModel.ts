import type { GameState } from "../../engine/engine.types";
import { LEDGER_CATEGORY_LABELS } from "../../ledger/ledgerCopy.ko";
import { ledgerView } from "../../ledger/ledgerView";
import type { LedgerCategory } from "../../ledger/ledger.types";
import { REORG_LEDGER_COPY } from "./reorgLedgerCopy.ko";

// UI-9 (F4-A RG-3, RG-6, RG-9): the five chapter 4 money categories that appear only in chapter 4.
const REORG_CATEGORIES: readonly LedgerCategory[] = ["ulnage", "cloth_toll", "fulling_toll", "poll_tax", "fee_farm"];

export interface ReorgLedgerRow {
  readonly category: LedgerCategory;
  readonly label: string;
  readonly thisSeason: number;
  readonly lastSeason: number;
  readonly chapterTotal: number;
  /** The three amounts as shown (this period, last period, chapter 4 total). */
  readonly shown: readonly [string, string, string];
}

export interface ReorgLedgerView {
  readonly heading: string;
  readonly rows: readonly ReorgLedgerRow[];
}

/**
 * UI-9 (F4-A): the reorganisation ledger section in the LedgerDrawer stock tab. Returns null when chapter 4's
 * reorganisation has not yet started (state.reorganisation is absent); otherwise returns the five categories
 * with this-period, last-period and chapter-4 totals. The categories are chapter-4-exclusive (cloth_toll,
 * poll_tax, fee_farm) or significantly active only then (ulnage, fulling_toll), matching the wage-ledger pattern.
 */
export function reorgLedgerView(state: GameState): ReorgLedgerView | null {
  if (state.reorganisation === null || state.reorganisation === undefined) return null;
  const recent = ledgerView(state, "cash", "recent");
  const previous = ledgerView(state, "cash", "previous");
  const all = ledgerView(state, "cash", "all");
  const amountFor = (rows: typeof recent.byCategory, cat: LedgerCategory) =>
    rows.find(row => row.category === cat)?.amount ?? 0;
  const rows = REORG_CATEGORIES.map(category => {
    const thisSeason = amountFor(recent.byCategory, category);
    const lastSeason = amountFor(previous.byCategory, category);
    const chapterTotal = amountFor(all.byCategory, category);
    const label = LEDGER_CATEGORY_LABELS[category];
    return { category, label, thisSeason, lastSeason, chapterTotal,
      shown: [REORG_LEDGER_COPY.amount(thisSeason), REORG_LEDGER_COPY.amount(lastSeason), REORG_LEDGER_COPY.amount(chapterTotal)] as const };
  });
  return { heading: REORG_LEDGER_COPY.heading, rows };
}
