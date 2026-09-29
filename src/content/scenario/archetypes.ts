/**
 * ARCH-1 map archetypes (spec docs/design/map-archetypes.md AR-1…AR-8): the same 150 years on five kinds of land.
 * The riverside market town is the open field unchanged (its generator, its rules, its id `core:open_field`, so every
 * save and the guardrail keep it); the four new lands move the generator's thresholds, add a sea, and differ in their
 * rules by five coefficients only (AR-4). Art keys are Wave 22 (ground, bands, decals), Wave 28 (field edges) and
 * Wave 29 (water movement), all confirmed in `assets-inbox/`.
 */
import type { ArchetypeDef } from "./types";

/** AR-1: the open field is the riverside market town — every coefficient 1,000. */
export const RIVERSIDE_ARCHETYPE_ID = "core:open_field";
export const COASTAL_ARCHETYPE_ID = "core:coastal_port";
export const DOWNS_ARCHETYPE_ID = "core:chalk_downs";
export const WOODLAND_ARCHETYPE_ID = "core:forest_edge";
export const FEN_ARCHETYPE_ID = "core:fen_drainage";

const RIVER_WATER = ["water/current_arrows_ne_sheet", "water/current_arrows_nw_sheet", "water/current_arrows_se_sheet",
  "water/current_arrows_sw_sheet", "water/ripple_sheet", "water/sparkle", "water/fish_ring", "water/ice_edge"] as const;

export const MAP_ARCHETYPES: readonly ArchetypeDef[] = [
  {
    // F2-A (WR-5, decision WR2): the open-field town stands at a tidal river's mouth — the war's raiders reach it.
    id: RIVERSIDE_ARCHETYPE_ID, resourcePackage: {}, coastal: true,
    terrain: { kind: "river" },
    ground: { fill: "grass", decals: [], decalPermille: 0, fieldBoundary: "hedgerow", water: RIVER_WATER },
    resources: { timber: "normal", stone: "normal", clay: "normal", fish: "normal" },
    rules: { arablePermille: 1000, pastoralPermille: 1000, timberPermille: 1000, floodPermille: 1000, coastalEventPermille: 1000 },
  },
  {
    // AR-1 ②: a harbour on a sea edge — sand, shingle and salt marsh; the raid of 1337 and the port's fever strike hardest.
    id: COASTAL_ARCHETYPE_ID, resourcePackage: {}, coastal: true,
    terrain: { kind: "coast", shares: { water: 30, rock: 30, forest: 120 }, detailPermille: 300, sea: { minDepth: 8, maxDepth: 15 } },
    ground: { fill: "coastal_grass", edge: "coastal", decalPermille: 60, fieldBoundary: "hedgerow",
      decals: ["decals/coastal_sand_a", "decals/coastal_sand_b", "decals/coastal_sand_c", "props/driftwood_a", "props/driftwood_b", "props/rock_pool"],
      water: ["water/shore_foam_sheet", "water/ripple_sheet", "water/sparkle", "water/fish_ring", "water/ice_edge"] },
    resources: { timber: "scarce", stone: "normal", clay: "normal", fish: "rich" },
    rules: { arablePermille: 950, pastoralPermille: 1000, timberPermille: 900, floodPermille: 1000, coastalEventPermille: 1200 },
  },
  {
    // AR-1 ③: the chalk downs — short turf, white chalk, dry-stone folds; sheep thrive, the plough less, water is scarce.
    id: DOWNS_ARCHETYPE_ID, resourcePackage: {},
    terrain: { kind: "downs", shares: { water: 12, rock: 110, forest: 70 }, detailPermille: 400 },
    ground: { fill: "chalk_down", patchFill: "heath", edge: "chalk", decalPermille: 90, fieldBoundary: "dry_stone_wall",
      decals: ["decals/chalk_exposure_a", "decals/chalk_exposure_b", "decals/chalk_exposure_c", "props/chalk_outcrop_a", "props/chalk_outcrop_b",
        "props/chalk_outcrop_c", "props/sheep_stone_wall_a", "props/sheep_stone_wall_b", "decals/heath_patch_a", "props/gorse_a", "props/gorse_b"],
      water: ["water/ripple_sheet", "water/sparkle", "water/ice_edge"] },
    resources: { timber: "scarce", stone: "rich", clay: "scarce", fish: "scarce" },
    rules: { arablePermille: 850, pastoralPermille: 1300, timberPermille: 900, floodPermille: 600, coastalEventPermille: 1000 },
  },
  {
    // AR-1 ④: the forest's edge — leaf litter and fallen trees; timber comes fast, the fields are won by felling.
    id: WOODLAND_ARCHETYPE_ID, resourcePackage: {},
    terrain: { kind: "woodland", shares: { water: 50, rock: 20, forest: 560 }, detailPermille: 250 },
    ground: { fill: "woodland_floor", decalPermille: 80, fieldBoundary: "hedgerow",
      decals: ["decals/woodland_litter_a", "decals/woodland_litter_b", "decals/woodland_litter_c", "props/fallen_tree", "props/mushrooms",
        "props/fern_bush_a", "props/fern_bush_b", "props/fern_bush_c"],
      water: ["water/ripple_sheet", "water/sparkle", "water/fish_ring", "water/ice_edge"] },
    resources: { timber: "rich", stone: "normal", clay: "normal", fish: "normal" },
    rules: { arablePermille: 900, pastoralPermille: 900, timberPermille: 1300, floodPermille: 1000, coastalEventPermille: 1000 },
  },
  {
    // AR-1 ⑤: the fen — wet meadow, reed beds, meres; the drained ground is the richest, and a wet summer floods it.
    id: FEN_ARCHETYPE_ID, resourcePackage: {},
    terrain: { kind: "fen", shares: { water: 330, rock: 5, forest: 70 }, detailPermille: 600 },
    ground: { fill: "fen", edge: "fen", decalPermille: 90, fieldBoundary: "hedgerow",
      decals: ["decals/fen_pool_a", "decals/fen_pool_b", "decals/fen_pool_c", "props/reed_clump_a", "props/reed_clump_b", "props/reed_clump_c",
        "props/fen_puddle_a", "props/fen_puddle_b"],
      water: ["water/reeds_sway_a_sheet", "water/reeds_sway_b_sheet", "water/reeds_sway_c_sheet", "water/ripple_shallow_sheet", "water/fish_ring", "water/ice_edge"] },
    resources: { timber: "scarce", stone: "scarce", clay: "rich", fish: "rich" },
    rules: { arablePermille: 1150, pastoralPermille: 1100, timberPermille: 800, floodPermille: 2500, coastalEventPermille: 1000 },
  },
];

/** AR-6: the order the start screen offers the lands (the riverside town first, as today). */
export const MAP_ARCHETYPE_IDS = MAP_ARCHETYPES.map(archetype => archetype.id);
