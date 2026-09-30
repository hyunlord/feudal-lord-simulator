import type { GameState } from "../../engine/engine.types";
import { LEDGER_CATEGORY_LABELS } from "../../ledger/ledgerCopy.ko";
import { ledgerView } from "../../ledger/ledgerView";
import type { LedgerCategory } from "../../ledger/ledger.types";
import { chapterCash } from "./chapterLedgerTotals";
import { LEGACY_LEDGER_COPY } from "./legacyLedgerCopy.ko";

// UI-10 (F5-A LG-12 "금고 줄"): chapter 5's money by category — the Crown's tax and the charter's confirmation
// (royal_subsidy), the succession's relief, the legacy's endowment, the charter fee, the nave (church_rebuilding, LG-13)
// and the fee farm the town pays each spring.
const LEGACY_CATEGORIES: readonly LedgerCategory[] = ["royal_subsidy", "succession_relief", "legacy_endowment", "charter_fee", "church_rebuilding", "fee_farm"];

export interface LegacyLedgerRow {
  readonly category: LedgerCategory;
  readonly label: string;
  readonly thisSeason: number;
  readonly lastSeason: number;
  readonly chapterTotal: number;
  /** The three amounts as shown (this period, last period, chapter 5 total). */
  readonly shown: readonly [string, string, string];
}

export interface LegacyLedgerView {
  readonly heading: string;
  readonly rows: readonly LegacyLedgerRow[];
}

/**
 * UI-10: the chapter 5 section of the LedgerDrawer stock tab (the reorganisation's pattern). Null before chapter 5
 * (state.legacy absent). The chapter total is chapter 5's own: after chapter 4's end, up to chapter 5's (chapterCash).
 */
export function legacyLedgerView(state: GameState): LegacyLedgerView | null {
  if (state.legacy === undefined) return null;
  const recent = ledgerView(state, "cash", "recent");
  const previous = ledgerView(state, "cash", "previous");
  const amountFor = (rows: typeof recent.byCategory, category: LedgerCategory) => rows.find(row => row.category === category)?.amount ?? 0;
  const rows = LEGACY_CATEGORIES.map(category => {
    const thisSeason = amountFor(recent.byCategory, category);
    const lastSeason = amountFor(previous.byCategory, category);
    const total = chapterCash(state, 5, category, false);
    return { category, label: LEDGER_CATEGORY_LABELS[category], thisSeason, lastSeason, chapterTotal: total,
      shown: [LEGACY_LEDGER_COPY.amount(thisSeason), LEGACY_LEDGER_COPY.amount(lastSeason), LEGACY_LEDGER_COPY.amount(total)] as const };
  });
  return { heading: LEGACY_LEDGER_COPY.heading, rows };
}
