// Runtime images for RENDER_BOUNDARY_V2 (Astra D1/D1b, installed by D1a; Wave 4 earth strip v2 by D1a-2; provenance
// rows in docs/provenance/assets.csv). Strips are top-down 512x64 textures repeated along a road ribbon; decals are
// 2:1 isometric, 128 source px per tile.
export const BOUNDARY_ASSETS = [
  { "key": "earth_strip", "url": "assets/road/earth_strip-v1.png", "width": 512, "height": 64 },
  { "key": "stone_strip", "url": "assets/road/stone_strip-v1.png", "width": 512, "height": 64 },
  { "key": "earth_strip_a_v2", "url": "assets/road/earth_strip_a-v2.png", "width": 512, "height": 64 },
  { "key": "earth_strip_b_v2", "url": "assets/road/earth_strip_b-v2.png", "width": 512, "height": 64 },
  { "key": "forest_fringe_a", "url": "assets/boundary/forest_fringe_a-v1.png", "width": 128, "height": 96 },
  { "key": "forest_fringe_b", "url": "assets/boundary/forest_fringe_b-v1.png", "width": 128, "height": 96 },
  { "key": "forest_fringe_c", "url": "assets/boundary/forest_fringe_c-v1.png", "width": 128, "height": 96 },
  { "key": "field_furrow", "url": "assets/boundary/field_furrow-v1.png", "width": 128, "height": 64 },
  { "key": "grass_edge", "url": "assets/boundary/grass_edge-v1.png", "width": 128, "height": 64 },
] as const;

export type BoundaryAssetKey = (typeof BOUNDARY_ASSETS)[number]["key"];

/**
 * Road strip sets (D1a-2 C07). `images` alternate span by span along a ribbon (a, b, a, b; the joins are crossfaded).
 * `artRows` are the strip rows that span the ribbon width, chosen so every set has the same visible (50% alpha)
 * width: v1 is opaque in rows 13..50 of 8..56, v2 in rows 6..57 of 0..64. `rutContrast` (0..1) scales how strongly
 * the wheel ruts read against the crown: v1 draws them harder than the road width, so the renderer blends them
 * toward a vertically blurred copy; v2 was painted quiet and takes 1.
 */
export const ROAD_STRIP_SETS = {
  earth: {
    v1: { "images": ["earth_strip"], "artRows": [8, 56], "rutContrast": 0.45 },
    v2: { "images": ["earth_strip_a_v2", "earth_strip_b_v2"], "artRows": [0, 64], "rutContrast": 1 },
  },
  stone: {
    v1: { "images": ["stone_strip"], "artRows": [8, 56], "rutContrast": 0.7 },
  },
} as const satisfies Record<string, Record<string, RoadStripSet>>;

/** Which set each road material draws. Swapping a strip is this one line (the URL query `road-strip=v1|v2` overrides earth for comparisons). */
export const ROAD_STRIP_CHOICE = { earth: "v1", stone: "v1" } as const;

export type RoadStripSet = {
  readonly images: readonly BoundaryAssetKey[];
  readonly artRows: readonly [number, number];
  readonly rutContrast: number;
};
