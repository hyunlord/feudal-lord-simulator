/**
 * FIX-10 timber from the market's traders (spec docs/design/timber-trade.md):
 * - TT-1 the command `order_timber` sets a standing order (0 cancels, at most `maxOrder`); the order waits for a market.
 * - TT-2 on each market day (a market round) with a staffed market open, the traders bring up to `perMarketDay` of it
 *   into the treasury's timber at `price` pennies each — as much as the treasury pays for — posted `timber_purchase`.
 * - TT-3 the order falls by what came; at nought it is gone.
 * - TT-4 the bot orders its wall's missing timber when it can pay for it and keep `botCoinReserve`; TT-4b, when a building
 *   it wants lacks only timber and the town's sawmills made none in the last window, that building's missing timber.
 */
import { TIMBER_TRADE_BALANCE } from "../content/timberTradeConfig";
import { constructionDeliveryNeed, isWallConstructionSite } from "../economy/construction";
import { TIMBER_EXPANSION_OBSERVATION_TICKS } from "./autoplayTimberRecovery";
import { postLedgerEntries } from "../ledger/ledger";
import { placementSpendableResource } from "../world/placement";
import type { GameState } from "./engine.types";
import { completedMarkets, MARKET_CADENCE_TICKS } from "./marketSettlement";

/** TT-1: the standing order, clamped to 0…`maxOrder` (0 cancels); FIX-15 (TT-5): a hamlet's to `hamletMaxOrder`. */
export function orderTimber(state: GameState, amount: number): GameState {
  const cap = state.era === "hamlet" && timberTradeMarket(state) === null ? TIMBER_TRADE_BALANCE.hamletMaxOrder : TIMBER_TRADE_BALANCE.maxOrder;
  const next = Math.max(0, Math.min(cap, Math.floor(Number.isFinite(amount) ? amount : 0)));
  if (next === (state.timberOrder ?? 0)) return state;
  if (next === 0) { const { timberOrder: _gone, ...rest } = state; return rest; }
  return { ...state, timberOrder: next };
}

/** TT-2: the market that trades with the timber merchants (the first staffed one), or null. */
export function timberTradeMarket(state: GameState) {
  return completedMarkets(state.buildings)[0] ?? null;
}

/**
 * FIX-14 (TT-5): where the traders deliver — the trading market, or, in a hamlet (no market before the market charter),
 * its first storehouse (the traders cart it from a neighbouring market on the market cadence).
 */
export function timberTradePoint(state: GameState) {
  return timberTradeMarket(state) ?? (state.era === "hamlet"
    ? [...state.buildings].filter(building => building.kind === "storehouse").sort((a, b) => a.id.localeCompare(b.id))[0] ?? null : null);
}

/** TT-2, TT-3: a market day's delivery of the standing order. */
export function advanceTimberTrade(state: GameState): GameState {
  const order = state.timberOrder ?? 0;
  if (order <= 0 || state.tick <= 0 || state.tick % MARKET_CADENCE_TICKS !== 0) return state;
  const market = timberTradePoint(state);
  if (market === null) return state;
  // FIX-15 (TT-5): carted to a hamlet's storehouse — dearer and less a market day.
  const carted = market.kind !== "market";
  const price = carted ? TIMBER_TRADE_BALANCE.hamletPrice : TIMBER_TRADE_BALANCE.price;
  const brought = Math.min(order, carted ? TIMBER_TRADE_BALANCE.hamletPerMarketDay : TIMBER_TRADE_BALANCE.perMarketDay, Math.floor(Math.max(0, state.treasuryCoin) / price));
  if (brought <= 0) return state;
  const posted = postLedgerEntries(state, [{ account: "cash", category: "timber_purchase", amount: -brought * price,
    sourceRefs: [{ type: "building", id: market.id, detail: `timber:${brought}` }] }]);
  const left = order - brought;
  const { timberOrder: _order, ...rest } = state;
  return { ...rest, ...(left > 0 ? { timberOrder: left } : {}), treasuryTimber: state.treasuryTimber + brought,
    treasuryCoin: posted.treasuryCoin, ledger: posted.ledger };
}

