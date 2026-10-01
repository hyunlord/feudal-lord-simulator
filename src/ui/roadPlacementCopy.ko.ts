export const ROAD_PLACEMENT_COPY = {
  alreadyExists: '이미 길이 있습니다',
  previewCost: (newLand: number, newBridge: number, existing: number, timberPerBridge: number, timberCost: number): string =>
    `새 길 ${newLand + newBridge}칸 · 기존 길 ${existing}칸 통과 · 육지 ${newLand}칸 무료 · 다리 ${newBridge}칸 × 목재 ${timberPerBridge} = ${timberCost} (Esc/우클릭 취소)`,
  /** FD-1 (LAND-UI): a path over a ford — its cells cost a timber each, not a bridge's. */
  previewCostWithFords: (newLand: number, newBridge: number, newFord: number, existing: number, timberPerBridge: number, timberPerFord: number,
    timberCost: number): string =>
    `새 길 ${newLand + newBridge + newFord}칸 · 기존 길 ${existing}칸 통과 · 육지 ${newLand}칸 무료 · 다리 ${newBridge}칸 × 목재 ${timberPerBridge}`
    + ` · 여울 ${newFord}칸 × 목재 ${timberPerFord} = ${timberCost} (Esc/우클릭 취소)`,
} as const;
