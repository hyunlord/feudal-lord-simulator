// Zone and yard surface art (Astra Wave 4 pilot, installed by C1b; Wave 4b variants, field strips, croft beds and
// hurdles, installed by C1e; provenance rows in docs/provenance/assets.csv, candidates kept in assets-inbox/).
// Roles (ASSET_PIPELINE_SPEC_v1 1):
//  - fill: world-aligned 256x128 textures (2x2 tiles at 128 source px per tile), one variant per zone.
//  - strip: 512x64 top-down textures repeated along x (4 tiles long, 0.5 tile across at 128 px per tile).
//  - decal: flat isometric pieces drawn into the ground chunks; `displayWidth` is the screen width at zoom 1 and
//    (anchorX, anchorY) the source point that sits on the anchor.
//  - prop / module: object-pass sprites, bottom-centre anchored at (anchorX, anchorY) (source px).
// The apple tree c is scaled to the existing orchard tree (phase16-landscape/orchard.png, 113 px canopy at
// displayWidth 40): its 240 px canopy of 256 px also comes to 40 px (displayWidth 43), and the Wave 4b trees keep that
// scale. Haycocks c-f keep the pilot pair's scale (a 30, b 26 px for the same 128 px sheet): 28.
export const ZONE_ASSETS = [
  { "key": "pasture_fill", "url": "assets/zones/pasture_a-v1.png", "width": 256, "height": 128, "role": "fill" },
  { "key": "pasture_fill_b", "url": "assets/zones/pasture_b-v1.png", "width": 256, "height": 128, "role": "fill" },
  { "key": "pasture_fill_c", "url": "assets/zones/pasture_c-v1.png", "width": 256, "height": 128, "role": "fill" },
  { "key": "orchard_floor_fill", "url": "assets/zones/orchard_floor_a-v1.png", "width": 256, "height": 128, "role": "fill" },
  { "key": "orchard_floor_fill_b", "url": "assets/zones/orchard_floor_b-v1.png", "width": 256, "height": 128, "role": "fill" },
  { "key": "soil_a", "url": "assets/fields/soil_a-v1.png", "width": 256, "height": 128, "role": "fill" },
  { "key": "soil_b", "url": "assets/fields/soil_b-v1.png", "width": 256, "height": 128, "role": "fill" },
  { "key": "ridge_ploughed_a", "url": "assets/fields/ridge_ploughed_a-v1.png", "width": 512, "height": 64, "role": "strip" },
  { "key": "ridge_ploughed_b", "url": "assets/fields/ridge_ploughed_b-v1.png", "width": 512, "height": 64, "role": "strip" },
  { "key": "ridge_seedling_a", "url": "assets/fields/ridge_seedling_a-v1.png", "width": 512, "height": 64, "role": "strip" },
  { "key": "ridge_seedling_b", "url": "assets/fields/ridge_seedling_b-v1.png", "width": 512, "height": 64, "role": "strip" },
  { "key": "ridge_growing_a", "url": "assets/fields/ridge_growing_a-v1.png", "width": 512, "height": 64, "role": "strip" },
  { "key": "ridge_growing_b", "url": "assets/fields/ridge_growing_b-v1.png", "width": 512, "height": 64, "role": "strip" },
  { "key": "ridge_fallow_a", "url": "assets/fields/ridge_fallow_a-v1.png", "width": 512, "height": 64, "role": "strip" },
  { "key": "ridge_fallow_b", "url": "assets/fields/ridge_fallow_b-v1.png", "width": 512, "height": 64, "role": "strip" },
  // Furrow stamps run along the tile y axis, 1.4 tiles at 128 px per tile; the anchor is the middle of the stroke.
  { "key": "furrow_stamp_a", "url": "assets/fields/furrow_stamp_a-v1.png", "width": 128, "height": 64, "role": "decal", "displayWidth": 64, "anchorX": 64, "anchorY": 32 },
  { "key": "furrow_stamp_b", "url": "assets/fields/furrow_stamp_b-v1.png", "width": 128, "height": 64, "role": "decal", "displayWidth": 64, "anchorX": 64, "anchorY": 32 },
  { "key": "furrow_stamp_c", "url": "assets/fields/furrow_stamp_c-v1.png", "width": 128, "height": 64, "role": "decal", "displayWidth": 64, "anchorX": 64, "anchorY": 32 },
  { "key": "furrow_stamp_d", "url": "assets/fields/furrow_stamp_d-v1.png", "width": 128, "height": 64, "role": "decal", "displayWidth": 64, "anchorX": 64, "anchorY": 32 },
  // Croft beds: 1.08 x 0.83 tiles at full size (long side along +x); drawn at 0.55 so one fits a 0.5-tile back yard.
  { "key": "croft_bed_a", "url": "assets/yards/croft_bed_a-v1.png", "width": 128, "height": 96, "role": "decal", "displayWidth": 35, "anchorX": 64, "anchorY": 54 },
  { "key": "croft_bed_b", "url": "assets/yards/croft_bed_b-v1.png", "width": 128, "height": 96, "role": "decal", "displayWidth": 35, "anchorX": 64, "anchorY": 54 },
  { "key": "croft_bed_c", "url": "assets/yards/croft_bed_c-v1.png", "width": 128, "height": 96, "role": "decal", "displayWidth": 35, "anchorX": 64, "anchorY": 54 },
  { "key": "haycock_a", "url": "assets/zones/haycock_a-v1.png", "width": 128, "height": 128, "role": "prop", "displayWidth": 30, "anchorX": 64, "anchorY": 120 },
  { "key": "haycock_b", "url": "assets/zones/haycock_b-v1.png", "width": 128, "height": 128, "role": "prop", "displayWidth": 26, "anchorX": 64, "anchorY": 120 },
  { "key": "haycock_c", "url": "assets/zones/haycock_c-v1.png", "width": 128, "height": 128, "role": "prop", "displayWidth": 28, "anchorX": 64, "anchorY": 120 },
  { "key": "haycock_d", "url": "assets/zones/haycock_d-v1.png", "width": 128, "height": 128, "role": "prop", "displayWidth": 28, "anchorX": 64, "anchorY": 120 },
  { "key": "haycock_e", "url": "assets/zones/haycock_e-v1.png", "width": 128, "height": 128, "role": "prop", "displayWidth": 28, "anchorX": 64, "anchorY": 120 },
  { "key": "haycock_f", "url": "assets/zones/haycock_f-v1.png", "width": 128, "height": 128, "role": "prop", "displayWidth": 28, "anchorX": 64, "anchorY": 120 },
  { "key": "orchard_apple_c", "url": "assets/zones/orchard_apple_c-v1.png", "width": 256, "height": 256, "role": "prop", "displayWidth": 43, "anchorX": 128, "anchorY": 246 },
  { "key": "orchard_apple_d", "url": "assets/zones/orchard_apple_d-v1.png", "width": 256, "height": 256, "role": "prop", "displayWidth": 43, "anchorX": 123, "anchorY": 246 },
  { "key": "orchard_pear_e", "url": "assets/zones/orchard_pear_e-v1.png", "width": 256, "height": 256, "role": "prop", "displayWidth": 43, "anchorX": 123, "anchorY": 246 },
  { "key": "orchard_plum_f", "url": "assets/zones/orchard_plum_f-v1.png", "width": 256, "height": 256, "role": "prop", "displayWidth": 43, "anchorX": 141, "anchorY": 246 },
  // Hurdles (sockets on the post feet): the straight panel runs one tile along -y from (32, 59) to (96, 27); the
  // corner covers the north vertex of a yard, (2, 87) -> (64, 55) -> (126, 87). Mirrored, the straight runs along +x.
  { "key": "hurdle_straight", "url": "assets/yards/hurdle_straight-v1.png", "width": 128, "height": 64, "role": "module", "displayWidth": 64, "anchorX": 32, "anchorY": 59 },
  { "key": "hurdle_end_corner", "url": "assets/yards/hurdle_end_corner-v1.png", "width": 128, "height": 96, "role": "module", "displayWidth": 64, "anchorX": 64, "anchorY": 55 },
  // Wave 4c (C1f): hurdle gate (the straight panel's frame and sockets), half panel (sockets (16, 55) -> (51, 39) = half
  // a tile along -y), corners at the east (vertex foot (67, 59), arms to (3, 27) / (3, 91)), south ((64, 63), arms to
  // (0, 31) / (128, 31)) and west ((61, 59), arms to (125, 27) / (125, 91)) vertices, anchored on the vertex post;
  // four more orchard trees (the Wave 4b scale); stubble ridges for harvested strips; farm animal props.
  { "key": "hurdle_gate", "url": "assets/yards/hurdle_gate-v1.png", "width": 128, "height": 64, "role": "module", "displayWidth": 64, "anchorX": 32, "anchorY": 59 },
  { "key": "hurdle_half", "url": "assets/yards/hurdle_half-v1.png", "width": 64, "height": 64, "role": "module", "displayWidth": 32, "anchorX": 16, "anchorY": 55 },
  { "key": "hurdle_corner_e", "url": "assets/yards/hurdle_corner_e-v1.png", "width": 128, "height": 96, "role": "module", "displayWidth": 64, "anchorX": 67, "anchorY": 59 },
  { "key": "hurdle_corner_s", "url": "assets/yards/hurdle_corner_s-v1.png", "width": 128, "height": 96, "role": "module", "displayWidth": 64, "anchorX": 64, "anchorY": 63 },
  { "key": "hurdle_corner_w", "url": "assets/yards/hurdle_corner_w-v1.png", "width": 128, "height": 96, "role": "module", "displayWidth": 64, "anchorX": 61, "anchorY": 59 },
  { "key": "orchard_apple_g", "url": "assets/zones/orchard_apple_g-v1.png", "width": 256, "height": 256, "role": "prop", "displayWidth": 43, "anchorX": 128, "anchorY": 242 },
  { "key": "orchard_apple_h", "url": "assets/zones/orchard_apple_h-v1.png", "width": 256, "height": 256, "role": "prop", "displayWidth": 43, "anchorX": 128, "anchorY": 242 },
  { "key": "orchard_pear_i", "url": "assets/zones/orchard_pear_i-v1.png", "width": 256, "height": 256, "role": "prop", "displayWidth": 43, "anchorX": 128, "anchorY": 242 },
  { "key": "orchard_plum_j", "url": "assets/zones/orchard_plum_j-v1.png", "width": 256, "height": 256, "role": "prop", "displayWidth": 43, "anchorX": 128, "anchorY": 242 },
  { "key": "ridge_stubble_a", "url": "assets/fields/ridge_stubble_a-v1.png", "width": 512, "height": 64, "role": "strip" },
  { "key": "ridge_stubble_b", "url": "assets/fields/ridge_stubble_b-v1.png", "width": 512, "height": 64, "role": "strip" },
  { "key": "ox_plough_team", "url": "assets/zones/animals/ox_plough_team-v1.png", "width": 192, "height": 128, "role": "prop", "displayWidth": 46, "anchorX": 96, "anchorY": 116 },
  { "key": "ox_cart_hay", "url": "assets/zones/animals/ox_cart_hay-v1.png", "width": 192, "height": 128, "role": "prop", "displayWidth": 46, "anchorX": 96, "anchorY": 116 },
  { "key": "sheep_flock", "url": "assets/zones/animals/sheep_flock-v1.png", "width": 128, "height": 96, "role": "prop", "displayWidth": 30, "anchorX": 64, "anchorY": 84 },
  { "key": "cattle_pair", "url": "assets/zones/animals/cattle_pair-v1.png", "width": 128, "height": 96, "role": "prop", "displayWidth": 30, "anchorX": 64, "anchorY": 84 },
] as const;

