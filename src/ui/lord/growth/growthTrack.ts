import type { GrowthBlock } from "../../../engine/growthBlock";

// LS1-3 (lord-screen-v1.md; the user's rulings 2026-10-13): how long a stop has lasted, as the screen saw it. A stop is
// the town not growing — neither its houses nor its people above what they were when it last grew — while the engine's
// growthBlock stands: growthBlock alone names what holds the town's next step and stands while the town still grows
// (LS1-6: seed 1 grew from 4 to 24 houses under it), so a close the town grew at ends the count (A4). Its years are said
// only when the screen saw the stop begin (a new game, or growth seen before it this session); after a load the first
// close only takes the town's size, and a stop is "정체 중", no number (a load's "1년" may be the eighth — A4, P-C4). The
// engine's `since` (v56) replaces this count when it comes. Kept for the page.

/** The town's size the count compares: the houses and the people. */
export type GrowthTown = Readonly<{ houses: number; population: number }>;
type Close = Readonly<{ year: number; season: number; reason: GrowthBlock["reason"] | null; detail: string | null;
  /** The stop had held past two closes at this one (the screen said so: the band's line, the pill's mark). */
  marked: boolean }>;
const state = { known: false, run: 0, start: null as Readonly<{ year: number; season: number }> | null, top: null as GrowthTown | null, closes: [] as Close[] };
const KEEP = 16;
/** The closes a stop holds before the screen says so ("2철 넘게"). */
export const GROWTH_HELD_CLOSES = 2;

/**
 * A page's start: a new game knows the town's growth from its first tick (its size then), a load does not. `held`: the
 * audit's query `growth-held=<n>` — a loaded state counted as a stop the screen saw hold n closes (its size the top), so
 * a geometry row can show the stop's mark, panel and chip without waiting seasons (as `season-band-ms` holds the band).
 */
export function startGrowthTrack(newGame: boolean, town: GrowthTown | null = null, held = 0): void {
  state.known = newGame; state.run = held; state.start = null; state.closes = [];
  state.top = newGame || held > 0 ? town : null;
}

/** The query's count (0 without it). */
export function growthHeldQuery(): number {
  if (typeof window === "undefined") return 0;
  const value = Number(new URLSearchParams(window.location.search).get("growth-held"));
  return Number.isInteger(value) && value > 0 ? value : 0;
}

/** A season's close, the engine's block at it and the town's size. */
export function noteGrowthClose(year: number, season: number, block: GrowthBlock | null, town: GrowthTown): void {
  const top = state.top;
  const grew = top !== null && (town.houses > top.houses || town.population > top.population);
  state.top = top === null ? town : { houses: Math.max(top.houses, town.houses), population: Math.max(top.population, town.population) };
  if (top === null || grew || block === null) {
    // A load's first close takes the size only; growth, or nothing holding the town, ends a stop (and is seen begin).
    if (top !== null) state.known = true;
    state.run = 0; state.start = null;
  } else {
    if (state.run === 0) state.start = { year, season };
    state.run += 1;
  }
  state.closes.push({ year, season, reason: block?.reason ?? null, detail: block?.detail ?? null, marked: state.run > GROWTH_HELD_CLOSES });
  while (state.closes.length > KEEP) state.closes.shift();
}

export type GrowthRun = Readonly<{ closes: number; known: boolean; start: Readonly<{ year: number; season: number }> | null }>;

/** The stop now: the closes in a row it held, whether the screen saw it begin, and the close it was first seen at. */
export function growthRun(): GrowthRun {
  return { closes: state.run, known: state.known, start: state.start };
}

/** The year's closes the screen said the town was held at, and the last cause among them. */
export function growthYear(year: number): Readonly<{ seasons: number; last: Close | null }> {
  const held = state.closes.filter(close => close.year === year && close.marked && close.reason !== null);
  return { seasons: held.length, last: held.at(-1) ?? null };
}
