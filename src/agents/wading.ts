import type { TilePos } from "./walker.types";

/** FIX-10 (FD-2): a step onto or off a ford road goes at `1 / FORD_PACE_DIVISOR` of the walker's pace. */
export const FORD_PACE_DIVISOR = 2;

/** FD-2: the pace of a step from `from` to `to` — `pace`, or `pace / FORD_PACE_DIVISOR` when either end is a ford road. */
export function wadingPace(isFord: ((tile: TilePos) => boolean) | undefined, from: TilePos | undefined, to: TilePos | undefined, pace: number): number {
  return from !== undefined && to !== undefined && isFord !== undefined && (isFord(from) || isFord(to)) ? pace / FORD_PACE_DIVISOR : pace;
}
