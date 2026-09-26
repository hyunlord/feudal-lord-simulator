import { BALANCE } from '../content/balanceConfig';
import { SCENARIO_COPY } from '../content/scenario/scenarioCopy.ko';
import { calendar } from '../engine/scenarioState';

// Game time for players: copy never shows raw ticks. UX-0b (charter "달력 도착점, 틱·게임초 금지"; the cold start audit
// read "예상 약 1초", "20초마다", "일꾼 1명 기준 약 2분"): a duration reads in calendar days, seasons or years, as long
// as it is on the calendar whatever the speed (UX-1 read it as real time at 1x). A moment on the calendar reads as year,
// season and day (calendar() in engine/scenarioState: 360 days a year, 4 seasons of 90 days).
const DAYS_PER_SEASON = 90;
const TICKS_PER_DAY = BALANCE.TICKS_PER_YEAR / 360;

/** "0일" for none, "하루 안" under a day, "약 12일" under a season, "약 2계절" under a year, then "약 3년". */
export function durationLabel(ticks: number): string {
  const days = Math.max(0, ticks) / TICKS_PER_DAY;
  if (days <= 0) return '0일';
  if (days < 1) return '하루 안';
  if (days < DAYS_PER_SEASON) return `약 ${Math.round(days)}일`;
  if (days < DAYS_PER_SEASON * 4) return `약 ${Math.round(days / DAYS_PER_SEASON)}계절`;
  return `약 ${Math.round(days / (DAYS_PER_SEASON * 4))}년`;
}

/** Calendar days in a span of ticks (rounded, at least 1 for any positive span). */
export function calendarDays(ticks: number): number {
  return ticks <= 0 ? 0 : Math.max(1, Math.round(ticks / TICKS_PER_DAY));
}

/** Year counted from the founding (1년차), then season and day in season: "1년차 봄 12일". */
export function calendarDayLabel(tick: number): string {
  const date = calendar(tick, 1);
  return `${date.year}년차 ${SCENARIO_COPY.seasons[date.season]} ${date.dayOfYear - date.season * DAYS_PER_SEASON}일`;
}

export const GAME_TIME_COPY = {
  /** Worker-ticks of labour read as the time one worker needs alone. */
  oneWorkerLabour: (workerTicks: number) => `일꾼 1명이면 ${durationLabel(workerTicks)}`,
  /** Construction card: work done in percent, then the time left at the current crew (none while nobody builds). */
  builderWork: (percent: number, builders: number, remainingTicks: number | null) => remainingTicks === null
    ? `${percent}% · 일꾼 ${builders}명`
    : `${percent}% · 일꾼 ${builders}명 · ${durationLabel(remainingTicks)} 남음`,
  /** F0-V: the same with the time left as its calendar end point. */
  builderWorkUntil: (percent: number, builders: number, when: string) => `${percent}% · 일꾼 ${builders}명 · ${when} 완공`,
  /** Two ticks on the same calendar day read as that one day. */
  calendarSpan: (firstTick: number, lastTick: number) => calendarDayLabel(firstTick) === calendarDayLabel(lastTick)
    ? calendarDayLabel(firstTick)
    : `${calendarDayLabel(firstTick)}~${calendarDayLabel(lastTick)}`,
} as const;

/** Content copy the UI cannot rewrite (src/content) may still say "600틱": shown on the calendar, "약 54일". */
export function humanizeTicks(text: string): string {
  return text.replace(/(\d[\d,]*)\s*틱/g, (_, digits: string) => durationLabel(Number(digits.replaceAll(",", ""))));
}
