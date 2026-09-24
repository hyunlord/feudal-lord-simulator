/** Player-facing name of money (spec L-1): pennies inside, shown as a whole number called 돈. */
export const MONEY_LABEL = "돈";

/** Money-rule copy (spec docs/design/money-rules.md). */
export const MONEY_RULE_COPY = {
  upkeepUnpaid: "유지비 미납",
  upkeepUnpaidDetail: (owed: number) => `유지비 미납 · 갚을 돈 ${owed} · 갚을 때까지 멈춤`,
  serviceUnpaid: "서비스 중단: 유지비 미납",
  projectSpend: (cost: number, after: number) => `석벽 사업 재원 ${MONEY_LABEL} ${cost}을 선포할 때 씁니다 · 남는 ${MONEY_LABEL} ${after}`,
  projectShort: (cost: number, balance: number) => `석벽 사업 재원 ${MONEY_LABEL} ${cost}이 필요합니다 · 지금 ${balance}`,
  cellNet: (net: number) => `${MONEY_LABEL} · 최근 기간 ${net > 0 ? "+" : ""}${net}`,
  cellArrears: (owed: number) => `미납 ${owed}`,
  gate: "성문",
  bridge: "다리",
  stoneProject: "석벽 사업",
  tollTraffic: "수레 통행",
} as const;
