import type { GameState } from "../../engine/engine.types";
import { LEDGER_CATEGORY_LABELS } from "../../ledger/ledgerCopy.ko";
import { ledgerView } from "../../ledger/ledgerView";
import type { LedgerCategory } from "../../ledger/ledger.types";
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
 * (state.legacy absent). The chapter total counts from chapter 5's start: its entries, and the folded periods that began
 * then or later (a period folded across the start is left out, so an early fee farm is not counted twice with chapter 4's).
 */
export function legacyLedgerView(state: GameState): LegacyLedgerView | null {
  const legacy = state.legacy;
  if (legacy === undefined) return null;
  const recent = ledgerView(state, "cash", "recent");
  const previous = ledgerView(state, "cash", "previous");
  const amountFor = (rows: typeof recent.byCategory, category: LedgerCategory) => rows.find(row => row.category === category)?.amount ?? 0;
  const since = legacy.startTick;
  const chapterTotal = (category: LedgerCategory) =>
    (state.ledger?.entries ?? []).filter(entry => entry.account === "cash" && entry.category === category && entry.tick >= since).reduce((sum, entry) => sum + entry.amount, 0)
    + (state.ledger?.rollups ?? []).filter(rollup => rollup.account === "cash" && rollup.periodStart >= since).reduce((sum, rollup) => sum + (rollup.byCategory[category] ?? 0), 0);
  const rows = LEGACY_CATEGORIES.map(category => {
    const thisSeason = amountFor(recent.byCategory, category);
    const lastSeason = amountFor(previous.byCategory, category);
    const total = chapterTotal(category);
    return { category, label: LEDGER_CATEGORY_LABELS[category], thisSeason, lastSeason, chapterTotal: total,
      shown: [LEGACY_LEDGER_COPY.amount(thisSeason), LEGACY_LEDGER_COPY.amount(lastSeason), LEGACY_LEDGER_COPY.amount(total)] as const };
  });
  return { heading: LEGACY_LEDGER_COPY.heading, rows };
}
