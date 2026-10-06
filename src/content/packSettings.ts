/**
 * EXT-2 (docs/design/ext-2-plan.md, extensibility.md §3): the core pack's time and money, as settings. The calendar
 * (start and end, the year's length in ticks, seasons and days), the campaign's chapters, the historical eras' start
 * years and the money units are read from here; the code knows "a year", "a season", "a unit of money", not 1300 or
 * the shilling. EXT-3 moves these values into the core pack's files; a pack of another age or country gives its own.
 * This module imports nothing, so every layer (content, engine, ledger, save) can read it.
 */

export interface PackCalendar {
  /** Tick 0 is the first day of the first season of this year. */
  readonly startYear: number;
  /** The campaign's last market day: this year, this season (0 = the first). */
  readonly end: { readonly year: number; readonly season: number };
  readonly ticksPerYear: number;
  readonly seasonsPerYear: number;
  /** Calendar days in a year, for day counts shown to the player (food days) and the date's day of the year. */
  readonly daysPerYear: number;
}

/** A campaign chapter's years (the chapters' rules are in `chapterConfig`; the years they are told in are here). */
export interface PackChapter {
  readonly chapter: number;
  readonly fromYear: number;
  readonly toYear: number;
}

/** The year a historical era may begin (its readiness and effects are the scenario's). */
export interface PackEra {
  readonly id: string;
  readonly fromYear: number;
}

/** A money unit, in the smallest unit (the engine counts money in the smallest unit only). Largest first. */
export interface PackCurrencyUnit {
  readonly id: string;
  readonly value: number;
}

export interface PackSettings {
  readonly calendar: PackCalendar;
  readonly chapters: readonly PackChapter[];
  readonly eras: readonly PackEra[];
  readonly currency: { readonly units: readonly PackCurrencyUnit[] };
}

/** England 1300–1450 (the core pack). */
export const CORE_PACK_SETTINGS = {
  calendar: {
    startYear: 1300,
    end: { year: 1450, season: 1 },
    /** C1c / FIX-13: four 1,000-tick seasons (a year is 400 s at 1x). */
    ticksPerYear: 4000,
    seasonsPerYear: 4,
    daysPerYear: 360,
  },
  chapters: [
    { chapter: 1, fromYear: 1300, toYear: 1318 },
    { chapter: 2, fromYear: 1318, toYear: 1347 },
    { chapter: 3, fromYear: 1348, toYear: 1364 },
    { chapter: 4, fromYear: 1362, toYear: 1400 },
    { chapter: 5, fromYear: 1382, toYear: 1450 },
  ],
  eras: [
    { id: "saturation", fromYear: 1300 },
    { id: "famine", fromYear: 1315 },
    { id: "war", fromYear: 1337 },
    { id: "collapse", fromYear: 1348 },
    { id: "specialisation", fromYear: 1380 },
  ],
  /** English money: £1 = 20s = 240d. */
  currency: { units: [{ id: "pound", value: 240 }, { id: "shilling", value: 12 }, { id: "penny", value: 1 }] },
} as const satisfies PackSettings;

export const PACK_CALENDAR: PackCalendar = CORE_PACK_SETTINGS.calendar;
export const YEAR_TICKS = CORE_PACK_SETTINGS.calendar.ticksPerYear;
export const SEASONS_PER_YEAR = CORE_PACK_SETTINGS.calendar.seasonsPerYear;
export const SEASON_TICKS = YEAR_TICKS / SEASONS_PER_YEAR;
export const DAYS_PER_YEAR = CORE_PACK_SETTINGS.calendar.daysPerYear;
export const DAYS_PER_SEASON = DAYS_PER_YEAR / SEASONS_PER_YEAR;

/** The chapter's years (an error for a chapter the pack does not have). */
export function packChapter(chapter: number): PackChapter {
  const found = CORE_PACK_SETTINGS.chapters.find(entry => entry.chapter === chapter);
  if (found === undefined) throw new Error(`pack has no chapter ${chapter}`);
  return found;
}

/** The year the era may begin (an error for an era the pack does not have). */
export function packEraYear(id: string): number {
  const found = CORE_PACK_SETTINGS.eras.find(entry => entry.id === id);
  if (found === undefined) throw new Error(`pack has no era "${id}"`);
  return found.fromYear;
}

/** The value of a money unit in the smallest unit (an error for a unit the pack does not have). */
export function currencyUnitValue(id: string): number {
  const found = CORE_PACK_SETTINGS.currency.units.find(unit => unit.id === id);
  if (found === undefined) throw new Error(`pack has no money unit "${id}"`);
  return found.value;
}

/** Years from the start to the tick's year (0 in the first year). */
export function yearIndexOf(tick: number): number {
  return Math.floor(Math.max(0, Math.floor(tick)) / YEAR_TICKS);
}

/** The first tick of the season (0 = the first) of a year, counted from the start year. */
export function tickOfSeason(year: number, season: number, startYear: number): number {
  return (year - startYear) * YEAR_TICKS + season * SEASON_TICKS;
}
