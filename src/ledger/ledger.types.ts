/**
 * Economy ledger (spec `docs/design/ledger.md`, L-*). Every money movement is an entry with its
 * sources; the treasury is derived from the cash account. Amounts are pennies (integers, signed).
 */
import type { SourceRef } from "../contracts";

/** Cash, restricted funds (murage…), arrears owed (unpaid upkeep since C2), obligations in kind. */
export const LEDGER_ACCOUNTS = ["cash", "restricted", "arrears", "in_kind"] as const;
export type LedgerAccount = (typeof LEDGER_ACCOUNTS)[number];

/**
 * Registered categories (spec M-1…M-7). `market_sale` stays registered for saved history only: since C2 the
 * market no longer pays the treasury (goods belong to residents and traders). `construction` is reserved.
 */
export const LEDGER_CATEGORIES = [
  "opening_balance", "market_sale", "construction", "upkeep",
  "toll", "stall_fee", "rent", "mill_toll", "demesne_sale", "project",
  // F0-C1 (FC-2, FC-3): famine relief bought, granary grain sold in the famine, a charter's price.
  "famine_relief", "famine_sale", "charter_fee",
  // FAIL-3 (FL-6, FL-7): a lost right bought back; the treasury share a withdrawing house takes with it.
  "restoration_fee", "house_change",
  // F2-A (WR-2…WR-8): the wool levy, the array's exemption, the lay subsidy, the merchants' war loan, the war tax, the
  // raid's plunder, the purveyors' wheat, the refugees' fee, murage.
  "wool_levy", "war_exemption", "war_subsidy", "war_loan", "war_tax", "raid_loot", "purveyance", "refugee_fee", "murage",
  // F3-A (PL-5…PL-7): the raised wages, the Statute's fine, the monastery's stipend, the new settlers' entry fines.
  "wages", "statute_fine", "church_fee", "entry_fine",
  // C5 (CL-5, CL-8): the fulling mill's toll, the aulnager's seal on cloth sold.
  "fulling_toll", "ulnage",
  // F4-A (RG-3, RG-6, RG-9): the lord's toll on cloth sold, his share of the poll tax, the town's fee farm.
  "cloth_toll", "poll_tax", "fee_farm",
  // F5-A (LG-3…LG-5): the Crown's subsidy (and its confirmation of a charter), the heir's relief, the legacy's endowment.
  "royal_subsidy", "succession_relief", "legacy_endowment",
  // FIX-9 (LG-13): the parish's nave rebuilt.
  "church_rebuilding",
  // FIX-10 (TT-2): timber bought from the market's traders.
  "timber_purchase",
] as const;
export type LedgerCategory = (typeof LEDGER_CATEGORIES)[number];

/** At least one source: the type makes an empty list a compile error, `postLedgerEntries` a runtime one. */
export type LedgerSources = readonly [SourceRef, ...SourceRef[]];

export interface LedgerEntry {
  /** `ledger-000001`, from `Ledger.nextEntryOrdinal`. */
  readonly id: string;
  readonly tick: number;
  readonly account: LedgerAccount;
  readonly category: LedgerCategory;
  /** Pennies; income positive, spending negative. */
  readonly amount: number;
  readonly sourceRefs: LedgerSources;
  /** `restricted` only: which fund. */
  readonly fundId?: string;
  /** `in_kind` only: which resource is owed or held. */
  readonly resource?: string;
}

/** Entries of older periods folded to per-category sums (spec L-4). `periodEnd` is exclusive. */
export interface LedgerRollup {
  readonly periodStart: number;
  readonly periodEnd: number;
  readonly account: LedgerAccount;
  readonly byCategory: Readonly<Partial<Record<LedgerCategory, number>>>;
}

export interface Ledger {
  readonly entries: readonly LedgerEntry[];
  readonly rollups: readonly LedgerRollup[];
  readonly nextEntryOrdinal: number;
}

/** What a rule posts; the ledger assigns id and tick. */
export type LedgerPosting = Omit<LedgerEntry, "id" | "tick">;
