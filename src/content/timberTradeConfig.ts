/**
 * FIX-10 timber bought from the market's traders (spec docs/design/timber-trade.md TT-1…TT-4): a land short of wood
 * buys it dear rather than wait. Integers, a hypothesis to be tuned after play.
 */
export const TIMBER_TRADE_BALANCE = {
  /** Pennies a timber: three times what the market sells it at (6d, `marketSalePrice`). */
  price: 18,
  /** Timber the traders bring on one market day (a market round, 80 ticks): about 100 a year, two logging camps' worth. */
  perMarketDay: 2,
  /** The largest standing order. */
  maxOrder: 400,
  /** The bot orders only what it can pay while keeping this much in the treasury. */
  botCoinReserve: 300,
  /**
   * FIX-15 (TT-5, the user's verdict): a hamlet before its market charter is served at its storehouse — dearer (the
   * carriage from a neighbouring market: half again), less a market day, and one order at most this much — so the
   * charter's market is still worth having.
   */
  hamletPrice: 27,
  hamletPerMarketDay: 1,
  hamletMaxOrder: 60,
} as const;
