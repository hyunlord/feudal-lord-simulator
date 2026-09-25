import { LABOUR_BALANCE } from "../content/balanceConfig";
import { CRAFT_DEFINITIONS, type CraftDefinition } from "../content/crafts/craftDefinitions";
import type { House, HouseholdSlot } from "./population.types";

const EMPTY_SLOT: HouseholdSlot = { craftId: null, workers: 0, input: {}, output: {}, stock: {} };

/** LB-8: household production slots of a house level (L0 0 · L1 1 · L2 1 · L3 2 · L4 2). */
export function householdSlotCount(level: number): number {
  return LABOUR_BALANCE.householdSlotsByLevel[Math.max(0, Math.min(4, Math.floor(level)))] ?? 0;
}

/** LB-8: every slot of a house; stored crafts fill their index, the rest are empty. */
export function householdSlots(house: Pick<House, "level" | "crafts">): readonly HouseholdSlot[] {
  return Array.from({ length: householdSlotCount(house.level) }, (_, index) => house.crafts?.[index] ?? EMPTY_SLOT);
}

/** LB-4 tier 9: adults the household's product slots ask for (0 until C4 adds a craft). */
export function householdSlotDemand(house: Pick<House, "level" | "crafts">): number {
  return householdSlots(house).reduce((total, slot) => total + (slot.craftId === null ? 0 : Math.max(0, slot.workers)), 0);
}

export function craftDefinition(craftId: string | null, crafts: readonly CraftDefinition[] = CRAFT_DEFINITIONS): CraftDefinition | null {
  return craftId === null ? null : crafts.find(craft => craft.id === craftId) ?? null;
}

export type ProcessDeliveryTarget = { readonly kind: "house"; readonly houseId: string } | { readonly kind: "market"; readonly buildingId: string };
export interface ProcessDelivery {
  readonly fromHouseId: string;
  readonly slotIndex: number;
  readonly to: ProcessDeliveryTarget;
  readonly resource: string;
  readonly amount: number;
}

/**
 * LB-8 `공정 배달`: the one way a household's own stock leaves the house — to a neighbour's slot (next process step)
 * or to a market. Moves at most what the slot holds; a house target must have a slot of that index taking the
 * resource as input. Returns the houses unchanged when nothing can move. The market side is C4's (its stall stock).
 */
export function processDelivery(houses: readonly House[], delivery: ProcessDelivery): { readonly houses: readonly House[]; readonly moved: number } {
  const fromIndex = houses.findIndex(house => house.buildingId === delivery.fromHouseId);
  const from = houses[fromIndex];
  const slot = from?.crafts?.[delivery.slotIndex];
  const held = slot?.stock[delivery.resource] ?? 0;
  const amount = Math.min(Math.max(0, Math.floor(delivery.amount)), held);
  if (from === undefined || slot === undefined || amount === 0) return { houses, moved: 0 };
  const take = (target: HouseholdSlot, resource: string, change: number): HouseholdSlot => {
    const next = (target.stock[resource] ?? 0) + change;
    const { [resource]: _old, ...rest } = target.stock;
    return { ...target, stock: next === 0 ? rest : { ...rest, [resource]: next } };
  };
  const withSlot = (house: House, index: number, next: HouseholdSlot): House => {
    const crafts = [...(house.crafts ?? [])];
    crafts[index] = next;
    return { ...house, crafts };
  };
  const next = [...houses];
  if (delivery.to.kind === "house") {
    const targetHouseId = delivery.to.houseId;
    const toIndex = houses.findIndex(house => house.buildingId === targetHouseId);
    const target = houses[toIndex];
    const targetSlot = target?.crafts?.[delivery.slotIndex];
    if (target === undefined || toIndex === fromIndex || targetSlot === undefined || !(delivery.resource in targetSlot.input)) {
      return { houses, moved: 0 };
    }
    next[toIndex] = withSlot(target, delivery.slotIndex, take(targetSlot, delivery.resource, amount));
  }
  next[fromIndex] = withSlot(from, delivery.slotIndex, take(slot, delivery.resource, -amount));
  return { houses: next, moved: amount };
}
