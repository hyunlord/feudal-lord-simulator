import {
  RESOURCE_TYPES,
  type ResourceType,
} from "../content/resourceConfig";
import type { GameState } from "../engine/engine.types";

export type EconomyStockTotals = Record<ResourceType, number>;

const emptyTotals = (): EconomyStockTotals => ({
  wheat: 0,
  bread: 0,
  logs: 0,
  timber: 0,
  stone_raw: 0,
  stone: 0,
  coin: 0,
});

const stockAmount = (amount: number | undefined): number =>
  Number.isFinite(amount) ? Math.max(0, amount ?? 0) : 0;

export function economyStockTotals(state: GameState): EconomyStockTotals {
  const totals = emptyTotals();
  totals.timber += stockAmount(state.treasuryTimber);

  for (const building of state.buildings) {
    for (const resource of RESOURCE_TYPES) {
      totals[resource] += stockAmount(building.inventory[resource]);
    }
  }

  for (const walker of state.walkers) {
    if (walker.cargo !== null) {
      totals[walker.cargo.resource] += stockAmount(walker.cargo.amount);
    }
  }
  return totals;
}
