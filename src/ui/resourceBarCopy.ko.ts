import { durationLabel } from "./gameTimeCopy.ko";

// Resource bar detail lines (B9: these were hover-only `title` tooltips; the "자원 상세" panel now shows them on tap).
// Durations read as real time at 1x speed (UX1), never raw ticks.
export const RESOURCE_BAR_COPY = {
  timberDetail: (total: number, spendable: number) => `목재 전체 보유량 ${total} · 건설 가능 ${spendable} · 실제 예약·운송 중 물량 제외`,
  stoneDetail: (total: number, spendable: number) => `석재 전체 보유량 ${total} · 건설 가능 ${spendable} · 실제 예약·운송 중 물량 제외`,
  populationTrend: "인구 추세는 명 단위입니다.",
  /** RES-REG: the name chip beside the generic picture when the population picture fails. */
  populationName: "인구",
  trend: (delta: number, ticks: number) => `${delta > 0 ? "+" : ""}${delta} / ${durationLabel(ticks)}`,
  breadDuration: (lots: number, ticks: number) => `${lots}가구 기준 ${durationLabel(ticks)}`,
  /** F0-V: the bread stock as a calendar arrival point ("4가구 · 여름 초쯤까지"). */
  breadUntil: (lots: number, when: string) => `${lots}가구 · ${when}까지`,
  breadDetail: (mealTicks: number) => `현재 입주 필지당 평균 소비량 기준, ${durationLabel(mealTicks)}마다 1끼. 합필은 2필지. 운송 중인 물량 포함, 가구 비축 제외. 공급 도달을 보장하지 않음.`,
  trendDetail: (windowTicks: number) => `추세: 최근 최대 ${durationLabel(windowTicks)} 관측 순증감. 목재·석재는 건설 가용량 기준입니다.`,
  observing: "— 관측 중",
  noOccupiedHouseholds: "입주 가구 없음",
  regionLabel: "영지 자원 현황",
  populationRecord: "인구 기록",
  populationLabel: "인구",
  idleWorkers: "유휴 일꾼",
  breadLabel: "빵",
  full: " · 가득",
  timberLabel: "가용 목재",
  timberReserved: (reserved: number) => `공사 예약 ${reserved}`,
  stoneLabel: "가용 석재",
  rawStone: (rawStone: number) => `원석 ${rawStone}`,
  coinDetail: "재정 수입과 지출 상세",
  coinLabel: "재정",
  moreSummary: "자원 상세",
  rawStock: (wheat: number, logs: number, rawStone: number) => `밀 ${wheat} · 원목 ${logs} · 원석 ${rawStone}`,
} as const;
