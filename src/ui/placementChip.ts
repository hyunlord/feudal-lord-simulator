import { BUILDING_CONFIG_BY_KIND, type BuildingKind } from "../content/buildingConfig";
import { RESOURCE_TYPES, type ResourceType } from "../content/resourceConfig";
import type { GameState } from "../engine/engine.types";
import { placementSpendableResource } from "../world/placement";
import { blockingReasons, type TileMark } from "../render/placementTileMarks";
import { RESOURCE_NAMES } from "./hud/hudCopy.ko";
import { PLACEMENT_CHIP_COPY } from "./placementChipCopy.ko";

// UX-3 S-53 / S-54 / S-55: the chip beside the placement cursor replaces the resource bar for the one decision at
// hand. Line 1 the building and its cost; line 2 the ledger (cost / spendable stock / what is left — spendable as
// placement counts it, so it matches the verdict); line 3 the one most important reason it cannot go here (+N more),
// or, for a building with a service range, how many houses it reaches. The engine refuses a placement it cannot pay
// for (insufficient_materials), so a shortfall says "배치 불가" rather than "공사장 대기 예상".
export type PlacementChip = {
  readonly title: string;
  readonly ledger: readonly { readonly text: string; readonly short: boolean }[];
  readonly reason: string | null;
  readonly reach: string | null;
  /** UI-3: what the building does to the ledger each period (rent, upkeep, labour), null when all are zero. */
  readonly period: string | null;
};

type ChipInput = {
  readonly tool: BuildingKind | "road";
  readonly marks?: readonly TileMark[];
  /** Road: the path's timber cost. */
  readonly timberCost?: number | null;
  /** Road: the engine's reason label when the path fails. */
  readonly failureLabel?: string | null;
  /** Houses inside the service range (null: no range). */
  readonly reachHouses: number | null;
  /** UI-3: the engine's placement ledger prediction (predictPlacementLedger) for a building. */
  readonly ledger?: { readonly rentPerPeriod: number; readonly upkeepPerPeriod: number; readonly labourDemand: number };
};

export function placementChipModel(state: GameState, input: ChipInput): PlacementChip {
  const cost: Partial<Record<ResourceType, number>> = input.tool === "road"
    ? ((input.timberCost ?? 0) > 0 ? { timber: input.timberCost ?? 0 } : {})
    : BUILDING_CONFIG_BY_KIND[input.tool].buildCost;
  const items = RESOURCE_TYPES.filter(resource => (cost[resource] ?? 0) > 0).slice(0, 3);
  const name = input.tool === "road" ? PLACEMENT_CHIP_COPY.road : BUILDING_CONFIG_BY_KIND[input.tool].name;
  const costLabel = items.length === 0 ? PLACEMENT_CHIP_COPY.free
    : items.map(resource => PLACEMENT_CHIP_COPY.cost(RESOURCE_NAMES[resource], cost[resource] ?? 0)).join(PLACEMENT_CHIP_COPY.costJoin);
  const ledger = items.map(resource => {
    const need = cost[resource] ?? 0, stock = placementSpendableResource(state, resource);
    return stock >= need ? { text: PLACEMENT_CHIP_COPY.ledger(RESOURCE_NAMES[resource], need, stock), short: false }
      : { text: PLACEMENT_CHIP_COPY.ledgerShort(RESOURCE_NAMES[resource], need, stock), short: true };
  });
  const reasons = blockingReasons(input.marks ?? []).filter(entry => entry.reason !== "materials" || !ledger.some(line => line.short));
  const first = reasons[0];
  const reason = first !== undefined
    ? PLACEMENT_CHIP_COPY.reasons[first.reason](first.count) + (reasons.length > 1 ? PLACEMENT_CHIP_COPY.more(reasons.length - 1) : "")
    : input.failureLabel ?? null;
  const parts = input.ledger === undefined ? [] : [
    ...(input.ledger.rentPerPeriod > 0 ? [PLACEMENT_CHIP_COPY.rent(input.ledger.rentPerPeriod)] : []),
    ...(input.ledger.upkeepPerPeriod > 0 ? [PLACEMENT_CHIP_COPY.upkeep(input.ledger.upkeepPerPeriod)] : []),
    ...(input.ledger.labourDemand > 0 ? [PLACEMENT_CHIP_COPY.labour(input.ledger.labourDemand)] : []),
  ];
  return { title: PLACEMENT_CHIP_COPY.title(name, costLabel), ledger, reason,
    reach: input.reachHouses === null ? null : PLACEMENT_CHIP_COPY.reach(input.reachHouses),
    period: parts.length === 0 ? null : PLACEMENT_CHIP_COPY.period(parts) };
}
