import type { Building } from "../content/buildingConfig";
import { spinningSlot } from "../engine/cloth";
import type { House } from "../population/population.types";
import type { ResourceType } from "../content/resourceConfig";
import { stockPileLevel } from "./stockPiles";
import type { Wave3ClothKey } from "./wave3ClothArt";

// CLOTH-UI the cloth chain on the map (Wave 3 + Wave 2 pastoral): the pure choices of which picture
// shows what the engine holds (C5, docs/design/cloth-chain.md). Read from the state, nothing stored.
// Building facilityArt (weaver house, fulling mill, dyehouse, tenter yard, pastoral farm) is handled by
// historicalFacilityAssets.ts; this module covers stock piles, cart loads and the pastoral farm's
// backyard (spin_yarn is already mapped to the weaver yard in backyardConfig.ts).

// Cloth resources to pile base, in display-priority order (the first resource found with stock wins).
const CLOTH_PILE: ReadonlyArray<readonly [ResourceType, "fleece_heap" | "yarn_skeins" | "cloth_bolts_raw"]> = [
  ["fleece", "fleece_heap"],
  ["yarn", "yarn_skeins"],
  ["raw_cloth", "cloth_bolts_raw"],
  ["fulled_cloth", "cloth_bolts_raw"],
  ["dyed_cloth", "cloth_bolts_raw"],
  ["finished_cloth", "cloth_bolts_raw"],
];

/**
 * The Wave 3 cloth pile at a cloth building's door, by the first cloth resource in its inventory that
 * meets the level threshold (stockPileLevel against the building's storage capacity).
 * Returns null when the building holds no cloth resource at a displayable level.
 */
export function clothStockPile(building: Pick<Building, "inventory">, capacity: number): Wave3ClothKey | null {
  for (const [resource, base] of CLOTH_PILE) {
    const amount = building.inventory[resource] ?? 0;
    const level = stockPileLevel(amount, capacity);
    if (level !== 0) return `${base}_${level}` as Wave3ClothKey;
  }
  return null;
}

/**
 * CLOTH-UI (CL-4): a house that has taken up spinning in its second slot shows yarn skeins at its door. The engine
 * spins in batches (a fleece fetched, spun and carried off in one step every 400 ticks), so the slot itself is empty
 * nearly always: the skeins stand for the trade while it lasts. The Wave 27 weaver's yard (backyardConfig
 * `spin_yarn`) needs two free back cells, which a street house rarely has (2 of the replay town's 24 spinning houses).
 */
export function spinningPile(house: Pick<House, "crafts">): Wave3ClothKey | null {
  return spinningSlot(house) === null ? null : "yarn_skeins_1";
}

const CLOTH_CART: Readonly<Partial<Record<ResourceType, "wool_bales" | "cloth_raw" | "cloth_dyed">>> = {
  fleece: "wool_bales",
  // Yarn travels in the raw-cloth load (no dedicated cart load art for yarn skeins).
  yarn: "cloth_raw",
  raw_cloth: "cloth_raw",
  fulled_cloth: "cloth_raw",
  dyed_cloth: "cloth_dyed",
  finished_cloth: "cloth_dyed",
};

/** A cart's Wave 3 load for the cloth chain's goods, by the cart's axis (NE / SW: `_ne`, SE / NW: `_nw`). */
export function clothCartLoad(resource: ResourceType, direction: string): Wave3ClothKey | null {
  const load = CLOTH_CART[resource];
  if (load === undefined) return null;
  return `cart_load_${load}_${direction === "NE" || direction === "SW" ? "ne" : "nw"}` as Wave3ClothKey;
}
