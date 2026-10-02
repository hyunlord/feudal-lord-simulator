/**
 * LM-E6a (spec docs/design/trades.md TR-1, TR-2, TR-5): the market town's trades as data — twenty trades a household
 * may take up in lord mode, the twelve workshop archetypes their plots carry, the goods the trades pass between them
 * and the balance. Frequencies are the research's game calibration ranges (docs/research/2026-10-02-market-town-
 * trades-gpt.md), not counts from the tax rolls. Korean names are in trades.ko.ts.
 */
import type { ResourceType } from "./resourceConfig";

export const WORKSHOP_ARCHETYPES = [
  "front_shop", "back_workshop", "big_yard", "dirty_yard", "edge_stink_yard", "forge",
  "waterside", "water_mill", "warehouse_shop", "institution", "no_shop", "itinerant",
] as const;
export type WorkshopArchetype = (typeof WORKSHOP_ARCHETYPES)[number];

/** TR-2: what a house's plot must offer for the archetype (absent = nothing). */
export interface PlotNeed {
  /** A road beside the house. */
  readonly road?: true;
  /** Grass cells free of buildings, roads and zones within two cells of the house. */
  readonly freeCells?: number;
  /** A water cell within three cells. */
  readonly water?: true;
  /** A flowing-water (river) cell within three cells. */
  readonly flowingWater?: true;
  /** At least this far (cells) from the town's centre. */
  readonly edge?: number;
  /** A market within eight cells. */
  readonly market?: true;
  /** A church within six cells. */
  readonly church?: true;
}

export const WORKSHOP_PLOT: Readonly<Record<WorkshopArchetype, PlotNeed>> = {
  front_shop: { road: true },
  back_workshop: {},
  big_yard: { freeCells: 4 },
  dirty_yard: { freeCells: 3 },
  edge_stink_yard: { freeCells: 3, edge: 6 },
  forge: { road: true },
  waterside: { water: true },
  water_mill: { flowingWater: true },
  warehouse_shop: { road: true, market: true },
  institution: { church: true },
  no_shop: {},
  itinerant: {},
};

/** Goods the trades make and pass on (the trade layer's own; game resources are only read). */
export const TRADE_GOODS = [
  "meat", "hides", "leather", "shoes", "cloth", "fulled_cloth", "dyed_cloth", "garments",
  "iron", "tools", "barrels", "carts", "dyes", "wine", "spices", "smallwares",
] as const;
export type TradeGood = (typeof TRADE_GOODS)[number];

export const TRADE_CHAINS = ["grain", "ale", "meat_leather", "cloth", "metal", "wood", "commerce"] as const;
export type TradeChain = (typeof TRADE_CHAINS)[number];

/** TR-5: where an input comes from. `per` is the amount for one unit of output. */
export type TradeInput =
  | { readonly kind: "land"; readonly land: "pasture" | "woodland"; readonly per: number }
  | { readonly kind: "good"; readonly good: TradeGood; readonly per: number }
  /** A game resource the town holds (read, never taken): its share of `threshold` caps the trade's output. */
  | { readonly kind: "resource"; readonly resource: ResourceType; readonly threshold: number };

/** TR-3: the location score's items a trade counts, with its weight (permille; 1,000 = as computed). */
export type LocationFactor = "raw" | "customers" | "kin" | "water" | "road" | "plot" | "rent" | "nuisance" | "competition";

/** TR-1: when the trade may appear in a town. */
export interface TradeCondition {
  readonly building?: readonly string[];
  readonly trades?: Readonly<Partial<Record<TradeId, number>>>;
  readonly pastureCells?: number;
  readonly water?: true;
  readonly flowingWater?: true;
  readonly population?: number;
  readonly year?: number;
}

export const TRADE_IDS = [
  "baker", "brewer", "butcher", "miller", "innkeeper", "tailor", "weaver", "smith", "carpenter", "shoemaker", "carter", "merchant",
  "fuller", "dyer", "tanner", "cooper", "wheelwright", "mercer", "spicer", "vintner",
] as const;
export type TradeId = (typeof TRADE_IDS)[number];

