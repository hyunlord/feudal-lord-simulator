import type { SemanticPaletteName } from "./palette";

/**
 * RES-REG: every resource of the game, one line each. `ResourceType`, the storable list, the store kind of each good
 * and every lookup the screens make (colour, cart load, icon, carrier, ledger order) come from here, so a new good is
 * one line in this list and one in `resourceCatalog.ko.ts`: nothing else has to change for the game to type-check and
 * draw it (a good with no picture yet gets the generic sack or crate and its name).
 *
 * The order is the order of every list the player sees (build costs, stock lines) and of the engine's loops over
 * goods; `hudPriority` orders the ledger drawer's stock rows.
 */
export type ResourceStorage = "granary" | "storehouse" | "none";
/** 식량 · 원자재 · 가공품 · 음료 · 돈 (C4, E9.5: the ledger's five groups). */
export type ResourceGroup = "food" | "raw" | "goods" | "drink" | "money";
/** Who carries it on the roads (the walker's look): a farmer, a logger, a quarryman or the coin collector. */
export type ResourceCarrier = "farmer" | "logger" | "quarryman" | "coin_carter";
/** The Wave 7 cart load (`cart_load_<key>_<axis>`). */
export type ResourceCartLoadKey = "log" | "timber" | "rawstone" | "stone" | "grainsack" | "bread";
/** The F0-V Wave 6 pile that stands in for the cart load while the Wave 7 art loads. */
export type ResourceCartPileKey = "pile_wood_1" | "pile_stone_1";
/** A cell of the UX-2 resource sheet (24 px). */
export type ResourceSheetCell = "bread" | "timber" | "stone" | "coin";
/**
 * The cells of the Wave 3 resource chain sheet (`icon_resource_chain_sheet`, ten 96 px cells in one row), in sheet order
 * (assets-inbox/wave3/candidates-20260926/records/icons-sources.json: the ale chain's three, then the cloth chain's).
 */
export const RESOURCE_CHAIN_SHEET_CELLS = ["barley", "malt", "ale", "fleece", "yarn", "raw_cloth", "fulled_cloth", "dyed_cloth", "finished_cloth", "dyes"] as const;
export type ResourceChainCell = (typeof RESOURCE_CHAIN_SHEET_CELLS)[number];

export type ResourceEntry = {
  readonly id: string;
  readonly storage: ResourceStorage;
  readonly group: ResourceGroup;
  /** Row order in the ledger drawer's stock table (lower first). */
  readonly hudPriority: number;
  readonly carrier: ResourceCarrier;
  /** The Wave 7 cart load; none: the generic sacks (granary goods) or crates (storehouse goods). */
  readonly cartLoadKey?: ResourceCartLoadKey;
  readonly cartPileKey?: ResourceCartPileKey;
  /**
   * The resource-sheet cell the HUD draws (24 px, and 16 px on the bar's second line); none: the generic sack or crate
   * and the name chip (ASSET-2: the old runtime-icons-v1 pictures are retired).
   */
  readonly sheetCell?: ResourceSheetCell;
  /** INSTALL-3: the Wave 3 chain sheet cell the screens draw, for a good the UX-2 sheet does not paint. */
  readonly chainCell?: ResourceChainCell;
  /** The sheet cell drawn over a walker carrying it at the close zoom (goods the cart does not show). */
  readonly cargoIconCell?: ResourceSheetCell;
  /** The colour token (`SEMANTIC_PALETTE`) of the cargo square below the composed-walker zoom. */
  readonly color: SemanticPaletteName;
  /** Cart-load factor (1 = a sack's worth per unit). Not read yet: the carters carry by count; C4 decides. */
  readonly bulk: number;
};

export const RESOURCE_CATALOG = [
  { id: "wheat", storage: "granary", group: "food", hudPriority: 1, carrier: "farmer", cartLoadKey: "grainsack", cargoIconCell: "bread", color: "gold", bulk: 1 },
  { id: "bread", storage: "granary", group: "food", hudPriority: 2, carrier: "farmer", cartLoadKey: "bread", sheetCell: "bread", cargoIconCell: "bread", color: "earth", bulk: 1 },
  { id: "logs", storage: "storehouse", group: "raw", hudPriority: 3, carrier: "logger", cartLoadKey: "log", cartPileKey: "pile_wood_1", color: "forest", bulk: 1 },
  { id: "timber", storage: "storehouse", group: "goods", hudPriority: 4, carrier: "logger", cartLoadKey: "timber", cartPileKey: "pile_wood_1", sheetCell: "timber", color: "earthDark", bulk: 1 },
  { id: "stone_raw", storage: "storehouse", group: "raw", hudPriority: 5, carrier: "quarryman", cartLoadKey: "rawstone", cartPileKey: "pile_stone_1", color: "stoneDark", bulk: 1 },
  { id: "stone", storage: "storehouse", group: "goods", hudPriority: 6, carrier: "quarryman", cartLoadKey: "stone", cartPileKey: "pile_stone_1", sheetCell: "stone", color: "stone", bulk: 1 },
  // C4 the ale chain: barley from the fields, malt from the kiln, ale brewed in the households (no hops before 1400s).
  { id: "barley", storage: "granary", group: "raw", hudPriority: 7, carrier: "farmer", cartLoadKey: "grainsack", chainCell: "barley", color: "goldDark", bulk: 1 },
  { id: "malt", storage: "granary", group: "goods", hudPriority: 8, carrier: "farmer", cartLoadKey: "grainsack", chainCell: "malt", color: "earth", bulk: 1 },
  { id: "ale", storage: "storehouse", group: "drink", hudPriority: 9, carrier: "farmer", chainCell: "ale", color: "earthDark", bulk: 1 },
  { id: "coin", storage: "none", group: "money", hudPriority: 10, carrier: "coin_carter", sheetCell: "coin", cargoIconCell: "coin", color: "gold", bulk: 1 },
] as const satisfies readonly ResourceEntry[];

type CatalogLine = (typeof RESOURCE_CATALOG)[number];
export type ResourceType = CatalogLine["id"];
export type StorableResourceType = Extract<CatalogLine, { readonly storage: "granary" | "storehouse" }>["id"];
export type StorageKind = Exclude<ResourceStorage, "none">;
/** A number per good (stock totals, ledgers): built by walking `RESOURCE_TYPES`, never written out by hand. */
export type ResourceTotals = { [K in ResourceType]: number };

const BY_ID: ReadonlyMap<ResourceType, ResourceEntry> = new Map(RESOURCE_CATALOG.map(entry => [entry.id, entry]));

export const RESOURCE_TYPES: readonly ResourceType[] = RESOURCE_CATALOG.map(entry => entry.id);

export function isStorableResource(resource: ResourceType): resource is StorableResourceType {
  return resourceEntry(resource).storage !== "none";
}

export const STORABLE_RESOURCE_TYPES: readonly StorableResourceType[] = RESOURCE_TYPES.filter(isStorableResource);

export const STORAGE_KIND_BY_RESOURCE = Object.fromEntries(
  STORABLE_RESOURCE_TYPES.map(resource => [resource, resourceEntry(resource).storage]),
) as { readonly [K in StorableResourceType]: StorageKind };

export function resourceEntry(resource: ResourceType): ResourceEntry {
  const entry = BY_ID.get(resource);
  if (entry === undefined) throw new Error(`Unknown resource ${String(resource)}`);
  return entry;
}

/** Zero of every good. */
export function emptyResourceTotals(): ResourceTotals {
  return Object.fromEntries(RESOURCE_TYPES.map(resource => [resource, 0])) as ResourceTotals;
}
