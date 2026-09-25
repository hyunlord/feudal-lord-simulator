// Placement checklist lines (UX1). Placement never checks roads (world/placement canPlaceBuilding has no needs_road
// branch), so the road line is a recommendation, not a block, until the engine enforces it.
export const PLACEMENT_CHECKLIST_COPY = {
  roadConnected: '도로 연결',
  roadRecommended: '도로 연결 권장',
  roadNotNeeded: '(운영에 불필요)',
} as const;
