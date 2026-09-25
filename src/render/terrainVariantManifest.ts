// Astra Wave 4b pieces for the curved shore, wall and bridge render (D3), installed and registered by C1e. D3a draws
// the shoreline strips, shallow water fills and bridge abutments (SHORE_ASSET_KEYS), D3b the palisade and stone wall
// faces (WALL_FACE_KEYS); both are loaded on demand by terrainVariantAssets. Provenance rows in docs/provenance/assets.csv (status
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
  // Wave 4d (D3b-2): wall strips v2 (face without battlements + a top strip with the wall walk and merlons, a top view
  // for walls seen end-on), the stone corner tower, deep water fills, shore strips e / f, reed and mudstone decals and
  // the front (SE) bridge abutment. Candidates kept in assets-inbox/wave4d.
  { "key": "stone_face_v2_a", "url": "assets/wall/stone_face_a-v2.png", "width": 512, "height": 128, "role": "strip" },
  { "key": "stone_face_v2_b", "url": "assets/wall/stone_face_b-v2.png", "width": 512, "height": 128, "role": "strip" },
  { "key": "stone_face_v2_c", "url": "assets/wall/stone_face_c-v2.png", "width": 512, "height": 128, "role": "strip" },
  { "key": "stone_top_a", "url": "assets/wall/stone_top_a-v1.png", "width": 512, "height": 48, "role": "strip" },
  { "key": "stone_top_b", "url": "assets/wall/stone_top_b-v1.png", "width": 512, "height": 48, "role": "strip" },
  { "key": "stone_diag_top", "url": "assets/wall/stone_face_diag_top-v1.png", "width": 512, "height": 64, "role": "strip" },
  { "key": "stone_tower_corner", "url": "assets/wall/stone_tower_corner-v1.png", "width": 1774, "height": 887, "role": "module" },
  { "key": "palisade_face_v2_a", "url": "assets/wall/palisade_face_a-v2.png", "width": 512, "height": 128, "role": "strip" },
  { "key": "palisade_face_v2_b", "url": "assets/wall/palisade_face_b-v2.png", "width": 512, "height": 128, "role": "strip" },
  { "key": "palisade_top", "url": "assets/wall/palisade_top-v1.png", "width": 512, "height": 48, "role": "strip" },
  { "key": "palisade_diag_top", "url": "assets/wall/palisade_face_diag_top-v1.png", "width": 512, "height": 64, "role": "strip" },
  { "key": "deep_a", "url": "assets/water/deep_a-v1.png", "width": 256, "height": 128, "role": "fill" },
  { "key": "deep_b", "url": "assets/water/deep_b-v1.png", "width": 256, "height": 128, "role": "fill" },
  { "key": "deep_c", "url": "assets/water/deep_c-v1.png", "width": 256, "height": 128, "role": "fill" },
  { "key": "shoreline_e", "url": "assets/shore/shoreline_e-v1.png", "width": 512, "height": 96, "role": "strip" },
  { "key": "shoreline_f", "url": "assets/shore/shoreline_f-v1.png", "width": 512, "height": 96, "role": "strip" },
  { "key": "reeds_a", "url": "assets/shore/reeds_a-v1.png", "width": 96, "height": 96, "role": "decal" },
  { "key": "reeds_b", "url": "assets/shore/reeds_b-v1.png", "width": 96, "height": 96, "role": "decal" },
  { "key": "reeds_c", "url": "assets/shore/reeds_c-v1.png", "width": 96, "height": 96, "role": "decal" },
  { "key": "mudstone_a", "url": "assets/shore/mudstone_a-v1.png", "width": 64, "height": 48, "role": "decal" },
  { "key": "mudstone_b", "url": "assets/shore/mudstone_b-v1.png", "width": 64, "height": 48, "role": "decal" },
  { "key": "bridge_abutment_se_a", "url": "assets/module/bridge_abutment_se_a-v1.png", "width": 256, "height": 192, "role": "module" },
] as const;

export type TerrainVariantKey = (typeof TERRAIN_VARIANT_ASSETS)[number]["key"];

/** Variant families for D3 (same selection rule as the zone families: position hash + near rejection). */
export const TERRAIN_VARIANTS = {
  shoreline: ["shoreline_a", "shoreline_b", "shoreline_c", "shoreline_d", "shoreline_e", "shoreline_f"],
  shallowWater: ["shallow_a", "shallow_b", "shallow_c"],
  deepWater: ["deep_a", "deep_b", "deep_c"],
  shoreReeds: ["reeds_a", "reeds_b", "reeds_c"],
  shoreStones: ["mudstone_a", "mudstone_b"],
  /** Wave 4b faces (D3b v1 strips); kept registered, no longer drawn. */
  palisadeFaceV1: ["palisade_face_a", "palisade_face_b", "palisade_face_c"],
  stoneFaceV1: ["stone_face_a", "stone_face_b", "stone_face_c"],
  palisadeFace: ["palisade_face_v2_a", "palisade_face_v2_b"],
  stoneFace: ["stone_face_v2_a", "stone_face_v2_b", "stone_face_v2_c"],
  palisadeTop: ["palisade_top"],
  stoneTop: ["stone_top_a", "stone_top_b"],
  palisadeDiagTop: ["palisade_diag_top"],
  stoneDiagTop: ["stone_diag_top"],
  stoneTower: ["stone_tower_corner"],
  bridgeAbutment: ["bridge_abutment_ne_a", "bridge_abutment_nw_a", "bridge_abutment_se_a"],
} as const satisfies Record<string, readonly TerrainVariantKey[]>;

/** The pieces the shore draws (D3a, D3b-2 deep water and decals), and the wall strips (D3b-2 v2), each loaded on demand. */
export const SHORE_ASSET_KEYS = [...TERRAIN_VARIANTS.shoreline, ...TERRAIN_VARIANTS.shallowWater, ...TERRAIN_VARIANTS.deepWater,
  ...TERRAIN_VARIANTS.shoreReeds, ...TERRAIN_VARIANTS.shoreStones, ...TERRAIN_VARIANTS.bridgeAbutment] as const;
export type ShoreAssetKey = (typeof SHORE_ASSET_KEYS)[number];
export const WALL_FACE_KEYS = [...TERRAIN_VARIANTS.palisadeFace, ...TERRAIN_VARIANTS.stoneFace, ...TERRAIN_VARIANTS.palisadeTop,
  ...TERRAIN_VARIANTS.stoneTop, ...TERRAIN_VARIANTS.palisadeDiagTop, ...TERRAIN_VARIANTS.stoneDiagTop, ...TERRAIN_VARIANTS.stoneTower] as const;
export type WallFaceKey = (typeof WALL_FACE_KEYS)[number];
