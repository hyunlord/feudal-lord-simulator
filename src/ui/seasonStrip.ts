import { BALANCE } from "../content/balanceConfig";
import { SEASON_BALANCE } from "../content/balanceConfig";
import type { GameState } from "../engine/engine.types";
import { LEDGER_PERIOD_TICKS } from "../ledger/ledger";
import { absoluteDay, dayStartTick, MARKET_DAY_OF_MONTH } from "./residentTrips";

// UI-3 season strip (Wave 8 season_strip): one calendar year, spring to winter, with a pin at today and marks for
// what comes next. The marks are the engine's own dates: the sowing and harvest labour bands (SEASON_BALANCE, in-year
// ticks), the money period close (every LEDGER_PERIOD_TICKS), and the monthly market day (residentTrips, only once
// the town has a market). Positions are fractions of the year; the list is the next few, soonest first.
export type SeasonMarkKind = "sow" | "harvest" | "period_end" | "market_day";
export type SeasonMark = { readonly kind: SeasonMarkKind; readonly tick: number; readonly fraction: number };

const YEAR = BALANCE.TICKS_PER_YEAR;
const DAYS_PER_MONTH = 30;
const band = (name: string): number => SEASON_BALANCE.bands.find(entry => entry.name === name)!.from;

/** The first tick at or after `from` whose in-year position is `inYear`. */
function nextInYear(from: number, inYear: number): number {
  const start = from - (from % YEAR) + inYear;
  return start >= from ? start : start + YEAR;
}

export const yearFraction = (tick: number): number => (Math.max(0, tick) % YEAR) / YEAR;

export function seasonMarks(state: Pick<GameState, "tick" | "buildings">): readonly SeasonMark[] {
  const now = state.tick;
  const marks: { kind: SeasonMarkKind; tick: number }[] = [
    { kind: "sow", tick: nextInYear(now, band("sowing")) },
    { kind: "harvest", tick: nextInYear(now, band("harvest")) },
    { kind: "period_end", tick: (Math.floor(now / LEDGER_PERIOD_TICKS) + 1) * LEDGER_PERIOD_TICKS },
  ];
  if (state.buildings.some(building => building.kind === "market")) {
    const today = absoluteDay(now);
    const offset = (MARKET_DAY_OF_MONTH - (today % DAYS_PER_MONTH) + DAYS_PER_MONTH) % DAYS_PER_MONTH;
    const day = today + (offset === 0 && dayStartTick(today) < now ? DAYS_PER_MONTH : offset);
    marks.push({ kind: "market_day", tick: dayStartTick(day) });
  }
  return marks.map(mark => ({ ...mark, fraction: yearFraction(mark.tick) })).sort((a, b) => a.tick - b.tick);
}

/** Calendar arrival of a tick relative to now: its season, which third of it, and whether it falls in a later year. */
export function arrivalOf(now: number, tick: number): { readonly season: 0 | 1 | 2 | 3; readonly third: 0 | 1 | 2; readonly nextYear: boolean } {
  const inYear = tick % YEAR;
  const season = Math.floor(inYear * 4 / YEAR) as 0 | 1 | 2 | 3;
  const third = Math.min(2, Math.floor((inYear - season * YEAR / 4) * 3 / (YEAR / 4))) as 0 | 1 | 2;
  return { season, third, nextYear: Math.floor(tick / YEAR) > Math.floor(now / YEAR) };
}
