/** F0-A pressure copy (spec docs/design/flow-pressure.md): house stages, their cause and the season card's next objective. */
export const PRESSURE_COPY = {
  status: { settled: "정착", leaving: "떠날 준비", abandoned: "황폐(빈 필지)" },
  cause: { food_shortage: "식량 부족으로 떠날 준비" },
  nextObjective: { food_reserve: "식량 비축 한 계절", harvest_reserve: "다음 수확까지 비축", resettle: "빈 필지 재정착" },
  firstWinterWarning: "다음 수확까지 식량이 모자랍니다(겨울과 봄 보릿고개)",
} as const;
