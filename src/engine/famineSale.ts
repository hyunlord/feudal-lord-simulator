/**
 * F0-C1 FC-2 speculation and what it earns (spec docs/design/flow-chapter-one.md FC-2, FC-2b). At each season's start
 * while the famine arrives, speculation sells a quarter of each working granary's bread and wheat at the market price
 * (`famine_sale`, cash). The history ledger's prediction and actual of the famine answer (HL-3) read the same sale — the
 * grain to sell × the market price — so a town with no income still sees what its granaries would fetch.
 */
import { FAMINE_RESPONSE_CONFIG } from "../content/chapterConfig";
import type { Ledger } from "../ledger/ledger.types";
import type { GameState } from "./engine.types";
import { SEASON_TICKS, dearthEndTick } from "./eventSchedule";
import type { EventRecord } from "./events.types";
import { famineEntriesTotal, famineGranaries } from "./famineRelief";
import { marketSalePrice } from "./marketSettlement";

/** FC-2: what a season's speculation sells from a granary's stock — a quarter of its bread and of its wheat. */
export function speculationSold(stock: { readonly bread?: number; readonly wheat?: number }): { readonly bread: number; readonly wheat: number } {
  const quarter = (amount: number | undefined) => Math.floor(Math.max(0, amount ?? 0) * FAMINE_RESPONSE_CONFIG.speculationPermille / 1000);
  return { bread: quarter(stock.bread), wheat: quarter(stock.wheat) };
}

/**
 * FC-2b, HL-3: speculation's sales predicted when it is chosen, over its seasons in (now, until] while the famine
 * arrives: each granary's quarter sold at today's prices, its stock less what it sold before.
 */
export function speculationSaleForecast(state: GameState, famine: EventRecord, until: number): number {
  const end = famine.endTick ?? dearthEndTick(famine);
  const breadPrice = marketSalePrice(state, "bread");
  const wheatPrice = marketSalePrice(state, "wheat");
  let stocks = famineGranaries(state).map(granary => ({ bread: granary.inventory.bread ?? 0, wheat: granary.inventory.wheat ?? 0 }));
  let sale = 0;
  for (let tick = (Math.floor(state.tick / SEASON_TICKS) + 1) * SEASON_TICKS; tick <= until && tick < end; tick += SEASON_TICKS) {
    stocks = stocks.map(stock => {
      const sold = speculationSold(stock);
      sale += sold.bread * breadPrice + sold.wheat * wheatPrice;
      return { bread: stock.bread - sold.bread, wheat: stock.wheat - sold.wheat };
    });
  }
  return sale;
}

/** FC-2b, HL-3: speculation's sales as posted in (from, until] — its `famine_sale` entries. */
export function speculationSalePosted(ledger: Ledger | undefined, eventId: string, from: number, until: number): number {
  return famineEntriesTotal(ledger, "famine_sale", eventId, from, until);
}
