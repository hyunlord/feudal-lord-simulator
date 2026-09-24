/**
 * Money-rule state between settlements (save v8, spec docs/design/money-rules.md). Absent = nothing
 * accrued and nothing owed. Money itself lives only in the ledger; this holds counts and the arrears queue.
 */
import type { SourceRef } from "../contracts";

/** One unpaid upkeep charge (M-6). The queue is paid oldest first; its sum is the arrears balance. */
export interface UpkeepArrear {
  readonly tick: number;
  readonly amount: number;
  /** The facility that was not paid: a building, or a gate toll point (`right`, `gate:x,y`). */
  readonly facility: SourceRef;
}

export interface MoneyState {
  /** Carter crossings per toll point (`gate:x,y`, `bridge:tx,ty`) since the last settlement (M-4). */
  readonly crossings: Readonly<Record<string, number>>;
  /** Wheat each mill ground that is not yet charged; settlement charges whole `millTollWheat` units (M-3). */
  readonly millWheat: Readonly<Record<string, number>>;
  readonly arrears: readonly UpkeepArrear[];
}

export const EMPTY_MONEY: MoneyState = { crossings: {}, millWheat: {}, arrears: [] };
