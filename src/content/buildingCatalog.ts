import type { BuildingKind } from "./buildingConfig";
import type { SemanticPaletteName } from "./palette";

/**
 * BLD-REG: every building kind the screens and the map know, one line each — its place in the build menu, its glyph
 * and thumbnail, the picture the map draws and the way it is built, the fire it keeps. The rules (size, cost, workers,
 * production) stay the engine's (`buildingConfig.ts`); its words are one line in `buildingCatalog.ko.ts`. Every table
 * the UI and the renderer used to keep per building comes from here, so a new building is the engine's rules line and
 * these two lines: a kind without a picture yet draws a plain timber body the size of its footprint with its name, and
 * the menu shows its category's glyph.
 *
 * The table is keyed by the engine's `BuildingKind`, so a kind the engine adds and this list lacks fails the type check
 * right here, and a key the engine does not know fails too. Line order is the build menu's order within a group.
 */

/** The UX-1 build menu's six categories: 생활 · 길 · 생업 · 저장·유통 · 공공·신앙 · 방어. */
export type BuildMenuCategory = "living" | "paths" | "trade" | "storage" | "public" | "defense";
/** The build menu model's four groups (the tool list, the placement card). */
export type BuildToolGroup = "dwelling" | "production" | "storage" | "service";
/** The 24 px build glyphs (`BuildGlyph.tsx`, by glyph key). */
export type BuildGlyphKey = "house" | "well" | "storehouse" | "granary" | "chapel" | "farmstead" | "wheat_farm" | "mill" | "logging_camp"
  | "sawmill" | "quarry" | "masonry" | "market" | "church" | "keep" | "road";
/** Cells of the UX-2 building icon sheet the build menu and the construction sign use. */
export type BuildingIconCell = "hut" | "well" | "barn" | "windmill" | "granary" | "warehouse" | "chapel" | "market" | "road" | "field";
/** The Wave 11 construction kits (`constructionKits.ts`, by kit key). */
export type ConstructionKitKey = "timber_small" | "timber_medium" | "stone_medium" | "stone_large" | "public_church" | "public_keep";
/** The procedural details `drawBuildingDetails.ts` paints over a body (by part). */
export type BuildingDetailPart = "house" | "well_rim" | "crates" | "stilts" | "flag" | "flag_when_working" | "field_rows" | "wheel"
  | "logging_rack" | "saw" | "planks" | "door";
/** The overlay a placement tool turns on while it is held (UX-3 S-51). */
export type PlacementOverlay = "water";
/** The household service a building gives its neighbours (the placement card's coverage line). */
export type BuildingService = "water" | "market" | "church";

/** The coloured block the map draws for a kind (and under its picture while that loads): its size and roof. */
export type BuildingBody = {
  readonly width: number;
  readonly height: number;
  readonly roof: number;
  readonly fill: SemanticPaletteName;
  readonly roofColor: SemanticPaletteName;
  readonly roofShape: "none" | "flat" | "dome" | "cone" | "shed" | "tower";
};

/**
 * The historical facility picture (`historicalFacilityManifest`): one id, or a quiet and an active one chosen by the
 * market's trade (`market`) or the building's production (`working`) — Wave 12's active states.
 */
export type FacilityArt = { readonly id: string } | { readonly quiet: string; readonly active: string; readonly activeWhen: "market" | "working" }
  /** One of these per building, fixed by its id's hash (INSTALL-3: the malt kiln's two paintings). */
  | { readonly variants: readonly string[] }
  /** INSTALL-C5: season-dependent picture (spring / summer / winter; autumn falls back to summer). */
  | { readonly seasonal: { readonly spring: string; readonly summer: string; readonly winter: string } };
/** Cells of the Wave 3 building chain icon sheet (INSTALL-3), for a kind the UX-2 sheet has no cell for. */
export type ChainBuildingIconCell = "malt_kiln" | "woolhouse" | "weaver_house" | "fulling_mill" | "dyehouse";
export type SignIcon = BuildingIconCell | { readonly chain: ChainBuildingIconCell };

export type BuildingCatalogEntry = {
  readonly category: BuildMenuCategory;
  readonly group: BuildToolGroup;
  /** The build glyph; none: the category's (`CATEGORY_GLYPH`). */
  readonly glyph?: BuildGlyphKey;
  /**
   * The build menu thumbnail: the first house picture, the kind's facility picture, or an early building file under
   * `public/assets/buildings/`; none: the menu icon or the glyph.
   */
  readonly thumbnail?: "house" | "facility" | { readonly file: string };
  /** The icon the menu shows when there is no thumbnail. */
  readonly menuIcon?: BuildingIconCell;
  /** The construction sign's icon (F0-V): a UX-2 sheet cell, or a Wave 3 chain sheet cell. */
  readonly signIcon?: SignIcon;
  /** The runtime sprite key when it is not the kind (houses by level are the renderer's). */
  readonly spriteKey?: string;
  readonly facilityArt?: FacilityArt;
  /** The Wave 11 kit its site is drawn with; none: the common four-stage art. */
  readonly kit?: ConstructionKitKey;
  /** The block body; none: a plain timber body the size of its footprint. */
  readonly body?: BuildingBody;
  readonly details?: readonly BuildingDetailPart[];
  /** The smoke it gives: a house's hearth, or a working fire while it works (the mill's oven). */
  readonly smoke?: "hearth" | "work_fire";
  readonly placementOverlay?: PlacementOverlay;
  readonly service?: BuildingService;
};

