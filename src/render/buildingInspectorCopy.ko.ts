// Player-facing copy of the building inspector model (purpose line and fact rows).
export const BUILDING_INSPECTOR_PURPOSE = {
  house: "주민이 생활하고 성장하는 집",
  well: "주변 가구에 물을 공급",
  storehouse: "목재와 통나무를 보관",
  granary: "밀과 빵을 보관하고 배급",
  chapel: "마을의 시대 선포 조건을 채우는 예배당",
  wheat_farm: "일꾼이 밀을 재배",
  farmstead: "일꾼이 경작지를 갈고 거둔 밀을 보관",
  mill: "밀을 빵으로 가공",
  malt_kiln: "보리를 엿기름으로 말립니다",
  logging_camp: "숲에서 통나무를 생산",
  sawmill: "통나무를 목재로 가공",
  quarry: "바위에서 원석을 채굴",
  masonry: "원석을 석재로 가공",
  market: "남는 물자를 팔아 재정 수입",
  church: "주변 가구에 교회 서비스를 제공",
  keep: "석조 도시의 중심 성채",
} as const;

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
