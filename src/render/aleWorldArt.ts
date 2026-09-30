import type { Walker } from "../agents/walker.types";
import type { Building } from "../content/buildingConfig";
import type { ResourceType } from "../content/resourceConfig";
import { ALE_BALANCE } from "../content/aleConfig";
import { brewingSlot, isAlehouse } from "../engine/ale";
import { acceptsResource } from "../economy/storage";
import type { GameState } from "../engine/engine.types";
import type { House } from "../population/population.types";
import { variantRandom } from "./buildingVariants";
import { stockPileLevel } from "./stockPiles";
import type { Wave3AleKey } from "./wave3AleArt";

// INSTALL-3 the ale chain on the map (Wave 3): the pure choices of which picture shows what the engine holds (C4,
// docs/design/ale-chain.md). Read from the state, nothing stored. The strips' choice is drawArableFields' `fieldStripArt`,
// the kiln's painting historicalFacilityAssets' `variants` pick.

/** The alehouse painting's variant stream (Wave 2 visual variants use salts 0-2, the facility variants 7). */
const ALEHOUSE_SALT = 8;

/** Ale in the house's brewing slot (AL-4), 0 when it does not brew. */
export function houseAle(house: Pick<House, "crafts">): number {
  return brewingSlot(house)?.stock.ale ?? 0;
}

/**
 * AL-5 on the map: an alehouse (isAlehouse) with ale in its slot hangs out the ale-stake — Wave 3's alehouse a / b, the
 * house L2 painting (same 137 px canvas and pivot) with the bush on its pole, fixed per plot by the world seed. Only a
 * single-lot house drawn at level 2 has such a painting; a level 3+ or pair-lot alehouse keeps its own (the barrels at
 * its door still show the brewing). No ale, no stake: the order's rule (the engine keeps the house an alehouse while it
 * brews, sold out or not).
 */
export function alehouseArt(state: Pick<GameState, "seed">, building: Pick<Building, "kind" | "tx" | "ty" | "houseLot">,
  house: House | undefined, builtLevel: number): "alehouse_a" | "alehouse_b" | null {
  if (house === undefined || building.houseLot !== undefined || builtLevel !== 2 || !isAlehouse(house) || houseAle(house) <= 0) return null;
  return variantRandom(state.seed, building, ALEHOUSE_SALT) < 0.5 ? "alehouse_a" : "alehouse_b";
}

/** The ale barrels at a brewing house's door, by the ale in its slot against the slot's cap (8): 1 from the first cask, 2 from 3, 3 from 6. */
export function aleBarrelPile(house: Pick<House, "crafts">): Wave3AleKey | null {
  if (brewingSlot(house) === null) return null;
  const level = stockPileLevel(houseAle(house), ALE_BALANCE.slotAleCap);
  return level === 0 ? null : `ale_barrels_${level}`;
}

/**
 * The Wave 3 piles at a building's door, the Wave 7 stock piles' thresholds (stockPileLevel against the building's
 * storage capacity, as its wheat sacks): barley sacks at a barn by its barley (capacity 1000), malt sacks at the kiln
 * by its malt (capacity 40). UI-10 (FIX-8, decision FX8-1): malt's store is the storehouse (the rules' `acceptsResource`),
 * its sacks there by its malt against the share of the room malt may take (a quarter of 200); a granary shows none.
 */
export function aleStockPile(building: Pick<Building, "kind" | "inventory">, capacity: number): Wave3AleKey | null {
  const store = building.kind !== "malt_kiln" && acceptsResource(building.kind, "malt");
  const resource = building.kind === "farmstead" ? "barley" : building.kind === "malt_kiln" || store ? "malt" : null;
  if (resource === null) return null;
  const room = store ? Math.floor(capacity * ALE_BALANCE.maltStorePermille / 1000) : capacity;
  const level = stockPileLevel(building.inventory[resource] ?? 0, room);
  return level === 0 ? null : resource === "barley" ? `barley_sacks_${level}` : `malt_sacks_${level}`;
}

const CART_LOADS: Readonly<Partial<Record<ResourceType, "barley" | "malt" | "ale_barrels">>> = { barley: "barley", malt: "malt", ale: "ale_barrels" };

/** A cart's Wave 3 load for the ale chain's goods, by the cart's axis as the Wave 7 loads (NE / SW: `_ne`, SE / NW: `_nw`). */
export function aleCartLoad(resource: ResourceType, direction: string): Wave3AleKey | null {
  const load = CART_LOADS[resource];
  if (load === undefined) return null;
  return `cart_load_${load}_${direction === "NE" || direction === "SW" ? "ne" : "nw"}`;
}

/**
 * The ale chain's workers (Wave 3 reskins, band "ale"): the alewife on a brewing house's malt errand, the maltster on
 * the kiln's commute (presentation trips, residentTrips.ts) and driving the kiln's carts (barley in, malt out).
 */
export function aleWorkerSheet(state: Pick<GameState, "buildings">, walker: Walker): "wk_alewife" | "wk_maltster" | null {
  const resident = (walker as { readonly resident?: { readonly occupation: string } }).resident;
  if (resident !== undefined) return resident.occupation === "alewife" ? "wk_alewife" : resident.occupation === "maltster" ? "wk_maltster" : null;
  if (walker.kind !== "carter") return null;
  return state.buildings.find(building => building.id === walker.homeBuildingId)?.kind === "malt_kiln" ? "wk_maltster" : null;
}
