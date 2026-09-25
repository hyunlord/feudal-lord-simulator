// Astra Wave 4b pieces for the curved shore, wall and bridge render (D3), installed and registered by C1e. D3a draws
// the shoreline strips, shallow water fills and bridge abutments (SHORE_ASSET_KEYS, loaded by terrainVariantAssets);
// the palisade and stone wall faces wait for D3b and are not loaded. Provenance rows in docs/provenance/assets.csv (status
// runtime: the files ship in public/assets), candidates kept in assets-inbox/wave4b. Roles as in zoneAssetManifest.
export const TERRAIN_VARIANT_ASSETS = [
  { "key": "shoreline_a", "url": "assets/shore/shoreline_a-v1.png", "width": 512, "height": 96, "role": "strip" },
  { "key": "shoreline_b", "url": "assets/shore/shoreline_b-v1.png", "width": 512, "height": 96, "role": "strip" },
  { "key": "shoreline_c", "url": "assets/shore/shoreline_c-v1.png", "width": 512, "height": 96, "role": "strip" },
  { "key": "shoreline_d", "url": "assets/shore/shoreline_d-v1.png", "width": 512, "height": 96, "role": "strip" },
  { "key": "shallow_a", "url": "assets/shore/shallow_a-v1.png", "width": 256, "height": 128, "role": "fill" },
  { "key": "shallow_b", "url": "assets/shore/shallow_b-v1.png", "width": 256, "height": 128, "role": "fill" },
  { "key": "shallow_c", "url": "assets/shore/shallow_c-v1.png", "width": 256, "height": 128, "role": "fill" },
  { "key": "palisade_face_a", "url": "assets/wall/palisade_face_a-v1.png", "width": 512, "height": 128, "role": "strip" },
  { "key": "palisade_face_b", "url": "assets/wall/palisade_face_b-v1.png", "width": 512, "height": 128, "role": "strip" },
  { "key": "palisade_face_c", "url": "assets/wall/palisade_face_c-v1.png", "width": 512, "height": 128, "role": "strip" },
  { "key": "stone_face_a", "url": "assets/wall/stone_face_a-v1.png", "width": 512, "height": 128, "role": "strip" },
  { "key": "stone_face_b", "url": "assets/wall/stone_face_b-v1.png", "width": 512, "height": 128, "role": "strip" },
  { "key": "stone_face_c", "url": "assets/wall/stone_face_c-v1.png", "width": 512, "height": 128, "role": "strip" },
  { "key": "bridge_abutment_ne_a", "url": "assets/module/bridge_abutment_ne_a-v1.png", "width": 256, "height": 192, "role": "module" },
  { "key": "bridge_abutment_nw_a", "url": "assets/module/bridge_abutment_nw_a-v1.png", "width": 256, "height": 192, "role": "module" },
] as const;

export type TerrainVariantKey = (typeof TERRAIN_VARIANT_ASSETS)[number]["key"];

/** Variant families for D3 (same selection rule as the zone families: position hash + near rejection). */
export const TERRAIN_VARIANTS = {
  shoreline: ["shoreline_a", "shoreline_b", "shoreline_c", "shoreline_d"],
  shallowWater: ["shallow_a", "shallow_b", "shallow_c"],
  palisadeFace: ["palisade_face_a", "palisade_face_b", "palisade_face_c"],
  stoneFace: ["stone_face_a", "stone_face_b", "stone_face_c"],
  bridgeAbutment: ["bridge_abutment_ne_a", "bridge_abutment_nw_a"],
} as const satisfies Record<string, readonly TerrainVariantKey[]>;

/** The pieces D3a draws (loaded on demand); the wall faces stay registered only. */
export const SHORE_ASSET_KEYS = [...TERRAIN_VARIANTS.shoreline, ...TERRAIN_VARIANTS.shallowWater, ...TERRAIN_VARIANTS.bridgeAbutment] as const;
export type ShoreAssetKey = (typeof SHORE_ASSET_KEYS)[number];
