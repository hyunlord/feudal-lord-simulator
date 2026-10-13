import type { GrowthBlock } from "../../../engine/growthBlock";

// LS1-3 (lord-screen-v1.md; the user's ruling 2026-10-13): how long a stop has lasted, as the screen saw it — the season
// closes in a row at which the engine's growthBlock held. Its years are said only when the screen saw the stop begin
// (a new game, or growth seen before it this session); after a load the stop is "정체 중", no number (a load's "1년"
// may be the eighth — A4, P-C4). The engine's `since` (v56) replaces this count when it comes. Kept for the page.

type Close = Readonly<{ year: number; season: number; reason: GrowthBlock["reason"] | null; detail: string | null }>;
const state = { known: false, run: 0, start: null as Readonly<{ year: number; season: number }> | null, closes: [] as Close[] };
const KEEP = 16;

/** A page's start: a new game knows the town's growth from its first tick; a load does not. */
export function startGrowthTrack(newGame: boolean): void {
  state.known = newGame; state.run = 0; state.start = null; state.closes = [];
}

/** A season's close and the engine's block at it. */
export function noteGrowthClose(year: number, season: number, block: GrowthBlock | null): void {
  state.closes.push({ year, season, reason: block?.reason ?? null, detail: block?.detail ?? null });
  while (state.closes.length > KEEP) state.closes.shift();
  if (block === null) { state.known = true; state.run = 0; state.start = null; return; }
  if (state.run === 0) state.start = { year, season };
  state.run += 1;
}

export type GrowthRun = Readonly<{ closes: number; known: boolean; start: Readonly<{ year: number; season: number }> | null }>;

/** The stop now: the closes in a row it held, whether the screen saw it begin, and the close it was first seen at. */
export function growthRun(): GrowthRun {
  return { closes: state.run, known: state.known, start: state.start };
}

/** The year's closes the screen saw the town held at, and the last cause among them. */
export function growthYear(year: number): Readonly<{ seasons: number; last: Close | null }> {
  const held = state.closes.filter(close => close.year === year && close.reason !== null);
  return { seasons: held.length, last: held.at(-1) ?? null };
}
