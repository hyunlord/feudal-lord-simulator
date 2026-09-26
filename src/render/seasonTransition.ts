import type { GameState } from "../engine/engine.types";
import { FAST_PRESENTATION_SPEED, presentationSpeed } from "./presentationSpeed";
import { seasonOf, type SeasonIndex } from "./seasonArt";

// INSTALL-15 season change on screen: when the calendar season turns, the object pass crossfades each tree, shrub and
// orchard tree from its old season's art to the new one over SEASON_FADE_MS (and the ground chunks fade their new
// rasters in over the same time, groundChunkCache `fade`). At 5x the change is immediate (visibility design 5절). A
// jump of more than a season (a load, a proof scene) is not a change: it shows the new season at once.
// Presentation state only (the last season seen and when it changed), never saved.
export const SEASON_FADE_MS = 1_500;
const SEASON_TICKS = 1_000;

export type SeasonBlend = { readonly season: SeasonIndex; readonly from: SeasonIndex | null; readonly t: number };
let seen: { season: SeasonIndex; tick: number; from: SeasonIndex | null; startedMs: number } | null = null;

export function seasonFadeMs(): number {
  return presentationSpeed() >= FAST_PRESENTATION_SPEED ? 0 : SEASON_FADE_MS;
}

/** This frame's season and, while a change is fading, the season it fades from (t: 0 old .. 1 new). */
export function seasonBlend(state: Pick<GameState, "tick" | "scenarioId">, nowMs: number = performance.now()): SeasonBlend {
  const season = seasonOf(state);
  if (seen === null || Math.abs(state.tick - seen.tick) > SEASON_TICKS) {
    seen = { season, tick: state.tick, from: null, startedMs: nowMs };
  } else if (season !== seen.season) {
    seen = { season, tick: state.tick, from: seasonFadeMs() > 0 ? seen.season : null, startedMs: nowMs };
  } else seen.tick = state.tick;
  if (seen.from === null) return { season, from: null, t: 1 };
  const t = Math.min(1, Math.max(0, (nowMs - seen.startedMs) / SEASON_FADE_MS));
  if (t >= 1) seen.from = null;
  return { season, from: seen.from, t };
}

/** Tests: forget the last season seen. */
export function resetSeasonBlendForTest(): void { seen = null; }
