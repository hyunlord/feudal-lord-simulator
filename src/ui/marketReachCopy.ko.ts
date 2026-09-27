// UX-0b2 MARKET-1 on screen: a market serves the homes within its road reach (steps along the road, not a radius).
export const MARKET_REACH_COPY = {
  placementRange: (reach: number, roadTiles: number, homes: number) => `길 ${reach}걸음 안 · 닿는 길 ${roadTiles}칸 · 집 ${homes}채`,
  selectedLabel: (reach: number, homes: number) => `길 ${reach}걸음 안 집 ${homes}채`,
} as const;
