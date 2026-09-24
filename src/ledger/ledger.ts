/**
 * Ledger posting, roll-up and balances (spec L-1…L-6).
 *
 * A state without `ledger` has not posted yet: its opening balance is `treasuryCoin`. The first posting
 * writes that balance as the `opening_balance` entry, so from then on `treasuryCoin` is only a cache of
 * the cash account and every write goes through here.
 */
import type { SourceRef } from "../contracts";
import type { GameState } from "../engine/engine.types";
import type { Ledger, LedgerAccount, LedgerCategory, LedgerEntry, LedgerPosting, LedgerRollup } from "./ledger.types";

/** One ledger period (the same 2,400 ticks the income window always used). */
export const LEDGER_PERIOD_TICKS = 2_400;
/**
 * Periods kept as entries (the current one and the 5 before it, 14,400 ticks). The work order's example
 * was 12; at about 64 sales per period a 1.6 MB town save would grow ~7%, over the 5% gate, so 6.
 */
export const LEDGER_RETAINED_PERIODS = 6;
/** Per-period roll-ups kept; older ones merge into a single archive roll-up per account. */
export const LEDGER_ROLLUP_PERIODS = 120;

export const EMPTY_LEDGER: Ledger = { entries: [], rollups: [], nextEntryOrdinal: 1 };

export function ledgerEntryId(ordinal: number): string {
  return `ledger-${String(ordinal).padStart(6, "0")}`;
}

export function ledgerPeriodStart(tick: number): number {
  return Math.floor(tick / LEDGER_PERIOD_TICKS) * LEDGER_PERIOD_TICKS;
}

/** The source of an opening balance: the scenario the town is played under. */
export function openingBalanceSource(state: Pick<GameState, "scenarioId">, detail: string): SourceRef {
  return { type: "scenario", id: state.scenarioId ?? "core:campaign_market_town", detail };
}

function sumRollup(rollup: LedgerRollup): number {
  return Object.values(rollup.byCategory).reduce((sum, amount) => sum + (amount ?? 0), 0);
}

/**
 * Cash-balance cache (AGENTS rule 10).
 * (a) Key: the ledger object itself (WeakMap); every posting builds a new ledger object.
 * (b) A ledger is immutable, so its balance cannot change under the same key; `postLedgerEntries`
 *     seeds the new ledger's entry as previous balance + posted cash, which equals the full sum because
 *     roll-ups preserve totals (test L-4 checks the full sum after every posting).
 * (c) Measured in docs/verification/b3-ledger/REPORT.md (seed 1 town, advanceTick mean before/after).
 */
const cashBalances = new WeakMap<Ledger, number>();

function sumAccount(ledger: Ledger, account: LedgerAccount): number {
  let total = 0;
  for (const entry of ledger.entries) if (entry.account === account) total += entry.amount;
  for (const rollup of ledger.rollups) if (rollup.account === account) total += sumRollup(rollup);
  return total;
}

/** Balance of one account: entries plus roll-ups. */
export function accountBalance(ledger: Ledger, account: LedgerAccount): number {
  if (account !== "cash") return sumAccount(ledger, account);
  const cached = cashBalances.get(ledger);
  if (cached !== undefined) return cached;
  const total = sumAccount(ledger, "cash");
  cashBalances.set(ledger, total);
  return total;
}

/** L-3: the treasury is the cash account; before the first posting it is the opening balance. */
export function treasuryBalance(state: Pick<GameState, "ledger" | "treasuryCoin">): number {
  return state.ledger === undefined ? state.treasuryCoin : accountBalance(state.ledger, "cash");
}

