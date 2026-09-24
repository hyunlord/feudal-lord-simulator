// Runtime images for RENDER_BOUNDARY_V2 (Astra D1/D1b, installed by D1a; provenance rows in docs/provenance/assets.csv).
// Strips are top-down 512x64 textures repeated along a road ribbon; decals are 2:1 isometric, 128 source px per tile.
export const BOUNDARY_ASSETS = [
  { "key": "earth_strip", "url": "assets/road/earth_strip-v1.png", "width": 512, "height": 64 },
  { "key": "stone_strip", "url": "assets/road/stone_strip-v1.png", "width": 512, "height": 64 },
  { "key": "forest_fringe_a", "url": "assets/boundary/forest_fringe_a-v1.png", "width": 128, "height": 96 },
  { "key": "forest_fringe_b", "url": "assets/boundary/forest_fringe_b-v1.png", "width": 128, "height": 96 },
  { "key": "forest_fringe_c", "url": "assets/boundary/forest_fringe_c-v1.png", "width": 128, "height": 96 },
  { "key": "field_furrow", "url": "assets/boundary/field_furrow-v1.png", "width": 128, "height": 64 },
  { "key": "grass_edge", "url": "assets/boundary/grass_edge-v1.png", "width": 128, "height": 64 },
] as const;

export type BoundaryAssetKey = (typeof BOUNDARY_ASSETS)[number]["key"];
