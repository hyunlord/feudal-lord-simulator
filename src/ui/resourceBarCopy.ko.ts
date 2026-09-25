// Resource bar detail lines (B9: these were hover-only `title` tooltips; the "자원 상세" panel now shows them on tap).
export const RESOURCE_BAR_COPY = {
  timberDetail: (total: number, spendable: number) => `목재 전체 보유량 ${total} · 건설 가능 ${spendable} · 실제 예약·운송 중 물량 제외`,
  stoneDetail: (total: number, spendable: number) => `석재 전체 보유량 ${total} · 건설 가능 ${spendable} · 실제 예약·운송 중 물량 제외`,
  populationTrend: "인구 추세는 명 단위입니다.",
} as const;
