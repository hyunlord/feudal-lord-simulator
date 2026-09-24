/**
 * Economy ledger (spec `docs/design/ledger.md`, L-*). Every money movement is an entry with its
 * sources; the treasury is derived from the cash account. Amounts are pennies (integers, signed).
 */
import type { SourceRef } from "../contracts";

/** Cash, restricted funds (murage…), arrears owed, obligations in kind. Only `cash` has entries yet. */
export const LEDGER_ACCOUNTS = ["cash", "restricted", "arrears", "in_kind"] as const;
export type LedgerAccount = (typeof LEDGER_ACCOUNTS)[number];

/**
 * Registered categories. `construction` and `upkeep` are reserved: no rule spends money yet (B3 found
 * none), so they carry no entry until a rule does. C2 adds `toll`, `stall_fee`, `rent`, `mill_toll`.
 */
export const LEDGER_CATEGORIES = ["opening_balance", "market_sale", "construction", "upkeep"] as const;
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
