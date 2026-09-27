// Player-facing copy of the construction site card model (row labels and values).
export const CONSTRUCTION_SITE_CARD_COPY = {
  siteTerm: "부지",
  securedTerm: "자재 확보",
  deliveryTerm: "자재 배달",
  builderWorkTerm: "건축 작업",
  materialDiagnosisTerm: "자재 진단",
  causeTerm: "원인",
  connectingRoadTerm: "연결 길",
  reservedSuffix: (reserved: number) => ` · 예약 ${reserved}`,
  secured: (resource: string, delivered: number, required: number, suffix: string) => `${resource} ${delivered}/${required} 확보${suffix}`,
  noneNeeded: "필요 없음",
  remaining: (resource: string, remaining: number) => `${resource} ${remaining} 남음`,
  noDeliveryWaiting: "배달 대기 없음",
  queuedNoRoute: "대기(경로 없음)",
  queuedFromGate: (position: number) => `대기 중 · 성문 기준 ${position}번째 구간`,
  siteName: (name: string) => `${name} 부지`,
} as const;
