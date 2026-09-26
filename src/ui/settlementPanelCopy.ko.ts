// Settlement panel wording (UX-0b: game time on the calendar, never raw ticks or game seconds).
export const SETTLEMENT_PANEL_COPY = {
  hold: (held: string, required: string) => `연속 유지 ${held} / ${required}`,
  /** Bread the households hold and what they eat, every `days` calendar days. */
  /** Everyone has left: the time left before the town counts as abandoned, on the calendar. */
  abandonmentRisk: (left: string) => `주민이 모두 떠났습니다. 집에 물과 빵을 공급해 입주를 회복하세요. ${left} 남았습니다.`,
  householdBread: (bread: number, days: number, ration: number) => `가구 비축 빵 ${bread} · ${days}일마다 ${ration}개를 먹습니다`,
} as const;
