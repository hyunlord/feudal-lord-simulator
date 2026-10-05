import { BALANCE } from '../content/balanceConfig';
import type { GameState } from '../engine/engine.types';
import { stateCalendar } from '../engine/scenarioState';

export type CalendarProgress = { readonly season: 0 | 1 | 2 | 3; readonly year: number; readonly fraction: number; readonly seconds: number };
/** Presentation phase, not observed weather history. Reopening the same state gives the same phase. */
export function calendarProgress(state: Pick<GameState, 'tick' | 'scenarioId'>): CalendarProgress {
  const tick = Math.max(0, state.tick);
  const date = stateCalendar(state);
  const seasonTicks = BALANCE.TICKS_PER_YEAR / 4;
  return { season: date.season, year: date.year, fraction: (tick % seasonTicks) / seasonTicks, seconds: tick / BALANCE.TICKS_PER_SECOND };
}
export function autumnAccumulation(progress: CalendarProgress): number {
  if (progress.season === 2) return Math.min(1, progress.fraction / 0.85);
  if (progress.season === 3) return Math.max(0, 1 - progress.fraction / 0.15);
  return 0;
}
