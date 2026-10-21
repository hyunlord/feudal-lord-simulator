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

/** LS1-16: the wall's segments left at a close when fewer than at the close before it (the works went on), else null —
 * the engine's construction sites only; whether the wall holds the town stays the engine's growthBlock. */
export type WallProgress = Readonly<{ left: number; kind: "palisade" | "stone" }>;
export function wallProgressAt(year: number, season: number): WallProgress | null {
  const now = closes.get(`${year}:${season}`);
  const before = closes.get(season === 0 ? `${year - 1}:3` : `${year}:${season - 1}`);
  if (now === undefined || before === undefined || now.wallKind === null || now.wallLeft >= before.wallLeft) return null;
  return { left: now.wallLeft, kind: now.wallKind };
}

/** LS1-19: the wall a close's works were on (its snapshot's), null when it had none or the screen did not see it. */
export function wallKindAt(year: number, season: number): "palisade" | "stone" | null {
  return closes.get(`${year}:${season}`)?.wallKind ?? null;
}

/** The same at the latest close the screen saw. */
export function lastWallProgress(): WallProgress | null {
  const key = [...closes.keys()].at(-1);
  if (key === undefined) return null;
  const [year, season] = key.split(":").map(Number) as [number, number];
  return wallProgressAt(year, season);
}

/** Tests: start again. */
export function clearTownCloses(): void {
  closes.clear();
}
