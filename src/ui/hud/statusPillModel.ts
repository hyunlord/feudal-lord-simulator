import { RESOURCE_TYPES, type ResourceType } from "../../content/resourceConfig";
import { BALANCE } from "../../content/balanceConfig";
import type { GameState } from "../../engine/engine.types";
import { BUILDING_CONFIG_BY_KIND } from "../../content/buildingConfig";
import { HOUSE_FOOD_INTERVAL, houseFoodRation } from "../../content/houseFoodConfig";
import { economyStockTotals } from "../ledgerModel";

// UX-3 status pill (research 15 C, S-42): four numbers always on screen — the date and season, the population, how many
// calendar days the stored food lasts, and the money (pennies, "d"). Everything else is in the ledger.
// Judgement 2026-09-26: the food number is what lies in the stores only — the storehouses and granaries (bread, and
// wheat as the bread a mill makes of it) over the current ration, as FIX-1 foodReserveTicks counts it but without
// the bread already on carts or in the mills and barns; no production counted (the conservative reading of Q2).
const DAYS_PER_YEAR = 360;
const STORE_KINDS: ReadonlySet<string> = new Set(["storehouse", "granary"]);

/** Ticks the food in the stores lasts at the current ration; null when no house eats. */
export function storedFoodTicks(state: Pick<GameState, "houses" | "buildings">): number | null {
  const ration = state.houses.reduce((sum, house) => sum + (house.residents > 0 ? houseFoodRation(house) : 0), 0);
  if (ration <= 0) return null;
  const stored = (resource: "bread" | "wheat") => state.buildings.reduce((sum, building) =>
    sum + (STORE_KINDS.has(building.kind) ? Math.max(0, building.inventory[resource] ?? 0) : 0), 0);
  const wheatPerBread = BUILDING_CONFIG_BY_KIND.mill.production?.inputPerOutput ?? 2;
  return Math.floor((stored("bread") + Math.floor(stored("wheat") / wheatPerBread)) * HOUSE_FOOD_INTERVAL / ration);
}

export function foodDays(state: Pick<GameState, "houses" | "buildings">): number | null {
  const ticks = storedFoodTicks(state);
  return ticks === null ? null : Math.floor(ticks * DAYS_PER_YEAR / BALANCE.TICKS_PER_YEAR);
}

export function statusPillModel(state: GameState) {
  const ticks = storedFoodTicks(state);
  return { population: state.population, foodDays: foodDays(state), foodUntilTick: ticks === null ? null : state.tick + ticks,
    coin: Math.floor(economyStockTotals(state).coin) };
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
