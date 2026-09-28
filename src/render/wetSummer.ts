import type { GameState } from "../engine/engine.types";
import { weatherAt } from "../engine/eventSchedule";
import { stateCalendar } from "../engine/scenarioState";
import { drawDepartures } from "./storyWorldProps";
import { drawSeasonFx } from "./seasonFx";
import { drawWeatherSky } from "./weatherOverlay";

// UI-4 (world before UI): a wet summer (F0-B weather, the dearth rehearsal's and the Great Famine's summers) shows on
// the land before any card: the growing strips blight and some flood (drawArableFields), puddles stand on the grass
// (seasonalDecals). Pure in the state's tick. INSTALL-23: the rain over the view is now the weather overlay's
// (weatherOverlay.ts, Wave 23 drizzle and storm within the artist's 0.38 cap) in every wet season; the Wave 9 streak
// sheet at alpha 0.8 is retired.
export function wetSummer(state: Pick<GameState, "tick" | "scenarioId"> & Parameters<typeof weatherAt>[0]): boolean {
  return stateCalendar(state).season === 1 && weatherAt(state).kind === "wet";
}

/** UI-4 overlays over the world after the object pass: the S12 departures, the season effects (INSTALL-15: falling
 * leaves and the first snow) and the weather (INSTALL-23). */
export function drawStoryWorldOverlays(context: CanvasRenderingContext2D, state: GameState,
  viewport: { readonly width: number; readonly height: number }, zoom: number, nowMs: number): void {
  drawDepartures(context, state, nowMs);
  drawSeasonFx(context, state, viewport, zoom, nowMs);
  drawWeatherSky(context, state, viewport, zoom, nowMs);
}
