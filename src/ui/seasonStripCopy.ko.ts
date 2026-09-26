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
  now: "지금",
} as const;
