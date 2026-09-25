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
  { "key": "shallow_d", "url": "assets/shore/shallow_d-v1.png", "width": 256, "height": 128, "role": "fill" },
  { "key": "shallow_e", "url": "assets/shore/shallow_e-v1.png", "width": 256, "height": 128, "role": "fill" },
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
  // Wave 4e (INSTALL-4e): rubble stone faces (the default stone face; the ashlar v2 faces only beside gates), the gate
  // v2 modules (painted on the NW-SE gate part's canvas with its alpha, so the gate registration is the old one), the
  // 135 degree pillar, the square tower b (a second 90 degree tower), shore strips beside deep water, the back-left (SW)
  // and second back (NW b) bridge abutments, and the ferry landing (registered only: no ferry logic, never drawn).
  // Candidates kept in assets-inbox/wave4e.
  { "key": "stone_face_rubble_a", "url": "assets/wall/stone_face_rubble_a-v2.png", "width": 512, "height": 128, "role": "strip" },
  { "key": "stone_face_rubble_b", "url": "assets/wall/stone_face_rubble_b-v2.png", "width": 512, "height": 128, "role": "strip" },
  { "key": "stone_gate_v2", "url": "assets/wall/stone_gate_v2-v1.png", "width": 512, "height": 512, "role": "module" },
  { "key": "palisade_gate_v2", "url": "assets/wall/palisade_gate_v2-v1.png", "width": 512, "height": 512, "role": "module" },
  { "key": "stone_pillar_135", "url": "assets/wall/stone_pillar_135-v1.png", "width": 1774, "height": 887, "role": "module" },
  { "key": "stone_tower_corner_b", "url": "assets/wall/stone_tower_corner_b-v1.png", "width": 1774, "height": 887, "role": "module" },
  // Wave 5c (INSTALL-5c): stone gate v3 painted per axis (512 x 384, portal feet in its geometry record), the 135
  // degree pillar's left- and right-turn buttresses (same frame and registration as stone_pillar_135), shallow water d / e.
  { "key": "stone_gate_v3_nwse", "url": "assets/wall/stone_gate_v3_nwse-v1.png", "width": 512, "height": 384, "role": "module" },
  { "key": "stone_gate_v3_nesw", "url": "assets/wall/stone_gate_v3_nesw-v1.png", "width": 512, "height": 384, "role": "module" },
  { "key": "stone_pillar_135_b", "url": "assets/wall/stone_pillar_135_b-v1.png", "width": 1774, "height": 887, "role": "module" },
  { "key": "stone_pillar_135_c", "url": "assets/wall/stone_pillar_135_c-v1.png", "width": 1774, "height": 887, "role": "module" },
  { "key": "shoreline_deep_a", "url": "assets/shore/shoreline_deep_a-v1.png", "width": 512, "height": 96, "role": "strip" },
  { "key": "shoreline_deep_b", "url": "assets/shore/shoreline_deep_b-v1.png", "width": 512, "height": 96, "role": "strip" },
  { "key": "bridge_abutment_sw_a", "url": "assets/module/bridge_abutment_sw_a-v1.png", "width": 256, "height": 192, "role": "module" },
  { "key": "bridge_abutment_nw_b", "url": "assets/module/bridge_abutment_nw_b-v1.png", "width": 256, "height": 192, "role": "module" },
  { "key": "ferry_landing", "url": "assets/module/ferry_landing-v1.png", "width": 256, "height": 192, "role": "module" },
] as const;

export type TerrainVariantKey = (typeof TERRAIN_VARIANT_ASSETS)[number]["key"];

