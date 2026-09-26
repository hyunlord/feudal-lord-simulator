import type { GameState } from "../engine/engine.types";
import { weatherAt } from "../engine/eventSchedule";
import { stateCalendar } from "../engine/scenarioState";
import { presentationPreference } from "./presentationPreferences";
import { wave9Art, wave9Meta } from "./wave9Art";
import { drawDepartures } from "./storyWorldProps";

// UI-4 (world before UI): a wet summer (F0-B weather, the dearth rehearsal's and the Great Famine's summers) shows on
// the land before any card: the growing strips blight and some flood (drawArableFields), puddles stand on the grass
// (seasonalDecals) and rain streaks over the view (this overlay; a setting turns it off). Pure in the state's tick.
export function wetSummer(state: Pick<GameState, "tick" | "scenarioId"> & Parameters<typeof weatherAt>[0]): boolean {
  return stateCalendar(state).season === 1 && weatherAt(state).kind === "wet";
}

const RAIN_FALL_PX_PER_S = 420;
const RAIN_ALPHA = 0.8;
let rainPattern: { readonly context: CanvasRenderingContext2D; readonly pattern: CanvasPattern | null } | null = null;

/** Rain over the whole view (screen space): the Wave 9 streak sheet as one repeating pattern, falling. */
export function drawRainOverlay(context: CanvasRenderingContext2D, viewport: { readonly width: number; readonly height: number }, pixelRatio: number, nowMs: number): void {
  if (!presentationPreference("rainOverlay") || typeof context.createPattern !== "function" || typeof DOMMatrix === "undefined") return;
  const sheet = wave9Art("fx_rain_streak_sheet");
  if (sheet === null) return;
  // Cache (AGENTS rule 10): the pattern, keyed by the context (a new canvas makes a new one); reason: createPattern
  // at 60 fps allocates a pattern per frame; measured nothing to measure (one object), kept for the allocation.
  if (rainPattern === null || rainPattern.context !== context) rainPattern = { context, pattern: context.createPattern(sheet, "repeat") };
  const pattern = rainPattern.pattern;
  if (pattern === null) return;
  const meta = wave9Meta("fx_rain_streak_sheet");
  pattern.setTransform(new DOMMatrix().translate(-(nowMs / 1000 * RAIN_FALL_PX_PER_S * 0.25) % meta.width, (nowMs / 1000 * RAIN_FALL_PX_PER_S) % meta.height));
  context.save();
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.globalAlpha = RAIN_ALPHA;
  context.fillStyle = pattern;
  context.fillRect(0, 0, viewport.width, viewport.height);
  context.restore();
}

/** UI-4 overlays over the world after the object pass: the S12 departures and a wet summer's rain. */
export function drawStoryWorldOverlays(context: CanvasRenderingContext2D, state: Parameters<typeof wetSummer>[0] & Parameters<typeof drawDepartures>[1],
  viewport: { readonly width: number; readonly height: number }, zoom: number, nowMs: number): void {
  drawDepartures(context, state, nowMs);
  if (!wetSummer(state)) return;
  const transform = typeof context.getTransform === "function" ? context.getTransform() : null;
  drawRainOverlay(context, viewport, transform === null ? 1 : transform.a / zoom, nowMs);
}
