// INSTALL-3 (AL-6, decision AL11): ale and a house's rise, from chapter 2. Hold times are the progress line's clock (m:ss).
export const HOUSE_ALE_COPY = {
  /** The card's progress line: the rise waits longer without ale (the hold now, and with ale). */
  unservedReady: (level: number, hold: string, base: string) => `에일이 없어 L${level} 승급이 늦어집니다 · 조건 유지 ${hold} (에일이 있으면 ${base})`,
  unserved: (level: number, hold: string, base: string) => `에일이 없으면 L${level} 승급에 조건 유지 ${hold} (에일이 있으면 ${base})`,
  served: "에일을 마십니다 · 제때 승급",
  /** The house's development conditions. */
  term: "에일",
  conditionServed: "마십니다 · 제때 승급",
  conditionUnserved: (level: number, hold: string, base: string) => `없음 · L${level} 승급 조건 유지 ${hold} (에일이 있으면 ${base})`,
  /** The season card: houses holding toward a rise that waits longer for want of ale. */
  seasonWaiting: (houses: number) => `에일이 없어 승급을 더 오래 기다리는 집 ${houses}채`,
} as const;
