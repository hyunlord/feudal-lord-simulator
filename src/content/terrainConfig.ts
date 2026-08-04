export const TERRAIN_TYPES = ["grass", "forest", "water", "rock"] as const;

export type TerrainType = (typeof TERRAIN_TYPES)[number];
