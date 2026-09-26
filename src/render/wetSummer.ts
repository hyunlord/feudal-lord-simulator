import type { GameState } from "../engine/engine.types";
import { weatherAt } from "../engine/eventSchedule";
import { stateCalendar } from "../engine/scenarioState";
import { presentationPreference } from "./presentationPreferences";
import { wave9Art, wave9Meta } from "./wave9Art";

// UI-4 (world before UI): a wet summer (F0-B weather, the dearth rehearsal's and the Great Famine's summers) shows on
// the land before any card: the growing strips blight and some flood (drawArableFields), puddles stand on the grass
// (seasonalDecals) and rain streaks over the view (this overlay; a setting turns it off). Pure in the state's tick.
export function wetSummer(state: Pick<GameState, "tick" | "scenarioId"> & Parameters<typeof weatherAt>[0]): boolean {
  return stateCalendar(state).season === 1 && weatherAt(state).kind === "wet";
}

const RAIN_FRAME_MS = 110;
const RAIN_ALPHA = 0.42;
let rainPatterns: { readonly context: CanvasRenderingContext2D; readonly patterns: (CanvasPattern | null)[] } | null = null;

/** Rain over the whole view (screen space, the sheet's four tiling frames). */
export function drawRainOverlay(context: CanvasRenderingContext2D, viewport: { readonly width: number; readonly height: number }, pixelRatio: number, nowMs: number): void {
  if (!presentationPreference("rainOverlay") || typeof document === "undefined" || typeof context.createPattern !== "function") return;
  const sheet = wave9Art("fx_rain_streak_sheet");
  if (sheet === null) return;
  const meta = wave9Meta("fx_rain_streak_sheet");
  const frames = "frames" in meta ? meta.frames : { width: meta.width, height: meta.height, count: 1 };
  if (rainPatterns === null || rainPatterns.context !== context) {
    // Cache (AGENTS rule 10): one pattern per sheet frame, keyed by the context (a new canvas makes new ones); reason:
    // cutting the frame into a canvas each frame is four drawImage + createPattern calls at 60 fps.
    rainPatterns = { context, patterns: Array.from({ length: frames.count }, (_, index) => {
      const cell = document.createElement("canvas"); cell.width = frames.width; cell.height = frames.height;
      cell.getContext("2d")?.drawImage(sheet, index * frames.width, 0, frames.width, frames.height, 0, 0, frames.width, frames.height);
      return context.createPattern(cell, "repeat");
    }) };
  }
  const pattern = rainPatterns.patterns[Math.floor(nowMs / RAIN_FRAME_MS) % frames.count];
  if (pattern === null || pattern === undefined) return;
  context.save();
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.globalAlpha = RAIN_ALPHA;
  context.fillStyle = pattern;
  context.fillRect(0, 0, viewport.width, viewport.height);
  context.restore();
}
