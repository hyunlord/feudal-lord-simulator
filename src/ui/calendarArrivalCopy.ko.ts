// F0-V calendar arrival points (visibility design 5절, D10): "봄 말쯤", "내년 여름 초쯤", "곧".
const SEASONS = ["봄", "여름", "가을", "겨울"] as const;
const THIRDS = ["초", "중순", "말"] as const;

export const CALENDAR_ARRIVAL_COPY = {
  soon: "곧",
  at: (years: number, season: 0 | 1 | 2 | 3, third: 0 | 1 | 2) =>
    years <= 0 ? `${SEASONS[season]} ${THIRDS[third]}쯤`
      : years === 1 ? `내년 ${SEASONS[season]} ${THIRDS[third]}쯤`
        : `${years}년 뒤 ${SEASONS[season]}쯤`,
} as const;

/** F0-V: the wall's earliest completion (최근 실생산 기준, 운송 제외). */
export const WALL_ETA_COPY = {
  earliest: (when: string) => `예상 완공 빨라야 ${when} (최근 실생산 기준, 운송 제외)`,
} as const;
