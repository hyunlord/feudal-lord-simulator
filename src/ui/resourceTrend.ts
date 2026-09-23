import { houseFoodRation } from "../content/houseFoodConfig";
import type { GameState } from "../engine/engine.types";
import { houseLotArea } from "../geometry/buildingFootprint";
import { placementSpendableResource } from "../world/placement";
import { economyStockTotals } from "./ledgerModel";

export const RESOURCE_TREND_WINDOW = 2400;
const SAMPLE_TICKS = 20;
export type ResourceTrendKind = "population" | "bread" | "timber" | "stone" | "coin";
export type ResourceSample = Readonly<Record<ResourceTrendKind, number>> & { readonly tick: number; readonly seed: number };

export function resourceSample(state: GameState): ResourceSample {
  const stock = economyStockTotals(state);
  return { tick: state.tick, seed: state.seed, population: state.population, bread: stock.bread,
    timber: placementSpendableResource(state, "timber"), stone: placementSpendableResource(state, "stone"), coin: stock.coin };
}

export function advanceResourceHistory(history: readonly ResourceSample[], sample: ResourceSample): ResourceSample[] {
  const last = history.at(-1);
  if (!last || last.seed !== sample.seed || sample.tick < last.tick) return [sample];
  const retained = history.filter(item => item.tick >= sample.tick - RESOURCE_TREND_WINDOW);
  if (Math.floor(last.tick / SAMPLE_TICKS) === Math.floor(sample.tick / SAMPLE_TICKS)) retained.pop();
  return [...retained, sample];
}

export function resourceTrend(history: readonly ResourceSample[], kind: ResourceTrendKind, paused: boolean) {
  const first = history[0];
  const last = history.at(-1);
  if (paused || !first || !last || first.tick === last.tick) return null;
  return { delta: last[kind] - first[kind], ticks: last.tick - first.tick };
}

export function breadHouseholdPortions(state: GameState, bread: number): number | null {
  const buildings = new Map(state.buildings.map(building => [building.id, building]));
  let lots = 0;
  let ration = 0;
  for (const house of state.houses) {
    if (house.residents <= 0) continue;
    const building = buildings.get(house.buildingId);
    if (!building) continue;
    lots += houseLotArea(building);
    ration += houseFoodRation(house);
  }
  return ration > 0 ? Math.floor(bread * lots / ration) : null;
}
