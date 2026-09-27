// Player-facing copy of the building inspector model (fact rows).
// The purpose line of each building is its catalog line (BLD-REG, `buildingCatalog.ko.ts` `inspector`).

export const BUILDING_INSPECTOR_COPY = {
  houseNames: ["오두막", "소가옥", "장인가옥", "상인가옥", "도시 대가옥"],
  mergedHouseSuffix: " · 합필 주택",
  beforeBread: "빵 배급 전",
  lastBread: (elapsed: string) => `마지막 빵 ${elapsed} 전`,
  houseLevel: (level: number, residents: number) => `생활 등급 ${level} · 주민 ${residents}명`,
  builtStage: (stage: number, condition: string) => `건축 단계 ${stage} · ${condition}`,
  lot: (width: number, height: number) => `대지 ${width}×${height}칸`,
  water: (hasWater: boolean) => `물 ${hasWater ? "있음" : "없음"}`,
  stockItem: (resource: string, amount: number) => `${resource} ${amount}`,
  none: "없음",
  storageTotal: (used: number, incoming: number, capacity: number) => `보관 ${used} + 입고 예약 ${incoming} / 한도 ${capacity}`,
  storageItem: (resource: string, stored: number, incoming: number, capacity: number) =>
    `${resource} ${stored} + 입고 예약 ${incoming} / 공동 한도 ${capacity}`,
  workers: (workers: number, required: number) => `일꾼 ${workers}/${required}`,
  stock: (stock: string) => `재고 ${stock}`,
  production: (progress: number, ticksPerOutput: number) => `생산 ${progress}/${ticksPerOutput}`,
  cause: (cause: string) => `원인: ${cause}`,
} as const;