/**
 * TT-4: the bot's order — once its wall has waited a whole shortage window for timber (the window that also lets it add
 * a logging camp, `TIMBER_EXPANSION_OBSERVATION_TICKS`), the wall timber still lacking, what the treasury pays for above
 * the reserve.
 */
export function botTimberOrder(state: GameState): number | null {
  if ((state.timberOrder ?? 0) > 0 || timberTradeMarket(state) === null) return null;
  const since = state.timberProductionWindow?.expansionShortageSinceTick;
  if (since === undefined || state.tick - since < TIMBER_EXPANSION_OBSERVATION_TICKS) return null;
  const need = state.constructionSites.filter(isWallConstructionSite).reduce((sum, site) => sum + (constructionDeliveryNeed(site).timber ?? 0), 0)
    - placementSpendableResource(state, "timber");
  if (need <= 0) return null;
  const affordable = Math.floor((state.treasuryCoin - TIMBER_TRADE_BALANCE.botCoinReserve) / TIMBER_TRADE_BALANCE.price);
  const amount = Math.min(need, affordable, TIMBER_TRADE_BALANCE.maxOrder);
  return amount >= TIMBER_TRADE_BALANCE.perMarketDay ? amount : null;
}

/**
 * FIX-14 (TT-5, decision FX13-5 (가)): the market charter waits on timber the town cannot reach (its sawmills made none in
 * the last window: the receivers full) — TT-4b's shortfall and reserve, delivered at the trade point (a hamlet's storehouse).
 */
export function charterTimberOrder(state: GameState, timberNeeded: number): number | null {
  if ((state.timberOrder ?? 0) > 0 || timberTradePoint(state) === null) return null;
  const production = state.timberProductionWindow;
  if (production === undefined || production.produced > 0 || state.tick - production.startTick < 2399
    || !state.buildings.some(building => building.kind === "sawmill")) return null;
  const shortfall = timberNeeded - placementSpendableResource(state, "timber");
  if (shortfall <= 0) return null;
  // FIX-15 (TT-5): without a market, the carted price and the hamlet's largest order.
  const carted = timberTradeMarket(state) === null;
  const affordable = Math.floor((state.treasuryCoin - TIMBER_TRADE_BALANCE.botCoinReserve) / (carted ? TIMBER_TRADE_BALANCE.hamletPrice : TIMBER_TRADE_BALANCE.price));
  const amount = Math.min(Math.max(shortfall, carted ? TIMBER_TRADE_BALANCE.hamletPerMarketDay : TIMBER_TRADE_BALANCE.perMarketDay),
    carted ? TIMBER_TRADE_BALANCE.hamletMaxOrder : TIMBER_TRADE_BALANCE.maxOrder);
  return amount <= affordable ? amount : null;
}

/**
 * TT-4b: the bot wants a building that lacks only timber while the town's own timber has stopped (sawmills stand but
 * made none in the last 2,400-tick window: the camps' wood cut out) — the shortfall, if the treasury pays for it above
 * the reserve.
 */
export function botTimberOrderFor(state: GameState, timberNeeded: number): number | null {
  if ((state.timberOrder ?? 0) > 0 || timberTradeMarket(state) === null) return null;
  const production = state.timberProductionWindow;
  if (production === undefined || production.produced > 0 || state.tick - production.startTick < 2399
    || !state.buildings.some(building => building.kind === "sawmill")) return null;
  const shortfall = timberNeeded - placementSpendableResource(state, "timber");
  if (shortfall <= 0) return null;
  const affordable = Math.floor((state.treasuryCoin - TIMBER_TRADE_BALANCE.botCoinReserve) / TIMBER_TRADE_BALANCE.price);
  const amount = Math.min(Math.max(shortfall, TIMBER_TRADE_BALANCE.perMarketDay), TIMBER_TRADE_BALANCE.maxOrder);
  return amount <= affordable ? amount : null;
}
