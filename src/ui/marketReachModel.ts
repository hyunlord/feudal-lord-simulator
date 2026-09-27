import type { Building } from "../content/buildingConfig";
import type { GameState } from "../engine/engine.types";
import { MARKET_ROAD_REACH, marketReach, marketRoadDistance } from "../engine/marketService";
import type { TileCoordinate } from "../world/grid";
import { MARKET_REACH_COPY } from "./marketReachCopy.ko";

// UX-0b2 MARKET-1 on screen (spec docs/design/market-reach.md MK-1, MK-3): a market serves the homes within
// MARKET_ROAD_REACH road steps. The placement chip says how far a house would be from the nearest market by road; a
// market's placement preview and a selected market show the road tiles within its reach and the homes it reaches.

export type HouseMarketDistance = Readonly<{ steps: number | null; reach: number }>;

/** A house at the candidate footprint: road steps to the nearest standing market (null: no road joins them), or null with no market. */
export function houseMarketDistance(state: GameState, candidate: Building): HouseMarketDistance | null {
  const markets = state.buildings.filter(building => building.kind === "market");
  if (markets.length === 0) return null;
  const distance = marketRoadDistance(state);
  let best: number | null = null;
  for (const market of markets) {
    const steps = distance(candidate, market);
    if (steps !== null && (best === null || steps < best)) best = steps;
  }
  return { steps: best, reach: MARKET_ROAD_REACH };
}

export type MarketReachView = Readonly<{ roadTiles: readonly TileCoordinate[]; homeIds: readonly string[] }>;

// Cache — key: the state object and the market id (every tick and every action makes a new state, so a hit is the same
// world); reason: a selected market's overlay is drawn every frame, and `marketReach` labels the road graph and walks
// every house each call. Measured with tsx on the seed 1 determinism town (two markets, 300 road tiles, 187 of them
// and 15 homes in the first market's reach): 0.26 ms a call (median of 12), a hit 0.0001 ms.
const reachCache = new WeakMap<GameState, Map<string, MarketReachView>>();

/** The road tiles within a market's reach and the homes it reaches (null if the id is not a market). */
export function marketReachView(state: GameState, marketId: string): MarketReachView | null {
  let byMarket = reachCache.get(state);
  const cached = byMarket?.get(marketId);
  if (cached !== undefined) return cached;
  const market = state.buildings.find(building => building.id === marketId);
  if (market === undefined || market.kind !== "market") return null;
  const view = marketReach(state, market);
  if (byMarket === undefined) { byMarket = new Map(); reachCache.set(state, byMarket); }
  byMarket.set(marketId, view);
  return view;
}

/** A selected market's card line: how many homes its road reach takes in (null for anything but a market). */
export function marketReachLine(state: GameState, buildingId: string): string | null {
  const view = marketReachView(state, buildingId);
  return view === null ? null : MARKET_REACH_COPY.selectedLabel(MARKET_ROAD_REACH, view.homeIds.length);
}
