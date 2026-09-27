// Settlement panel wording (UX-0b: game time on the calendar, never raw ticks or game seconds).
export const SETTLEMENT_PANEL_COPY = {
  hold: (held: string, required: string) => `연속 유지 ${held} / ${required}`,
  /** Bread the households hold and what they eat, every `days` calendar days. */
  /** Everyone has left: the time left before the town counts as abandoned, on the calendar. */
  abandonmentRisk: (left: string) => `주민이 모두 떠났습니다. 집에 물과 빵을 공급해 입주를 회복하세요. ${left} 남았습니다.`,
  householdBread: (bread: number, days: number, ration: number) => `가구 비축 빵 ${bread} · ${days}일마다 ${ration}개를 먹습니다`,
  abandonedTitle: "정착지가 비었습니다",
  recordTitle: "영지의 기록",
  regionLabel: "영지 목표와 수급",
  summaryTitle: (title: string) => `${title} · 도시 발전 조건`,
  suppliedHouses: (supplied: number, occupied: number) => `물·빵 ${supplied}/${occupied}가구`,
  collapse: "접기",
  expand: "펼치기",
  larderRule: "가구별 세 끼를 비축합니다. 가구가 늘면 경작지·방앗간·배급 길도 함께 늘리세요.",
  met: " 충족",
  foodShortage: "배급 부족이 이어집니다. 경작지·방앗간의 일손과 곡창에서 집까지의 길을 확인하세요.",
  stopped: "주민 없는 상태가 이어져 영지 운영이 멈췄습니다.",
  restartConfirm: "현재 영지를 끝내고 처음부터 시작합니다.",
  restart: "처음부터 시작",
  cancel: "취소",
  newSettlement: "새 영지 시작",
} as const;
