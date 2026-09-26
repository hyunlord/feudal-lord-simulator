import { SCENARIO_COPY } from "../content/scenario/scenarioCopy.ko";
import type { SeasonMarkKind } from "./seasonStrip";

// UI-3 season strip: the year at a glance and what comes next. Times are calendar arrivals ("가을 초쯤"), never ticks.
const THIRDS = ["초", "중순", "말"] as const;

export const SEASON_STRIP_COPY = {
  label: "계절 띠 — 다가오는 일 보기",
  listTitle: "다가오는 일",
  close: "닫기",
  kinds: { sow: "파종 시작", harvest: "수확 시작", period_end: "장부 기간 마감", market_day: "장날" } satisfies Record<SeasonMarkKind, string>,
  /** "가을 초쯤" / "내년 봄 말쯤". */
  arrival: (season: 0 | 1 | 2 | 3, third: 0 | 1 | 2, nextYear: boolean) =>
    `${nextYear ? "내년 " : ""}${SCENARIO_COPY.seasons[season]} ${THIRDS[third]}쯤`,
  row: (kind: string, when: string) => `${kind} — ${when}`,
  /** UI-4 forecast marks: what is coming and how sure (rumour / sign). */
  forecast: (kind: "fire" | "dearth", famine: boolean, sign: boolean) => `${kind === "fire" ? "불 위험" : famine ? "대기근" : "흉년"}(${sign ? "징후" : "소문"})`,
  /** Judgement 2026-09-26: the pill's food days, with the calendar point they reach ("식량 270일 — 가을 초까지"). */
  foodUntil: (days: number, season: 0 | 1 | 2 | 3, third: 0 | 1 | 2, nextYear: boolean) =>
    `식량 ${days}일 — ${nextYear ? "내년 " : ""}${SCENARIO_COPY.seasons[season]} ${THIRDS[third]}까지`,
  foodNone: "식량 — 먹는 집이 없습니다",
  now: "지금",
} as const;