export interface TradeDefinition {
  readonly id: TradeId;
  readonly core: boolean;
  readonly chain: TradeChain;
  readonly workshop: WorkshopArchetype;
  readonly inputs: readonly TradeInput[];
  /** Goods made per unit (absent = a service: the town's demand for it caps the output). */
  readonly outputs?: Readonly<Partial<Record<TradeGood, number>>>;
  /** Units a household makes in a full season. */
  readonly capacity: number;
  readonly factors: Readonly<Partial<Record<LocationFactor, number>>>;
  /** Spring, summer, autumn, winter (permille of capacity). */
  readonly seasons: readonly [number, number, number, number];
  readonly classBand: "labour" | "artisan" | "merchant";
  readonly guild: "food" | "leather" | "cloth" | "metal" | "wood" | "merchant" | "none";
  readonly condition: TradeCondition;
  /** Households per 1,000 people, and the research's range of households for a 500–2,000 town. */
  readonly perThousand: number;
  readonly min: number;
  readonly max: number;
  /** Trades that smell or burn: the nuisance item counts their crowded neighbours. */
  readonly nuisance?: "stink" | "fire";
}

const EVEN = [1000, 1000, 1000, 1000] as const;
const SOCIAL = { customers: 1000, road: 1000, rent: 1000, competition: 1000 } as const;

