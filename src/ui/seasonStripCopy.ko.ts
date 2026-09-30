import { SCENARIO_COPY } from "../content/scenario/scenarioCopy.ko";
import type { LegacyInterludeId, LegacyStepId } from "../content/legacyConfig";
import type { PlagueMark, ReorganisationMark, SeasonMarkKind } from "./seasonStrip";

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
  /** UI-6: the war's coming steps (F2-A `warForecast`). */
  war: { messenger: "국왕의 전령", wool_levy: "양모 공납 칙령", commission: "징집 명령", subsidy: "전쟁 보조세 요구", beacon: "해안 봉화",
    raid: "해안 습격", refugees: "피란민", recovery: "왕실의 회복 조처" } as Readonly<Record<string, string>>,
  /** UI-8: the plague's coming steps (F3-A `plagueForecast`). */
  plague: { rumour: "항구 열병 소문", arrival: "역병 도착", wage_demand: "임금 요구",
    abandoned_fields: "버려진 밭", ordinance: "노동자 조례", resettlement: "재정착",
    second: "두 번째 역병", end: "역병 종료" } satisfies Record<PlagueMark["id"], string>,
  /** UI-9: the reorganisation's coming steps (F4-A `reorganisationForecast`). */
  reorg: { wage_competition: "임금 경쟁", textile_street: "직물 거리", alehouse_boom: "에일집 성황",
    petitions_surge: "청원 물결", guild_demand: "길드 인가 청원", cloth_or_grain: "직물 대 곡물",
    overlord_warning: "백작의 경고", poll_tax: "인두세 징수",
    rebellion_rumour: "1381년 농민 반란 소문", autonomy_request: "자치 특허 협상", end: "4장 종료" } satisfies Record<ReorganisationMark["id"], string>,
  /** UI-10: chapter 5's coming steps (F5-A `legacyForecast`), named as their cards and events are. */
  legacy: { mayor_demand: "시장 선출 요구", royal_tax_envoy: "국왕의 과세 사절", succession: "늙은 영주의 후계자",
    city_seal: "도시 인장", charter_sealing: "자치 특허의 인장", family_departure: "가문의 거처",
    legacy_record: "남길 유산 하나", last_market: "1450년 마지막 장날" } satisfies Record<LegacyStepId, string>,
  /** UI-10: the 1384–1400 interlude's coming events (FIX-9 LG-13 `legacyInterludes`). */
  interlude: { staple: "양모 집산지 이전", guild_dispute: "길드와 상인의 다툼", market_fire: "장터 화재",
    church_rebuilding: "교회 증축 청원", deposition: "리처드 2세 폐위" } satisfies Record<LegacyInterludeId, string>,
  /** Judgement 2026-09-26: the pill's food days, with the calendar point they reach ("식량 270일 — 가을 초까지"). */
  foodUntil: (days: number, season: 0 | 1 | 2 | 3, third: 0 | 1 | 2, nextYear: boolean) =>
    `식량 ${days}일 — ${nextYear ? "내년 " : ""}${SCENARIO_COPY.seasons[season]} ${THIRDS[third]}까지`,
  foodNone: "식량 — 먹는 집이 없습니다",
  /** UX-0b: stored wheat the pill leaves out because no mill can grind it now. */
  idleWheat: (wheat: number) => `밀 ${wheat}은 방앗간이 멈춰 빵이 되지 않습니다`,
  now: "지금",
} as const;