export type ZoneAssetKey = (typeof ZONE_ASSETS)[number]["key"];

/**
 * Variant families (selection: position hash, then deterministic near rejection, ASSET_PIPELINE_SPEC_v1 6). The
 * orchard family starts with the existing phase16 orchard tree (not a zone asset: `orchard_tree`).
 */
export const ZONE_VARIANTS = {
  pastureFloor: ["pasture_fill", "pasture_fill_b", "pasture_fill_c"],
  orchardFloor: ["orchard_floor_fill", "orchard_floor_fill_b"],
  soil: ["soil_a", "soil_b"],
  ridge: {
    ploughed: ["ridge_ploughed_a", "ridge_ploughed_b"],
    seedling: ["ridge_seedling_a", "ridge_seedling_b"],
    growing: ["ridge_growing_a", "ridge_growing_b"],
    fallow: ["ridge_fallow_a", "ridge_fallow_b"],
    harvested: ["ridge_stubble_a", "ridge_stubble_b"],
  },
  furrow: ["furrow_stamp_a", "furrow_stamp_b", "furrow_stamp_c", "furrow_stamp_d"],
  croftBed: ["croft_bed_a", "croft_bed_b", "croft_bed_c"],
  haycock: ["haycock_a", "haycock_b", "haycock_c", "haycock_d", "haycock_e", "haycock_f"],
  orchardTree: ["orchard_tree", "orchard_apple_c", "orchard_apple_d", "orchard_pear_e", "orchard_plum_f",
    "orchard_apple_g", "orchard_apple_h", "orchard_pear_i", "orchard_plum_j"],
} as const satisfies Record<string, readonly string[] | Record<string, readonly ZoneAssetKey[]>>;

export type ZonePropKind = (typeof ZONE_VARIANTS)["haycock"][number] | (typeof ZONE_VARIANTS)["orchardTree"][number];