export const TRADES: readonly TradeDefinition[] = [
  { id: "baker", core: true, chain: "grain", workshop: "front_shop", inputs: [{ kind: "resource", resource: "bread", threshold: 40 }],
    capacity: 40, factors: { ...SOCIAL, kin: 1000, nuisance: 500 }, seasons: EVEN, classBand: "artisan", guild: "food",
    condition: { building: ["mill", "granary"] }, perThousand: 6, min: 1, max: 7, nuisance: "fire" },
  { id: "brewer", core: true, chain: "ale", workshop: "big_yard", inputs: [{ kind: "resource", resource: "wheat", threshold: 30 }],
    capacity: 40, factors: { ...SOCIAL, kin: 1000, water: 700, plot: 1000 }, seasons: [900, 900, 1200, 1000], classBand: "artisan", guild: "food",
    condition: {}, perThousand: 8, min: 1, max: 12 },
  { id: "butcher", core: true, chain: "meat_leather", workshop: "dirty_yard", inputs: [{ kind: "land", land: "pasture", per: 1 }],
    outputs: { meat: 1, hides: 1 }, capacity: 20, factors: { raw: 1000, customers: 1000, kin: 1000, plot: 1000, nuisance: 800, competition: 1000 },
    seasons: [900, 800, 1200, 1100], classBand: "artisan", guild: "food", condition: { building: ["farmstead", "market"] }, perThousand: 6, min: 1, max: 7, nuisance: "stink" },
  { id: "miller", core: true, chain: "grain", workshop: "water_mill", inputs: [{ kind: "resource", resource: "wheat", threshold: 60 }],
    capacity: 60, factors: { raw: 1000, road: 1000, kin: 1000, competition: 1000 }, seasons: [900, 800, 1300, 1000], classBand: "artisan", guild: "food",
    condition: { building: ["mill"] }, perThousand: 2, min: 1, max: 3 },
  { id: "innkeeper", core: true, chain: "commerce", workshop: "big_yard", inputs: [],
    capacity: 20, factors: { ...SOCIAL, kin: 700, plot: 1000 }, seasons: [1000, 1100, 1100, 800], classBand: "artisan", guild: "food",
    condition: { building: ["market"] }, perThousand: 4, min: 1, max: 6 },
  { id: "tailor", core: true, chain: "cloth", workshop: "front_shop", inputs: [{ kind: "good", good: "cloth", per: 1 }],
    outputs: { garments: 1 }, capacity: 12, factors: { ...SOCIAL, raw: 600, kin: 1000 }, seasons: EVEN, classBand: "artisan", guild: "cloth",
    condition: {}, perThousand: 6, min: 1, max: 10 },
  { id: "weaver", core: true, chain: "cloth", workshop: "back_workshop", inputs: [{ kind: "land", land: "pasture", per: 0.5 }],
    outputs: { cloth: 1 }, capacity: 16, factors: { raw: 1000, kin: 1200, competition: 500, rent: 700 }, seasons: [1000, 900, 1000, 1100],
    classBand: "artisan", guild: "cloth", condition: { pastureCells: 2 }, perThousand: 7, min: 1, max: 12 },
  { id: "smith", core: true, chain: "metal", workshop: "forge", inputs: [{ kind: "good", good: "iron", per: 1 }],
    outputs: { tools: 1 }, capacity: 10, factors: { ...SOCIAL, kin: 1000, nuisance: 800 }, seasons: EVEN, classBand: "artisan", guild: "metal",
    condition: {}, perThousand: 4, min: 1, max: 6, nuisance: "fire" },
  { id: "carpenter", core: true, chain: "wood", workshop: "big_yard", inputs: [{ kind: "resource", resource: "timber", threshold: 30 }],
    capacity: 20, factors: { raw: 1000, road: 1000, kin: 1000, plot: 1000, competition: 700 }, seasons: [1100, 1200, 1100, 600], classBand: "artisan", guild: "wood",
    condition: {}, perThousand: 3.7, min: 1, max: 7 },
  { id: "shoemaker", core: true, chain: "meat_leather", workshop: "front_shop", inputs: [{ kind: "good", good: "leather", per: 1 }],
    outputs: { shoes: 1 }, capacity: 12, factors: { ...SOCIAL, raw: 800, kin: 1000 }, seasons: EVEN, classBand: "artisan", guild: "leather",
    condition: {}, perThousand: 6, min: 1, max: 10 },
  { id: "carter", core: true, chain: "commerce", workshop: "big_yard", inputs: [],
    capacity: 20, factors: { road: 1200, raw: 800, plot: 1000, competition: 600 }, seasons: [1000, 1000, 1300, 700], classBand: "labour", guild: "none",
    condition: { building: ["storehouse", "market"] }, perThousand: 4, min: 1, max: 6 },
  { id: "merchant", core: true, chain: "commerce", workshop: "warehouse_shop", inputs: [],
    capacity: 20, factors: { ...SOCIAL, kin: 1000, plot: 1000 }, seasons: [1000, 1100, 1100, 800], classBand: "merchant", guild: "merchant",
    condition: { building: ["market"] }, perThousand: 5, min: 1, max: 12 },
  { id: "fuller", core: false, chain: "cloth", workshop: "water_mill", inputs: [{ kind: "good", good: "cloth", per: 1 }],
    outputs: { fulled_cloth: 1 }, capacity: 16, factors: { raw: 1000, water: 1200, kin: 1000, competition: 800 }, seasons: EVEN, classBand: "artisan", guild: "cloth",
    condition: { trades: { weaver: 1 }, flowingWater: true }, perThousand: 2, min: 0, max: 4 },
  { id: "dyer", core: false, chain: "cloth", workshop: "waterside", inputs: [{ kind: "good", good: "fulled_cloth", per: 1 }, { kind: "good", good: "dyes", per: 1 }],
    outputs: { dyed_cloth: 1 }, capacity: 12, factors: { raw: 1000, water: 1200, kin: 1000, nuisance: 800, competition: 800 }, seasons: EVEN, classBand: "artisan", guild: "cloth",
    condition: { trades: { fuller: 1, merchant: 1 }, water: true }, perThousand: 2, min: 0, max: 6, nuisance: "stink" },
  { id: "tanner", core: false, chain: "meat_leather", workshop: "edge_stink_yard",
    inputs: [{ kind: "good", good: "hides", per: 1 }, { kind: "land", land: "woodland", per: 1 }],
    outputs: { leather: 1 }, capacity: 16, factors: { raw: 1000, water: 1000, kin: 1000, plot: 1000, nuisance: 1000, competition: 800 },
    seasons: [1000, 1100, 1000, 900], classBand: "artisan", guild: "leather", condition: { trades: { butcher: 1 }, water: true }, perThousand: 2.5, min: 0, max: 4, nuisance: "stink" },
  { id: "cooper", core: false, chain: "wood", workshop: "big_yard", inputs: [{ kind: "resource", resource: "timber", threshold: 20 }, { kind: "good", good: "iron", per: 0.2 }],
    outputs: { barrels: 1 }, capacity: 10, factors: { customers: 800, raw: 1000, kin: 1000, plot: 1000, competition: 800 }, seasons: [900, 900, 1300, 900],
    classBand: "artisan", guild: "wood", condition: { trades: { brewer: 2 } }, perThousand: 2, min: 0, max: 4 },
  { id: "wheelwright", core: false, chain: "wood", workshop: "big_yard", inputs: [{ kind: "resource", resource: "timber", threshold: 20 }, { kind: "good", good: "iron", per: 0.5 }],
    outputs: { carts: 1 }, capacity: 4, factors: { road: 1000, raw: 1000, kin: 1000, plot: 1000, competition: 800 }, seasons: [1100, 1200, 1100, 600],
    classBand: "artisan", guild: "wood", condition: { trades: { carter: 1, smith: 1 } }, perThousand: 1.5, min: 0, max: 3 },
  { id: "mercer", core: false, chain: "commerce", workshop: "front_shop", inputs: [{ kind: "good", good: "smallwares", per: 1 }],
    capacity: 10, factors: { ...SOCIAL, kin: 1000 }, seasons: EVEN, classBand: "merchant", guild: "merchant",
    condition: { building: ["market"], population: 300 }, perThousand: 2, min: 0, max: 3 },
  { id: "spicer", core: false, chain: "commerce", workshop: "front_shop", inputs: [{ kind: "good", good: "spices", per: 1 }],
    capacity: 6, factors: { ...SOCIAL, kin: 1000 }, seasons: EVEN, classBand: "merchant", guild: "merchant",
    condition: { trades: { merchant: 2 }, population: 400 }, perThousand: 1, min: 0, max: 2 },
  { id: "vintner", core: false, chain: "commerce", workshop: "warehouse_shop", inputs: [{ kind: "good", good: "wine", per: 1 }],
    capacity: 8, factors: { ...SOCIAL, kin: 1000, plot: 1000 }, seasons: [900, 1100, 1100, 900], classBand: "merchant", guild: "merchant",
    condition: { trades: { merchant: 1, innkeeper: 1 } }, perThousand: 1, min: 0, max: 2 },
];

