/**
 * FIX-11 (15): stuck stock — goods a building holds that cannot leave, and why (SK-1…SK-4, docs/design/stuck-stock.md).
 *
 * SK-1 reasons, checked in this order:
 *   "no_road"       — the building needs a road and has none.
 *   "no_carrier"    — understaffed, or the stock has piled up to four fifths of what the building can hold while a
 *                     receiver still has room (the carters cannot keep up: one carter per building at a time).
 *   "receiver_full" — no building that accepts the good has room.
 * SK-2 field wheat: ripe wheat a full barn could not take and winter spoiled (the BOT-4 harvest record's `lost`) is one
 *   "receiver_full" entry on the fullest farmstead barn, `source: "field"`.
 * SK-3 days: each building keeps the tick a good was first seen stuck (`stuckSinceTick`); `advanceStuckStock` updates it
 *   every `STUCK_STOCK_CHECK_TICKS`, so days are counted to that step.
 * SK-4 the list is derived and deterministic; lord mode's town agency reads it as a reason score (LM-E1).
 */
import { lordIntakeRules } from "./recovery";
import { BUILDING_CONFIG_BY_KIND, type Building, fieldOutputResource } from "../content/buildingConfig";
import { BALANCE } from "../content/balanceConfig";
import type { ResourceType, StorableResourceType } from "../content/resourceConfig";
import { isStorableResource } from "../content/resourceConfig";
import type { GameState } from "./engine.types";
import { buildingHasRequiredRoadAccess } from "./roadAccess";
import { acceptsResource, availableSpace, storageIntakeSpace } from "../economy/storage";

const TICKS_PER_DAY = BALANCE.TICKS_PER_YEAR / 360;
/** SK-3: how often the since-ticks are brought up to date (about nine days). */
export const STUCK_STOCK_CHECK_TICKS = 100;
/** SK-1: stock at this share (‰) of what the building holds counts as piled up. */
const PILED_UP_PERMILLE = 800;

export type StuckReason = "no_road" | "no_carrier" | "receiver_full";

export interface StuckStockEntry {
  readonly buildingId: string;
  readonly resource: ResourceType;
  readonly amount: number;
  /** Whole days stuck, counted from `stuckSinceTick` (0 before the first check saw it). */
  readonly days: number;
  readonly reason: StuckReason;
  /** SK-2: "field" is this year's ripe wheat spoiled for want of barn room; otherwise the building's own stock. */
  readonly source: "stock" | "field";
}

function hasReceiver(state: GameState, from: Building, resource: ResourceType): boolean {
  if (!isStorableResource(resource)) return false;
  for (const building of state.buildings) {
    if (building.id === from.id || !acceptsResource(building.kind, resource)) continue;
    if (storageIntakeSpace(building, resource as StorableResourceType, availableSpace(building, BUILDING_CONFIG_BY_KIND[building.kind]), lordIntakeRules(state)) > 0) return true;
  }
  return false;
}

function outputResource(building: Building): ResourceType | undefined {
  const definition = BUILDING_CONFIG_BY_KIND[building.kind];
  if (definition.production !== null) return definition.production.output;
  return fieldOutputResource(building) ?? definition.yardOutput;
}

/** What the building can hold of its output: the production hold limit, else its storage. */
function holding(building: Building): number {
  const definition = BUILDING_CONFIG_BY_KIND[building.kind];
  return definition.production?.outputHoldLimit ?? definition.storageCapacity;
}

function stuckReason(state: GameState, building: Building, resource: ResourceType, amount: number): StuckReason | null {
  const definition = BUILDING_CONFIG_BY_KIND[building.kind];
  if (definition.requiresRoad && !buildingHasRequiredRoadAccess(state, building)) return "no_road";
  const receiver = hasReceiver(state, building, resource);
  if (!receiver) return "receiver_full";
  if (definition.workersRequired > 0 && building.workers < definition.workersRequired) return "no_carrier";
  const limit = holding(building);
  return limit > 0 && amount * 1000 >= limit * PILED_UP_PERMILLE ? "no_carrier" : null;
}

function days(state: GameState, building: Building, resource: ResourceType): number {
  const since = building.stuckSinceTick?.[resource];
  return since === undefined ? 0 : Math.floor((state.tick - since) / TICKS_PER_DAY);
}

export function stuckStock(state: GameState): readonly StuckStockEntry[] {
  const result: StuckStockEntry[] = [];
  let fullestBarn: Building | null = null;
  for (const building of state.buildings) {
    const resource = outputResource(building);
    if (resource === undefined) continue;
    const amount = Math.max(0, building.inventory[resource] ?? 0);
    if (building.kind === "farmstead" && (fullestBarn === null || amount > (fullestBarn.inventory.wheat ?? 0))) fullestBarn = building;
    if (amount <= 0) continue;
    const reason = stuckReason(state, building, resource, amount);
    if (reason !== null) result.push({ buildingId: building.id, resource, amount, days: days(state, building, resource), reason, source: "stock" });
  }
  // SK-2: the spoiled field wheat of this year, or of the last recorded year before this year's winter, on the fullest barn.
  const record = state.harvestRecord;
  const lost = record === undefined ? 0 : record.lost > 0 ? record.lost : record.past.at(-1)?.lost ?? 0;
  if (fullestBarn !== null && lost > 0) {
    result.push({ buildingId: fullestBarn.id, resource: "wheat", amount: lost, days: 0, reason: "receiver_full", source: "field" });
  }
  return result;
}

/** SK-3: bring every building's since-ticks up to date — set on a newly stuck good, cleared once it moves. */
export function advanceStuckStock(state: GameState): GameState {
  if (state.tick % STUCK_STOCK_CHECK_TICKS !== 0) return state;
  const stuck = new Map<string, Set<ResourceType>>();
  for (const entry of stuckStock(state)) {
    if (entry.source !== "stock") continue;
    const set = stuck.get(entry.buildingId) ?? new Set<ResourceType>();
    set.add(entry.resource);
    stuck.set(entry.buildingId, set);
  }
  let changed = false;
  const buildings = state.buildings.map(building => {
    const now = stuck.get(building.id);
    const before = building.stuckSinceTick;
    if (now === undefined && before === undefined) return building;
    const next: Partial<Record<ResourceType, number>> = {};
    for (const resource of now ?? []) next[resource] = before?.[resource] ?? state.tick;
    const same = before !== undefined && Object.keys(next).length === Object.keys(before).length
      && Object.entries(next).every(([resource, tick]) => before[resource as ResourceType] === tick);
    if (same) return building;
    changed = true;
    if (Object.keys(next).length === 0) { const { stuckSinceTick: _dropped, ...rest } = building; return rest; }
    return { ...building, stuckSinceTick: next };
  });
  return changed ? { ...state, buildings } : state;
}
