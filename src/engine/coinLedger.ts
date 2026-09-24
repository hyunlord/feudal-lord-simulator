import { buildingSource, type SourceRef } from "../contracts";
import type { GameState } from "./engine.types";

export interface CoinLedgerEntry {
  readonly tick: number;
  readonly amount: number;
  readonly kind: "income";
  readonly source: "market_sale";
  /** Shared `SourceRef` contract (ledger B3 precursor). Market sales: the selling market building. */
  readonly sourceRefs: readonly SourceRef[];
}

export interface CoinIncomeSummary {
  readonly total: number;
  readonly bySource: readonly {
    readonly source: "market_sale";
    readonly label: "시장 판매";
    readonly amount: number;
  }[];
}

export const COIN_LEDGER_WINDOW_TICKS = 2400;

export function recentCoinIncome(
  state: Pick<GameState, "tick" | "coinLedger">,
  windowTicks = COIN_LEDGER_WINDOW_TICKS,
): CoinIncomeSummary {
  const firstTick = state.tick - Math.max(1, windowTicks) + 1;
  const total = (state.coinLedger ?? [])
    .filter((entry) => entry.tick >= firstTick && entry.tick <= state.tick)
    .reduce((sum, entry) => sum + entry.amount, 0);
  return {
    total,
    bySource: total > 0 ? [{ source: "market_sale", label: "시장 판매", amount: total }] : [],
  };
}

export function appendMarketSales(
  current: readonly CoinLedgerEntry[] | undefined,
  tick: number,
  sales: readonly { readonly marketId: string; readonly coin: number }[],
): readonly CoinLedgerEntry[] {
  const firstTick = tick - COIN_LEDGER_WINDOW_TICKS + 1;
  const retained = (current ?? []).filter((entry) => entry.tick >= firstTick);
  return [
    ...retained,
    ...sales.filter((sale) => sale.coin > 0).map((sale): CoinLedgerEntry => ({
      tick,
      amount: sale.coin,
      kind: "income",
      source: "market_sale",
      sourceRefs: [buildingSource(sale.marketId)],
    })),
  ];
}