/** L-4: fold entries older than the retained periods into per-period roll-ups; merge very old roll-ups. */
export function rollUpLedger(ledger: Ledger, tick: number): Ledger {
  const keepFrom = ledgerPeriodStart(tick) - (LEDGER_RETAINED_PERIODS - 1) * LEDGER_PERIOD_TICKS;
  // Entries are appended in tick order, so the first one is the oldest.
  if (ledger.entries.length === 0 || ledger.entries[0]!.tick >= keepFrom) return ledger;
  const rollups = new Map<string, { periodStart: number; periodEnd: number; account: LedgerAccount; byCategory: Partial<Record<LedgerCategory, number>> }>();
  for (const rollup of ledger.rollups) rollups.set(`${rollup.periodStart}:${rollup.account}`, { ...rollup, byCategory: { ...rollup.byCategory } });
  const entries: LedgerEntry[] = [];
  for (const entry of ledger.entries) {
    if (entry.tick >= keepFrom) {
      entries.push(entry);
      continue;
    }
    const periodStart = ledgerPeriodStart(entry.tick);
    const key = `${periodStart}:${entry.account}`;
    const target = rollups.get(key) ?? { periodStart, periodEnd: periodStart + LEDGER_PERIOD_TICKS, account: entry.account, byCategory: {} };
    target.byCategory[entry.category] = (target.byCategory[entry.category] ?? 0) + entry.amount;
    rollups.set(key, target);
  }
  const archiveBefore = ledgerPeriodStart(tick) - LEDGER_ROLLUP_PERIODS * LEDGER_PERIOD_TICKS;
  const ordered = [...rollups.values()].sort((left, right) => left.periodStart - right.periodStart || left.account.localeCompare(right.account));
  const archived = new Map<LedgerAccount, LedgerRollup>();
  const kept: LedgerRollup[] = [];
  for (const rollup of ordered) {
    if (rollup.periodEnd > archiveBefore) {
      kept.push(rollup);
      continue;
    }
    const previous = archived.get(rollup.account);
    const byCategory: Partial<Record<LedgerCategory, number>> = { ...(previous?.byCategory ?? {}) };
    for (const [category, amount] of Object.entries(rollup.byCategory) as [LedgerCategory, number][]) byCategory[category] = (byCategory[category] ?? 0) + amount;
    archived.set(rollup.account, { periodStart: previous?.periodStart ?? rollup.periodStart, periodEnd: rollup.periodEnd, account: rollup.account, byCategory });
  }
  return { ...ledger, entries, rollups: [...archived.values(), ...kept] };
}

export class LedgerSourceError extends Error {}

/**
 * L-2: posts entries at `state.tick` and returns the new ledger with the derived treasury cache.
 * Every posting needs at least one source (L-5).
 */
export function postLedgerEntries(
  state: Pick<GameState, "ledger" | "treasuryCoin" | "tick" | "scenarioId">,
  postings: readonly LedgerPosting[],
): { readonly ledger: Ledger; readonly treasuryCoin: number } {
  for (const posting of postings) {
    if (!Array.isArray(posting.sourceRefs) || posting.sourceRefs.length === 0) {
      throw new LedgerSourceError(`Ledger entry ${posting.category} has no source`);
    }
    if (!Number.isSafeInteger(posting.amount)) throw new RangeError(`Ledger amount must be whole pennies: ${posting.amount}`);
  }
  let ledger = state.ledger ?? openingLedger(state, "ledger_start");
  const previousCash = accountBalance(ledger, "cash");
  const entries = [...ledger.entries];
  let ordinal = ledger.nextEntryOrdinal;
  let postedCash = 0;
  for (const posting of postings) {
    entries.push({ ...posting, id: ledgerEntryId(ordinal), tick: state.tick });
    if (posting.account === "cash") postedCash += posting.amount;
    ordinal += 1;
  }
  ledger = rollUpLedger({ ...ledger, entries, nextEntryOrdinal: ordinal }, state.tick);
  cashBalances.set(ledger, previousCash + postedCash);
  return { ledger, treasuryCoin: previousCash + postedCash };
}

/** A ledger holding one `opening_balance` entry for the current treasury (first posting, save v6→v7). */
export function openingLedger(state: Pick<GameState, "treasuryCoin" | "tick" | "scenarioId">, detail: string): Ledger {
  return {
    entries: [{ id: ledgerEntryId(1), tick: state.tick, account: "cash", category: "opening_balance", amount: state.treasuryCoin,
      sourceRefs: [openingBalanceSource(state, detail)] }],
    rollups: [],
    nextEntryOrdinal: 2,
  };
}
