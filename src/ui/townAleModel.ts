import { townAle } from "../engine/ale";
import type { GameState } from "../engine/engine.types";
import { TOWN_ALE_COPY } from "./townAleCopy.ko";

// ECON-UI (engine FIX-7 `townAle`, AL-10): the town's ale in words. Ale is brewed and kept in the households' brewing
// slots (AL-4), so the stores' totals never show it; these lines do. A town that has neither brewed nor held ale has
// none (null).
export type TownAleView = Readonly<{
  stock: string; houses: string; served: string;
  thisSeason: string; lastSeason: string | null;
  /** The stores' card line. */
  inHouses: string;
  /** The season card's line: the season that just closed (the engine's last season), null before one with ale. */
  closedSeason: string | null;
}>;

export function townAleView(state: GameState): TownAleView | null {
  const ale = townAle(state);
  if (state.ale === undefined && ale.stock === 0) return null;
  const season = (count: { readonly brewed: number; readonly drunk: number; readonly sold: number }) =>
    TOWN_ALE_COPY.season(Math.floor(count.brewed), Math.floor(count.drunk), Math.floor(count.sold));
  const stock = Math.floor(ale.stock), inAlehouses = Math.floor(ale.inAlehouses);
  return {
    stock: TOWN_ALE_COPY.stock(stock, inAlehouses),
    houses: TOWN_ALE_COPY.houses(ale.brewingHouses, ale.alehouses),
    served: TOWN_ALE_COPY.served(ale.servedHouses, ale.drinkingHouses, ale.seasonNeed),
    thisSeason: TOWN_ALE_COPY.thisSeason(season(ale.season)),
    lastSeason: ale.lastSeason === null ? null : TOWN_ALE_COPY.lastSeason(season(ale.lastSeason)),
    inHouses: TOWN_ALE_COPY.inHouses(stock, inAlehouses),
    closedSeason: ale.lastSeason === null ? null : TOWN_ALE_COPY.closedSeason(season(ale.lastSeason)),
  };
}
