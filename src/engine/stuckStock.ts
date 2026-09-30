/**
 * FIX-11 (15): stuck-stock detection — resources that have been in a building but cannot be delivered.
 * Returns a snapshot; call at most once per render frame or once per diagnostic request.
 *
 * Reasons:
 *   "no_road"       — the building requires road access but has none (routing cut off).
 *   "no_carrier"    — the building is understaffed; no worker can cart the good out.
 *   "receiver_full" — all destinations that accept this resource are at capacity.
 *
 * The `days` field uses `building.stuckSinceTick` when set, otherwise 0 (see Building.stuckSinceTick).
 *
 * BOT-4 context: a farmstead's harvest record showed "lost wheat"; that wheat sits in the farmstead's
 * inventory while the granary is full — this surfaces as `reason: "receiver_full"`.
 */
import { BUILDING_CONFIG_BY_KIND, type Building, fieldOutputResource } from "../content/buildingConfig";
import { BALANCE } from "../content/balanceConfig";
import type { ResourceType, StorableResourceType } from "../content/resourceConfig";
import { isStorableResource } from "../content/resourceConfig";
import type { GameState } from "./engine.types";
import { buildingHasRequiredRoadAccess } from "./roadAccess";
import { acceptsResource, availableSpace, storageIntakeSpace } from "../economy/storage";

const TICKS_PER_DAY = BALANCE.TICKS_PER_YEAR / 360;

export type StuckReason = "no_road" | "no_carrier" | "receiver_full";

export interface StuckStockEntry {
  readonly buildingId: string;
  readonly resource: ResourceType;
  readonly amount: number;
  /** Whole days the resource has been stuck. 0 when `stuckSinceTick` is not yet set on the building. */
  readonly days: number;
  readonly reason: StuckReason;
}

/** Returns true when at least one accepting building has room for `resource`. */
function hasReceiver(buildings: readonly Building[], resource: ResourceType): boolean {
  if (!isStorableResource(resource)) return false;
  for (const b of buildings) {
    if (!acceptsResource(b.kind, resource)) continue;
    const def = BUILDING_CONFIG_BY_KIND[b.kind];
    if (storageIntakeSpace(b, resource as StorableResourceType, availableSpace(b, def)) > 0) return true;
  }
  return false;
}

/** The primary output resource of a building, if any (production, field, or yard). */
function outputResource(building: Building): ResourceType | undefined {
  const def = BUILDING_CONFIG_BY_KIND[building.kind];
  if (def.production !== null) return def.production.output;
  const field = fieldOutputResource(building);
  if (field !== undefined) return field;
  return def.yardOutput;
}

export function stuckStock(state: GameState): readonly StuckStockEntry[] {
  const result: StuckStockEntry[] = [];

  for (const building of state.buildings) {
    const def = BUILDING_CONFIG_BY_KIND[building.kind];
    const resource = outputResource(building);
    if (resource === undefined) continue;

    const amount = Math.max(0, building.inventory[resource] ?? 0);
    if (amount <= 0) continue;

    const sinceTick = building.stuckSinceTick?.[resource];
    const days = sinceTick !== undefined ? Math.floor((state.tick - sinceTick) / TICKS_PER_DAY) : 0;

    // "no_road": building requires road but road access is missing.
    if (def.requiresRoad && !buildingHasRequiredRoadAccess(state, building)) {
      result.push({ buildingId: building.id, resource, amount, days, reason: "no_road" });
      continue;
    }

    // "no_carrier": building is understaffed — nobody to cart the output.
    if (def.workersRequired > 0 && building.workers < def.workersRequired) {
      result.push({ buildingId: building.id, resource, amount, days, reason: "no_carrier" });
      continue;
    }

    // "receiver_full": stock is present, building is operable, but no accepting building has room.
    if (!hasReceiver(state.buildings, resource)) {
      result.push({ buildingId: building.id, resource, amount, days, reason: "receiver_full" });
    }
  }

  return result;
}
