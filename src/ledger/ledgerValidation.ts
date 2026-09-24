import { SOURCE_REF_TYPES } from "../contracts";
import { accountBalance, ledgerEntryId } from "./ledger";
import { LEDGER_ACCOUNTS, LEDGER_CATEGORIES, type Ledger } from "./ledger.types";

const isOneOf = (values: readonly string[], value: unknown) => typeof value === "string" && values.includes(value);

/**
 * Save-load check of the ledger (v7): known accounts and categories, whole-penny amounts, a source on
 * every entry, ids from ordinals below `nextEntryOrdinal` in order, and a cash balance equal to the
 * cached `treasuryCoin`. Returns the first problem, or null.
 */
export function ledgerStateProblem(state: Readonly<Record<string, unknown>>): string | null {
  const ledger = state.ledger as Record<string, unknown> | undefined;
  if (ledger === undefined) return null;
  if (typeof ledger !== "object" || ledger === null || !Array.isArray(ledger.entries) || !Array.isArray(ledger.rollups)) return "ledger must hold entries and rollups";
  const next = ledger.nextEntryOrdinal;
  if (typeof next !== "number" || !Number.isSafeInteger(next) || next < 1) return "ledger nextEntryOrdinal must be a positive integer";
  let previous = 0;
  for (const entry of ledger.entries as Record<string, unknown>[]) {
    if (typeof entry !== "object" || entry === null) return "ledger entry must be an object";
    const ordinal = typeof entry.id === "string" ? Number(entry.id.slice("ledger-".length)) : Number.NaN;
    if (!Number.isSafeInteger(ordinal) || entry.id !== ledgerEntryId(ordinal) || ordinal <= previous || ordinal >= next) return "ledger entry id is out of order";
    previous = ordinal;
    if (!isOneOf(LEDGER_ACCOUNTS, entry.account)) return "ledger account is unknown";
    if (!isOneOf(LEDGER_CATEGORIES, entry.category)) return "ledger category is unknown";
    if (typeof entry.amount !== "number" || !Number.isSafeInteger(entry.amount)) return "ledger amount must be whole pennies";
    if (typeof entry.tick !== "number" || !Number.isSafeInteger(entry.tick) || entry.tick > Number(state.tick)) return "ledger entry tick is invalid";
    if (!Array.isArray(entry.sourceRefs) || entry.sourceRefs.length === 0) return "ledger entry has no source";
    for (const source of entry.sourceRefs as Record<string, unknown>[]) {
      if (typeof source !== "object" || source === null || !isOneOf(SOURCE_REF_TYPES, source.type) || typeof source.id !== "string") return "ledger source is malformed";
    }
  }
  for (const rollup of ledger.rollups as Record<string, unknown>[]) {
    if (typeof rollup !== "object" || rollup === null || !isOneOf(LEDGER_ACCOUNTS, rollup.account)
      || typeof rollup.periodStart !== "number" || typeof rollup.periodEnd !== "number" || rollup.periodEnd <= rollup.periodStart) return "ledger rollup is malformed";
    const byCategory = rollup.byCategory as Record<string, unknown> | undefined;
    if (typeof byCategory !== "object" || byCategory === null) return "ledger rollup has no categories";
    for (const [category, amount] of Object.entries(byCategory)) {
      if (!isOneOf(LEDGER_CATEGORIES, category) || typeof amount !== "number" || !Number.isSafeInteger(amount)) return "ledger rollup category is malformed";
    }
  }
  if (accountBalance(ledger as unknown as Ledger, "cash") !== state.treasuryCoin) return "ledger cash balance does not match the treasury";
  return null;
}
