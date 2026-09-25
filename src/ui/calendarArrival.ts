import { BALANCE } from "../content/balanceConfig";
import { calendar } from "../engine/scenarioState";
import { CALENDAR_ARRIVAL_COPY } from "./calendarArrivalCopy.ko";

/**
 * F0-V: a future moment as a calendar arrival point ("봄 말쯤", "내년 여름 초쯤", "곧"), never ticks or game seconds.
 * A season is split in thirds (초·중·말, 30 calendar days each); within SOON_DAYS days it is "곧".
 */
const SOON_DAYS = 3;
const TICKS_PER_DAY = BALANCE.TICKS_PER_YEAR / 360;

export function calendarArrivalLabel(nowTick: number, arrivalTick: number, startYear: number): string {
  if (arrivalTick - nowTick < SOON_DAYS * TICKS_PER_DAY) return CALENDAR_ARRIVAL_COPY.soon;
  const now = calendar(nowTick, startYear);
  const at = calendar(arrivalTick, startYear);
  const dayInSeason = (at.dayOfYear - 1) % 90;
  const third = dayInSeason < 30 ? 0 : dayInSeason < 60 ? 1 : 2;
  const years = at.year - now.year;
  return CALENDAR_ARRIVAL_COPY.at(years, at.season, third);
}
