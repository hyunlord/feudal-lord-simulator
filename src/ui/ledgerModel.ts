import { treasuryBalance } from "../ledger/ledger";
import { RESOURCE_TYPES } from "../content/resourceConfig";
import { emptyResourceTotals, type ResourceTotals } from "../content/resourceCatalog";
import type { GameState } from "../engine/engine.types";

export type EconomyStockTotals = ResourceTotals;

const stockAmount = (amount: number | undefined): number =>
  Number.isFinite(amount) ? Math.max(0, amount ?? 0) : 0;

export function economyStockTotals(state: GameState): EconomyStockTotals {
  const totals = emptyResourceTotals();
  totals.timber += stockAmount(state.treasuryTimber);
  // Spec L-3: the treasury is the ledger's cash balance.
  totals.coin += stockAmount(treasuryBalance(state));

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
