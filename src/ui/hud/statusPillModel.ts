import { RESOURCE_TYPES, type ResourceType } from "../../content/resourceConfig";
import { BALANCE } from "../../content/balanceConfig";
import type { GameState } from "../../engine/engine.types";
import { foodReserveTicks } from "../../population/foodReserve";
import { economyStockTotals } from "../ledgerModel";

// UX-3 status pill (research 15 C, S-42): four numbers always on screen — the date and season, the population, how many
// calendar days the stored food lasts (bread and wheat as bread, FIX-1 foodReserveTicks: stock over the current
// ration, no production counted — the conservative reading of Q2), and the money. Everything else is in the ledger.
const DAYS_PER_YEAR = 360;

export function foodDays(state: GameState): number | null {
  const ticks = foodReserveTicks(state);
  return ticks === null ? null : Math.floor(ticks * DAYS_PER_YEAR / BALANCE.TICKS_PER_YEAR);
}

export function statusPillModel(state: GameState) {
  return { population: state.population, foodDays: foodDays(state), coin: Math.floor(economyStockTotals(state).coin) };
}

/** Ledger drawer (S-26): resource x storage — every building that holds goods, its stock per resource, and totals. */
export type LedgerMatrix = Readonly<{
  stores: readonly { readonly id: string; readonly kind: string; readonly index: number; readonly stock: Partial<Record<ResourceType, number>> }[];
  rows: readonly { readonly resource: ResourceType; readonly byStore: readonly number[]; readonly total: number }[];
}>;

export function ledgerMatrix(state: GameState): LedgerMatrix {
  const counters = new Map<string, number>();
  const stores = state.buildings
    .filter(building => RESOURCE_TYPES.some(resource => resource !== "coin" && (building.inventory[resource] ?? 0) > 0))
    .map(building => {
      const index = (counters.get(building.kind) ?? 0) + 1; counters.set(building.kind, index);
      return { id: building.id, kind: building.kind, index, stock: building.inventory };
    });
  const totals = economyStockTotals(state);
  const rows = RESOURCE_TYPES.filter(resource => resource !== "coin").map(resource => ({
    resource, byStore: stores.map(store => Math.floor(store.stock[resource] ?? 0)), total: Math.floor(totals[resource]),
  })).filter(row => row.total > 0);
  return { stores, rows };
}
