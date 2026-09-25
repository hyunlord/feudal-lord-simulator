import { BALANCE } from '../content/balanceConfig';
import { SCENARIO_COPY } from '../content/scenario/scenarioCopy.ko';
import { calendar } from '../engine/scenarioState';

// Game time for players (UX1): copy never shows raw ticks. A duration reads as real time at 1x speed
// (BALANCE.TICKS_PER_SECOND ticks = 1 s); a moment on the calendar reads as year, season and day (calendar() in
// engine/scenarioState: 360 days a year, 4 seasons of 90 days).
const DAYS_PER_SEASON = 90;

/** "약 20초" under a minute, "약 2분" from a minute up; zero or less is "0초". */
export function durationLabel(ticks: number): string {
  const seconds = Math.max(0, ticks) / BALANCE.TICKS_PER_SECOND;
  if (seconds <= 0) return '0초';
  if (seconds < 60) return `약 ${Math.max(1, Math.round(seconds))}초`;
  return `약 ${Math.round(seconds / 60)}분`;
}

/** Year counted from the founding (1년차), then season and day in season: "1년차 봄 12일". */
export function calendarDayLabel(tick: number): string {
  const date = calendar(tick, 1);
  return `${date.year}년차 ${SCENARIO_COPY.seasons[date.season]} ${date.dayOfYear - date.season * DAYS_PER_SEASON}일`;
}

export const GAME_TIME_COPY = {
  /** Worker-ticks of labour read as the time one worker needs alone. */
  oneWorkerLabour: (workerTicks: number) => `일꾼 1명 기준 ${durationLabel(workerTicks)}`,
  /** Construction card: work done in percent, then the time left at the current crew (none while nobody builds). */
  builderWork: (percent: number, builders: number, remainingTicks: number | null) => remainingTicks === null
    ? `${percent}% · 일꾼 ${builders}명`
    : `${percent}% · 일꾼 ${builders}명 · ${durationLabel(remainingTicks)} 남음`,
  /** Two ticks on the same calendar day read as that one day. */
  calendarSpan: (firstTick: number, lastTick: number) => calendarDayLabel(firstTick) === calendarDayLabel(lastTick)
    ? calendarDayLabel(firstTick)
    : `${calendarDayLabel(firstTick)}~${calendarDayLabel(lastTick)}`,
} as const;

/** Content copy the UI cannot rewrite (src/content) may still say "600틱": shown as time, "약 30초". */
export function humanizeTicks(text: string): string {
  return text.replace(/(\d[\d,]*)\s*틱/g, (_, digits: string) => durationLabel(Number(digits.replaceAll(",", ""))));
}