export const TRADE_BY_ID: ReadonlyMap<TradeId, TradeDefinition> = new Map(TRADES.map(trade => [trade.id, trade]));

/** TR-5: what the town buys each season, per 100 people (final goods) — services are bought the same way. */
export const TOWN_DEMAND_PER_HUNDRED: Readonly<Partial<Record<TradeGood | TradeId, number>>> = {
  meat: 24, shoes: 5, garments: 5, tools: 3, barrels: 2, carts: 0.4, wine: 1.5, spices: 0.8, smallwares: 3,
  baker: 40, brewer: 40, miller: 30, innkeeper: 8, carpenter: 8, carter: 8, merchant: 10,
};

/** TR-5: what the merchants carry out of town each season, per merchant household (the cloth trade's market). */
export const EXPORT_PER_MERCHANT: Readonly<Partial<Record<TradeGood, number>>> = { cloth: 4, fulled_cloth: 8, dyed_cloth: 8, leather: 2 };

/** TR-5: goods the merchants bring in each season — a small trickle with none, more per merchant household. */
export const IMPORTS: Readonly<Partial<Record<TradeGood, { readonly base: number; readonly perMerchant: number }>>> = {
  iron: { base: 4, perMerchant: 8 }, dyes: { base: 0, perMerchant: 8 }, wine: { base: 0, perMerchant: 6 },
  spices: { base: 0, perMerchant: 3 }, smallwares: { base: 0, perMerchant: 6 }, leather: { base: 2, perMerchant: 2 }, cloth: { base: 2, perMerchant: 3 },
};

export const TRADE_BALANCE = {
  /** TR-4: households that choose a trade each season at most. */
  choicesPerSeason: 2,
  /** TR-4: seasons of no output before a household gives up its trade. */
  idleSeasonsToQuit: 4,
  /** TR-5: land supply per cell per season (pasture → livestock, woodland and forest → bark). */
  pastureLivestockPerCell: 0.6,
  /** TR-5: livestock a farmstead's beasts give, and the drovers bring to a market, each season. */
  farmsteadLivestock: 3,
  marketLivestock: 12,
  woodlandBarkPerCell: 0.25,
  /** TR-5: woodland counts within this many cells of the town's centre. */
  woodlandRadius: 14,
  /** TR-5: a final good's stock above this many seasons of demand holds production back. */
  demandStockSeasons: 2,
  /** TR-7: loads a carter household moves per stuck-stock check, and a load (the game's carter load). With a market,
   *  the load the carters have left carries surplus no building can take out of town to sell. */
  carterLoadsPerCheck: 1,
  carterLoad: 8,
  /** TR-8: households of one trade, each within this many cells of another, that make a street. */
  streetHouseholds: 3,
  streetLink: 3,
  /** TR-3 radii (cells). */
  rawRadius: 8,
  customerRadius: 6,
  competitionRadius: 8,
  crowdRadius: 3,
} as const;