/** Variant families for D3 (same selection rule as the zone families: position hash + near rejection). */
export const TERRAIN_VARIANTS = {
  /** Wave 4e strips painted beside the Wave 4d deep water: the default shore (INSTALL-4e). */
  shoreline: ["shoreline_deep_a", "shoreline_deep_b"],
  /** Wave 4b / 4d strips (lighter shallow-water side): kept registered with their water-half fade, no longer drawn. */
  shorelineShallow: ["shoreline_a", "shoreline_b", "shoreline_c", "shoreline_d", "shoreline_e", "shoreline_f"],
  /** Registered only (no ferry logic yet). */
  ferry: ["ferry_landing"],
  /** Wave 5c d / e: the deep water's hue, a little lighter (INSTALL-5c). Wave 4b a-c stay registered, no longer drawn. */
  shallowWater: ["shallow_d", "shallow_e"],
  shallowWaterV1: ["shallow_a", "shallow_b", "shallow_c"],
  deepWater: ["deep_a", "deep_b", "deep_c"],
  shoreReeds: ["reeds_a", "reeds_b", "reeds_c"],
  shoreStones: ["mudstone_a", "mudstone_b"],
  /** Wave 4b faces (D3b v1 strips); kept registered, no longer drawn. */
  palisadeFaceV1: ["palisade_face_a", "palisade_face_b", "palisade_face_c"],
  stoneFaceV1: ["stone_face_a", "stone_face_b", "stone_face_c"],
  palisadeFace: ["palisade_face_v2_a", "palisade_face_v2_b"],
  /** Wave 4e rubble faces: the default stone face (INSTALL-4e). */
  stoneFace: ["stone_face_rubble_a", "stone_face_rubble_b"],
  /** Wave 4d ashlar v2 faces: only within GATE_ASHLAR_TILES of a gate, where they continue the gate art's dressed stone. */
  stoneFaceGate: ["stone_face_v2_a", "stone_face_v2_b", "stone_face_v2_c"],
  palisadeTop: ["palisade_top"],
  stoneTop: ["stone_top_a", "stone_top_b"],
  palisadeDiagTop: ["palisade_diag_top"],
  stoneDiagTop: ["stone_diag_top"],
  stoneTower: ["stone_tower_corner", "stone_tower_corner_b"],
  /** Wave 4e pillar (registered, no longer drawn) and Wave 5c left-turn b / right-turn c (INSTALL-5c). */
  stonePillar: ["stone_pillar_135", "stone_pillar_135_b", "stone_pillar_135_c"],
  stoneGate: ["stone_gate_v2"],
  /** Wave 5c gate v3, one painting per axis (NW-SE, NE-SW): the wall strips' stone gate (INSTALL-5c). */
  stoneGateV3: ["stone_gate_v3_nwse", "stone_gate_v3_nesw"],
  palisadeGate: ["palisade_gate_v2"],
  bridgeAbutment: ["bridge_abutment_ne_a", "bridge_abutment_nw_a", "bridge_abutment_se_a", "bridge_abutment_sw_a", "bridge_abutment_nw_b"],
} as const satisfies Record<string, readonly TerrainVariantKey[]>;

/** The pieces the shore draws (D3a, D3b-2 deep water and decals), and the wall strips (D3b-2 v2), each loaded on demand. */
export const SHORE_ASSET_KEYS = [...TERRAIN_VARIANTS.shoreline, ...TERRAIN_VARIANTS.shallowWater, ...TERRAIN_VARIANTS.deepWater,
  ...TERRAIN_VARIANTS.shoreReeds, ...TERRAIN_VARIANTS.shoreStones, ...TERRAIN_VARIANTS.bridgeAbutment] as const;
export type ShoreAssetKey = (typeof SHORE_ASSET_KEYS)[number];
export const WALL_FACE_KEYS = [...TERRAIN_VARIANTS.palisadeFace, ...TERRAIN_VARIANTS.stoneFace, ...TERRAIN_VARIANTS.palisadeTop,
  ...TERRAIN_VARIANTS.stoneTop, ...TERRAIN_VARIANTS.palisadeDiagTop, ...TERRAIN_VARIANTS.stoneDiagTop, ...TERRAIN_VARIANTS.stoneTower,
  ...TERRAIN_VARIANTS.stoneFaceGate, ...TERRAIN_VARIANTS.stonePillar, ...TERRAIN_VARIANTS.stoneGate, ...TERRAIN_VARIANTS.palisadeGate,
  ...TERRAIN_VARIANTS.stoneGateV3] as const;
export type WallFaceKey = (typeof WALL_FACE_KEYS)[number];
