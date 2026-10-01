// Player-facing copy of placement feedback (why a tile refuses a building, and the active tool line).
export const PLACEMENT_FEEDBACK_COPY = {
  occupied: "이미 건물이 있습니다",
  wallClearance: "성벽과 최소 1칸 간격을 두세요",
  wrongTerrain: "물 위에는 지을 수 없습니다",
  outOfBounds: "영지 밖입니다",
  needsRoad: "길에 닿아야 합니다 — 먼저 길을 놓으세요",
  /** Next to what the building needs (MA-10: the fulling mill's wheel running water — the river or brook —, the dyehouse any water). */
  needsAdjacent: {
    forest: "숲 옆에 지어야 합니다",
    water: "물가 옆에 지어야 합니다",
    flowing_water: "흐르는 물가 옆에 지어야 합니다 — 강이나 개울",
    rock: "바위 옆에 지어야 합니다",
  },
  resourcesShort: (shortfall: string) => `자원이 부족합니다 — ${shortfall}`,
  timberShort: (timberCost: number) => `목재가 부족합니다 (필요 ${timberCost})`,
  lockedEra: "목책마을 이후 건설할 수 있습니다",
  resourceAmount: (resource: string, amount: number) => `${resource} ${amount}`,
  none: "없음",
  chooseTool: "도구를 선택하세요",
  placeBuilding: (building: string) => `지을 곳을 클릭하세요 — ${building} · 취소하려면 Esc`,
  placeRoad: "드래그하여 길을 놓으세요 · 취소하려면 Esc",
} as const;