export const BUILDING_CATALOG = {
  house: { category: "living", group: "dwelling", glyph: "house", thumbnail: "house", signIcon: "hut", kit: "timber_small", details: ["house"], smoke: "hearth" },
  well: { category: "living", group: "service", glyph: "well", thumbnail: { file: "well" }, signIcon: "well", placementOverlay: "water", service: "water",
    body: { width: 26, height: 12, roof: 0, fill: "stoneDark", roofColor: "stone", roofShape: "none" }, details: ["well_rim"] },
  storehouse: { category: "storage", group: "storage", glyph: "storehouse", thumbnail: { file: "storehouse" }, signIcon: "warehouse", kit: "stone_large",
    body: { width: 64, height: 30, roof: 6, fill: "parchmentDark", roofColor: "earthDark", roofShape: "flat" }, details: ["crates"] },
  granary: { category: "storage", group: "storage", glyph: "granary", thumbnail: { file: "barn" }, signIcon: "granary", spriteKey: "barn", kit: "stone_large",
    body: { width: 58, height: 32, roof: 16, fill: "parchment", roofColor: "goldDark", roofShape: "dome" }, details: ["stilts"] },
  chapel: { category: "public", group: "service", glyph: "chapel", thumbnail: "facility", signIcon: "chapel", facilityArt: { id: "chapel" }, kit: "stone_medium",
    body: { width: 42, height: 48, roof: 18, fill: "parchment", roofColor: "earthDark", roofShape: "cone" }, details: ["flag"] },
  wheat_farm: { category: "trade", group: "production", glyph: "wheat_farm",
    body: { width: 72, height: 10, roof: 0, fill: "earth", roofColor: "gold", roofShape: "none" }, details: ["field_rows"] },
  farmstead: { category: "trade", group: "production", glyph: "farmstead", menuIcon: "barn", signIcon: "barn", kit: "timber_medium",
    body: { width: 40, height: 24, roof: 12, fill: "earth", roofColor: "earthDark", roofShape: "shed" } },
  mill: { category: "trade", group: "production", glyph: "mill", thumbnail: "facility", signIcon: "windmill", facilityArt: { id: "mill" }, kit: "timber_medium",
    body: { width: 38, height: 62, roof: 24, fill: "parchmentDark", roofColor: "earthDark", roofShape: "cone" }, details: ["wheel", "flag_when_working"], smoke: "work_fire" },
  logging_camp: { category: "trade", group: "production", glyph: "logging_camp", thumbnail: { file: "logging_camp" }, kit: "timber_small",
    body: { width: 38, height: 20, roof: 12, fill: "earth", roofColor: "forest", roofShape: "shed" }, details: ["logging_rack"] },
  sawmill: { category: "trade", group: "production", glyph: "sawmill", thumbnail: "facility", facilityArt: { id: "sawmill" }, kit: "timber_medium",
    body: { width: 66, height: 32, roof: 14, fill: "parchmentDark", roofColor: "earthDark", roofShape: "shed" }, details: ["saw", "planks"] },
  quarry: { category: "trade", group: "production", glyph: "quarry", thumbnail: "facility", facilityArt: { quiet: "quarry_idle", active: "quarry_active", activeWhen: "working" },
    body: { width: 74, height: 18, roof: 0, fill: "stoneDark", roofColor: "stone", roofShape: "none" }, details: ["crates"] },
  masonry: { category: "trade", group: "production", glyph: "masonry", thumbnail: "facility", facilityArt: { id: "masonry" }, kit: "stone_medium",
    body: { width: 44, height: 28, roof: 10, fill: "stone", roofColor: "earthDark", roofShape: "shed" }, details: ["crates"] },
  market: { category: "storage", group: "service", glyph: "market", thumbnail: "facility", signIcon: "market", service: "market",
    facilityArt: { quiet: "market_quiet", active: "market_active", activeWhen: "market" },
    body: { width: 66, height: 34, roof: 12, fill: "parchment", roofColor: "goldDark", roofShape: "flat" }, details: ["crates"] },
  church: { category: "public", group: "service", glyph: "church", thumbnail: "facility", signIcon: "chapel", service: "church", facilityArt: { id: "church" }, kit: "public_church",
    body: { width: 78, height: 92, roof: 34, fill: "parchment", roofColor: "stoneDark", roofShape: "cone" }, details: ["flag", "door"] },
  keep: { category: "defense", group: "service", glyph: "keep", thumbnail: "facility", facilityArt: { id: "keep" }, kit: "public_keep",
    body: { width: 86, height: 116, roof: 44, fill: "stone", roofColor: "stoneDark", roofShape: "tower" }, details: ["door"] },
  // C4 (decision AL6) the mill's glyph and a cone-roofed body (the far zooms); INSTALL-3: Wave 3's kiln a / b, its
  // flue smoking while it malts (the working-fire exception to the no-chimney rule), the chain sheet's kiln on its sign.
  malt_kiln: { category: "trade", group: "production", glyph: "mill", thumbnail: "facility", signIcon: { chain: "malt_kiln" },
    facilityArt: { variants: ["malthouse_a", "malthouse_b"] }, smoke: "work_fire",
    body: { width: 52, height: 34, roof: 18, fill: "parchmentDark", roofColor: "earthDark", roofShape: "cone" } },
  // C5 (CL-2…CL-7) the cloth chain: INSTALL-C5 adds Wave 3 / Wave 2 paintings (the pastoral farm: Wave 2's
  // farm_pastoral, spring / summer / winter; the other buildings: Wave 3's Astra sprites, variants by plot).
  pastoral_farm: { category: "trade", group: "production", glyph: "farmstead", thumbnail: "facility", signIcon: { chain: "woolhouse" }, kit: "timber_medium",
    facilityArt: { seasonal: { spring: "farm_pastoral_spring", summer: "farm_pastoral_summer", winter: "farm_pastoral_winter" } },
    body: { width: 56, height: 22, roof: 12, fill: "earth", roofColor: "earthDark", roofShape: "shed" } },
  weaver_house: { category: "trade", group: "production", glyph: "house", thumbnail: "facility", signIcon: { chain: "weaver_house" }, kit: "timber_small",
    facilityArt: { variants: ["weaver_house_a", "weaver_house_b"] },
    body: { width: 36, height: 30, roof: 14, fill: "parchmentDark", roofColor: "earthDark", roofShape: "shed" } },
  fulling_mill: { category: "trade", group: "production", glyph: "mill", thumbnail: "facility", signIcon: { chain: "fulling_mill" }, kit: "timber_medium",
    facilityArt: { variants: ["fulling_mill_nesw", "fulling_mill_nwse"] },
    body: { width: 60, height: 40, roof: 16, fill: "parchmentDark", roofColor: "earthDark", roofShape: "shed" }, details: ["wheel"] },
  dyehouse: { category: "trade", group: "production", glyph: "sawmill", thumbnail: "facility", signIcon: { chain: "dyehouse" }, kit: "timber_medium",
    facilityArt: { variants: ["dyehouse_a", "dyehouse_b"] },
    body: { width: 54, height: 28, roof: 12, fill: "parchment", roofColor: "earthDark", roofShape: "shed" }, smoke: "work_fire" },
  tenter_yard: { category: "trade", group: "production", glyph: "wheat_farm", thumbnail: "facility",
    facilityArt: { quiet: "tenter_frames_a", active: "tenter_frames_dyed", activeWhen: "working" },
    body: { width: 84, height: 12, roof: 0, fill: "earth", roofColor: "parchment", roofShape: "none" }, details: ["field_rows"] },
} as const satisfies { readonly [K in BuildingKind]: BuildingCatalogEntry };

/** The glyph of a category, for a kind that has none of its own. */
export const CATEGORY_GLYPH: { readonly [C in BuildMenuCategory]: BuildGlyphKey } = {
  living: "house", paths: "road", trade: "farmstead", storage: "storehouse", public: "chapel", defense: "keep",
};

/** Every kind in the list's order (the build menu's order within a group). */
export const CATALOG_BUILDING_KINDS = Object.keys(BUILDING_CATALOG) as readonly BuildingKind[];

export function buildingEntry(kind: BuildingKind): BuildingCatalogEntry {
  const entry: BuildingCatalogEntry | undefined = (BUILDING_CATALOG as { readonly [K in BuildingKind]: BuildingCatalogEntry })[kind];
  if (entry === undefined) throw new Error(`Unknown building ${String(kind)}`);
  return entry;
}

/** The glyph the menu draws for a kind: its own, else its category's. */
export const buildingGlyph = (kind: BuildingKind): BuildGlyphKey => buildingEntry(kind).glyph ?? CATEGORY_GLYPH[buildingEntry(kind).category];

/** The runtime sprite key of a kind that is not a house (houses are keyed by level). */
export const buildingSpriteKeyOf = (kind: BuildingKind): string => buildingEntry(kind).spriteKey ?? kind;
