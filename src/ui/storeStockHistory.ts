import { BALANCE } from "../content/balanceConfig";
import type { ResourceType } from "../content/resourceConfig";
import type { CarterWalker } from "../agents/walker.types";
import type { GameState } from "../engine/engine.types";

// UX-3R2 store history (UX3R 6절: the storage inspector's weekly change and "이 창고를 쓰는 곳"; the ledger drawer's
// weekly column). Presentation memory only, never saved: every SAMPLE_TICKS the stock of each store, kept for a
// little over a week (7 calendar days); and, every tick, which building or site a carter took goods from a store to
// or brought goods from into one, kept for a season. A new game or a load (the clock going back) starts it over.
export const STORE_KINDS: ReadonlySet<string> = new Set(["storehouse", "granary"]);
const TICKS_PER_DAY = BALANCE.TICKS_PER_YEAR / 360;
export const WEEK_TICKS = Math.round(7 * TICKS_PER_DAY);
const SAMPLE_TICKS = Math.round(TICKS_PER_DAY);
const USE_MEMORY_TICKS = BALANCE.TICKS_PER_YEAR / 4;

type Stock = Readonly<Partial<Record<ResourceType, number>>>;
export type StoreUse = { readonly otherId: string; readonly otherKind: "building" | "site"; readonly resource: ResourceType; readonly direction: "out" | "in"; readonly tick: number };
export type StoreStockHistory = {
  readonly lastTick: number;
  readonly samples: readonly { readonly tick: number; readonly stock: Readonly<Record<string, Stock>> }[];
  readonly uses: Readonly<Record<string, readonly StoreUse[]>>;
};

export function createStoreStockHistory(): StoreStockHistory {
  return { lastTick: -1, samples: [], uses: {} };
}

export function observeStoreStockHistory(history: StoreStockHistory, state: Pick<GameState, "tick" | "buildings" | "walkers">): StoreStockHistory {
  if (state.tick < history.lastTick) history = createStoreStockHistory();
  if (state.tick === history.lastTick) return history;
  const stores = state.buildings.filter(building => STORE_KINDS.has(building.kind));
  const storeIds = new Set(stores.map(store => store.id));
  let samples = history.samples;
  const last = samples[samples.length - 1];
  if (last === undefined || state.tick - last.tick >= SAMPLE_TICKS) {
    samples = [...samples.filter(sample => state.tick - sample.tick <= WEEK_TICKS + SAMPLE_TICKS),
      { tick: state.tick, stock: Object.fromEntries(stores.map(store => [store.id, { ...store.inventory }])) }];
  }
  let uses = history.uses;
  for (const walker of state.walkers) {
    if (walker.kind !== "carter") continue;
    const carter = walker as CarterWalker;
    const claim = carter.reservation.sourceStockClaim;
    const destination = carter.destination;
    const other = destination.kind === "building" ? { otherId: destination.buildingId, otherKind: "building" as const } : { otherId: destination.siteId, otherKind: "site" as const };
    // One entry per (other end, resource, direction), refreshed at most once a day (no churn while a trip lasts).
    const record = (storeId: string, use: StoreUse) => {
      const list = uses[storeId] ?? [];
      const same = (entry: StoreUse) => entry.otherId === use.otherId && entry.resource === use.resource && entry.direction === use.direction;
      const existing = list.find(same);
      if (existing !== undefined && use.tick - existing.tick < SAMPLE_TICKS) return;
      uses = { ...uses, [storeId]: [...list.filter(entry => !same(entry) && use.tick - entry.tick <= USE_MEMORY_TICKS), use] };
    };
    if (claim?.kind === "building" && storeIds.has(claim.buildingId) && other.otherId !== claim.buildingId) {
      record(claim.buildingId, { ...other, resource: carter.reservation.resource, direction: "out", tick: state.tick });
    }
    if (destination.kind === "building" && storeIds.has(destination.buildingId) && carter.homeBuildingId !== destination.buildingId) {
      record(destination.buildingId, { otherId: claim?.kind === "building" ? claim.buildingId : carter.homeBuildingId, otherKind: "building",
        resource: carter.reservation.resource, direction: "in", tick: state.tick });
    }
  }
  return { lastTick: state.tick, samples, uses };
}

/** The store's stock change over the last week (null until a week has been sampled). */
export function weeklyStockChange(history: StoreStockHistory, storeId: string, resource: ResourceType, now: Stock, tick: number): number | null {
  const old = [...history.samples].reverse().find(sample => tick - sample.tick >= WEEK_TICKS);
  if (old === undefined) return null;
  const before = old.stock[storeId];
  if (before === undefined) return null;
  return Math.floor(now[resource] ?? 0) - Math.floor(before[resource] ?? 0);
}

/** The town's stock change of a resource across all stores over the last week (the ledger drawer's column). */
export function weeklyTotalChange(history: StoreStockHistory, resource: ResourceType, state: Pick<GameState, "tick" | "buildings">): number | null {
  const old = [...history.samples].reverse().find(sample => state.tick - sample.tick >= WEEK_TICKS);
  if (old === undefined) return null;
  const now = state.buildings.filter(building => STORE_KINDS.has(building.kind)).reduce((sum, store) => sum + Math.floor(store.inventory[resource] ?? 0), 0);
  const before = Object.values(old.stock).reduce((sum, stock) => sum + Math.floor(stock[resource] ?? 0), 0);
  return now - before;
}
