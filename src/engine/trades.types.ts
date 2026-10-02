/** LM-E6a (spec docs/design/trades.md TR-9, save v46): lord mode's trade households, the town's trade goods and chains. */
import type { LocationFactor, TradeChain, TradeGood, TradeId, WorkshopArchetype } from "../content/trades";

/** TR-3: one item of a household's location score; `subject` names the input for "raw" (e.g. "hides"). */
export interface TradeReason {
  readonly factor: LocationFactor;
  readonly value: number;
  readonly subject?: string;
}

/** TR-3/TR-4: why the household took the trade — the items, their sum, and the draw it won. */
export interface TradeReceipt {
  readonly tick: number;
  readonly reasons: readonly TradeReason[];
  readonly score: number;
  /** The chance (permille) of this choice among the season's best pairs, and how many there were. */
  readonly chancePermille: number;
  readonly of: number;
}

export interface TradeHousehold {
  readonly houseId: string;
  readonly tradeId: TradeId;
  readonly sinceTick: number;
  readonly workshop: WorkshopArchetype;
  readonly receipt: TradeReceipt;
  /** Last season's output against capacity (permille). */
  readonly productivityPermille: number;
  /** Seasons in a row without output (TR-4: four and the household gives up). */
  readonly idleSeasons: number;
}

/** TR-6: why a chain (or trade) made less than it could. */
export type TradeCause =
  | { readonly kind: "input"; readonly subject: string; readonly days: number }
  | { readonly kind: "demand" }
  | { readonly kind: "none" };

export interface ChainState {
  readonly productivityPermille: number;
  /** The chain's weakest trade and its cause. */
  readonly tradeId: TradeId | null;
  readonly cause: TradeCause;
}

/** TR-8: a named street — households of one trade gathered together. */
export interface TradeStreet {
  readonly tradeId: TradeId;
  readonly houseIds: readonly string[];
  readonly namedTick: number;
}

export interface TradeState {
  readonly households: readonly TradeHousehold[];
  /** TR-5: the town's stock of trade goods. */
  readonly stock: Readonly<Partial<Record<TradeGood, number>>>;
  readonly chains: Readonly<Partial<Record<TradeChain, ChainState>>>;
  readonly streets: readonly TradeStreet[];
  /** TR-7: goods the carters moved this season and last season. */
  readonly haulage: { readonly season: number; readonly last: number };
  /** TR-4: households that gave up their trade (house, trade, tick), the latest last; at most 40 kept. */
  readonly quits: readonly { readonly houseId: string; readonly tradeId: TradeId; readonly tick: number }[];
}
