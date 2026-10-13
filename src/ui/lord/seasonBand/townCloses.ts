import type { TownSnapshot } from "./seasonBandModel";

// LS1-5 (lord-screen-v1.md): the town at each season's close the screen saw (the season-turn band takes them), kept for
// the year card's "마을의 한 해": a year's start is the close of the winter before it (or a new game's first tick), its end
// its own winter's close. Kept for the page only (a load starts again: that year shows only what the engine's seasons say).

const closes = new Map<string, TownSnapshot>();
const KEEP = 12;

/** The town at the close of `season` (0 spring … 3 winter) of `year`. */
export function recordTownClose(year: number, season: number, snapshot: TownSnapshot): void {
  closes.set(`${year}:${season}`, snapshot);
  while (closes.size > KEEP) closes.delete(closes.keys().next().value!);
}

/** The town at the year's start and end, when the screen saw both. */
export function townYearEnds(year: number): Readonly<{ start: TownSnapshot; end: TownSnapshot }> | null {
  const start = closes.get(`${year - 1}:3`); const end = closes.get(`${year}:3`);
  return start === undefined || end === undefined ? null : { start, end };
}

/** Tests: start again. */
export function clearTownCloses(): void {
  closes.clear();
}
