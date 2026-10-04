import { BARN_BACKLOG_STOCK } from "../../agents/deliveryBuildingCandidates";
import { BUILDING_CONFIG_BY_KIND, type Building, type BuildingKind } from "../../content/buildingConfig";
import { isStorableResource, type ResourceType } from "../../content/resourceConfig";
import type { GameState } from "../../engine/engine.types";
import { stuckStock, type StuckReason } from "../../engine/stuckStock";
import { acceptsResource, storageIntakeUsage } from "../../economy/storage";
import { buildingFootprint } from "../../geometry/buildingFootprint";
import type { TileCoordinate } from "../../world/grid";

// LM-R1 (playtest 2026-10-02 #2): the HUD's stuck goods are the engine's own list (FIX-11 `stuckStock`: no road, no
// carrier, every receiver full), not a screen-side guess. A pile whose receivers are all full names the store it would
// go to — the nearest building that takes the good — with its fullness (창고 200/200), so the player can go from the
// sawmill straight to that store.
//
// What the HUD raises (`hudStuckRows`): a pile with no road and a pile whose receivers are all full at once — each is the
// state's own fact; a pile the carters do not keep up with (`no_carrier`, which the engine also gives an understaffed
// barn holding three sacks) only once it is a pile (the barn backlog, or two fifths of a smaller building's room) and
// has stood a month (the UI-AUDIT-1 chip's own window). The engine's field entry (this year's harvest lost behind a full
// barn, SK-2) is not stock that sits and can be freed: the food breakdown reports it, not the "묶임" chip.

export type StuckStore = Readonly<{ id: string; kind: BuildingKind; used: number; capacity: number }>;

export type StuckRow = Readonly<{
  buildingId: string;
  kind: BuildingKind;
  good: ResourceType;
  amount: number;
  /** Whole days the engine has seen it stuck. */
  days: number;
  reason: StuckReason;
  /** "field": this year's ripe wheat the full barn could not take (spoiled). */
  source: "stock" | "field";
  /** The building's footprint centre (camera `lookAt`). */
  tile: TileCoordinate;
  /** `receiver_full`: the nearest building that takes the good, all of them full; otherwise null. */
  store: StuckStore | null;
}>;

function footprintCentre(building: Building): TileCoordinate {
  const size = buildingFootprint(building);
  return { tx: building.tx + Math.floor((size.width - 1) / 2), ty: building.ty + Math.floor((size.height - 1) / 2) };
}

/** The receiver a full pile waits on: the nearest other building that takes `good` (grid distance between corners), with
 * the fullness that binds that good there. */
export function nearestReceiver(state: GameState, from: Building, good: ResourceType): StuckStore | null {
  let best: Building | null = null;
  let bestDistance = Infinity;
  for (const building of state.buildings) {
    if (building.id === from.id || !acceptsResource(building.kind, good)) continue;
    const distance = Math.abs(building.tx - from.tx) + Math.abs(building.ty - from.ty);
    if (distance < bestDistance || (distance === bestDistance && best !== null && building.id < best.id)) { best = building; bestDistance = distance; }
  }
  if (best === null || !isStorableResource(good)) return null;
  // The room that binds this good (a granary's wheat, a storehouse's raw goods, take half its room): 곡창 100/100.
  const usage = storageIntakeUsage(best, good);
  // Goods already on their way in count as used (the store takes no more); shown at most full (not 203/200).
  return { id: best.id, kind: best.kind, used: Math.min(usage.capacity, Math.floor(usage.used)), capacity: usage.capacity };
}

/** The engine's stuck stock as the HUD shows it, the largest pile first (ties by building id). */
export function stuckRows(state: GameState): readonly StuckRow[] {
  const byId = new Map(state.buildings.map(building => [building.id, building]));
  return stuckStock(state).flatMap((entry): StuckRow[] => {
    const building = byId.get(entry.buildingId);
    if (building === undefined) return [];
    return [{ buildingId: entry.buildingId, kind: building.kind, good: entry.resource, amount: Math.floor(entry.amount), days: entry.days,
      reason: entry.reason, source: entry.source, tile: footprintCentre(building),
      // A field entry's receivers were full at the harvest; their room now says nothing about it.
      store: entry.reason === "receiver_full" && entry.source === "stock" ? nearestReceiver(state, building, entry.resource) : null }];
  }).filter(row => row.amount > 0).sort((a, b) => b.amount - a.amount || a.buildingId.localeCompare(b.buildingId));
}

/** `no_carrier` piles the HUD raises: at least this many days stuck (the UI-AUDIT-1 still window, about 32 days). */
export const HUD_STUCK_MIN_DAYS = 32;
/** …and at least the barn backlog (LB-15), or this share of a smaller building's room. */
export const HUD_STUCK_MIN_SHARE_PERMILLE = 400;

function pileThreshold(kind: BuildingKind): number {
  const definition = BUILDING_CONFIG_BY_KIND[kind];
  const room = definition.production?.outputHoldLimit ?? definition.storageCapacity;
  return Math.max(1, Math.min(BARN_BACKLOG_STOCK, Math.floor(room * HUD_STUCK_MIN_SHARE_PERMILLE / 1000)));
}

/** The engine's piles the HUD raises (the chip, the inspector's "왜?"), largest first; no field entry. */
export function hudStuckRows(state: GameState): readonly StuckRow[] {
  return stuckRows(state).filter(row => row.source === "stock" && (row.reason !== "no_carrier"
    || (row.days >= HUD_STUCK_MIN_DAYS && row.amount >= pileThreshold(row.kind))));
}

/** SK-2: this year's ripe wheat lost behind a full barn (the engine's field entry), or 0. */
export function lostHarvest(state: GameState): number {
  return stuckStock(state).filter(entry => entry.source === "field").reduce((sum, entry) => sum + Math.floor(entry.amount), 0);
}
