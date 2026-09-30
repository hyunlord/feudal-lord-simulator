import type { WeatherKind } from "../content/eventConfig";
import { renderDetailLevel } from "./buildingVisualState";
import type { SeasonIndex } from "./seasonArt";
import { mix } from "./weatherPlacement";
import { WAVE29_WATER, type Wave29WaterKey } from "./wave29WaterManifest.generated";

// INSTALL-29 water motion: which effects are drawn, and which frame. Pure in (the weather, the season, the zoom, the
// wall clock); the placements are waterMotionPlacement.ts, the drawing drawWaterMotion.ts.
//
// Conditions (the batch's records/assets.csv `activation_condition`):
//  - deep ripples (`ripple_sheet`): the deep water, every weather;
//  - shallow ripples (`ripple_shallow_sheet`): only inside the shallow mask (waterMotionPlacement.ts), never the lake;
//  - river flow (`current_arrows_{ne,nw,se,sw}_sheet`): on the river tiles, by the river's direction there;
//  - shore foam (`shore_foam_sheet`): along the shore strips, except in winter (the ice rim takes its place);
//  - ice rim (`ice_edge`, static): along the shore strips in winter (season 3, which holds every cold weather: the
//    engine's cold weather only falls in winter, WEATHER_TABLE). Static art, so it is painted into the ground chunks
//    with the strips (the season is in their key) and costs no frame time;
//  - reeds (`reeds_sway_{a,b,c}_sheet`): the existing reeds a / b / c, same canvas and registration;
//  - sun glints (`sparkle`): only on a clear day (the engine's "normal" weather, or a scenario without weather), sparse;
//  - fish rings (`fish_ring`): an occasional single cycle at a spot, 8-20 s apart, deterministic by the spot and the clock;
//  - mill race (`mill_race_sheet`): registered, not drawn — the game has no watermill (its mill is a post windmill, and
//    the mill race is the leat of a water wheel, not a windmill's: records/README.md).
//
// Clock: the frame's wall clock `nowMs` (the renderer's), like the smoke and the weather, so the water keeps moving
// while the game is paused. Not the life clock (lifeClock.ts), which holds while paused, and not the game tick.
//
// Detail (renderDetailLevel): full (zoom > 0.7) draws everything; simplified (0.35 < zoom <= 0.7) keeps the area fills
// only (deep ripples, river flow: their cost is bounded by the screen, and they carry the water's motion) and drops
// the shallow ripples, the foam (one fill per shore segment, which grows as the view widens), the swaying reeds (the
// chunks' static reeds instead), the glints and the fish rings (a few pixels wide there); blocks (zoom <= 0.35) draws
// no motion (the chunks' still water, with the ice rim in winter).
export const WINTER: SeasonIndex = 3;
export const FISH_INTERVAL_MS = { min: 8_000, max: 20_000 } as const;
export const REED_SHEETS = ["reeds_sway_a_sheet", "reeds_sway_b_sheet", "reeds_sway_c_sheet"] as const satisfies readonly Wave29WaterKey[];
export const FLOW_SHEETS = { ne: "current_arrows_ne_sheet", nw: "current_arrows_nw_sheet", se: "current_arrows_se_sheet", sw: "current_arrows_sw_sheet" } as const satisfies Record<string, Wave29WaterKey>;
export type FlowDirection = keyof typeof FLOW_SHEETS;
export const FLOW_DIRECTIONS = Object.keys(FLOW_SHEETS) as FlowDirection[];

export interface WaterMotionPlan {
  readonly deepRipples: boolean;
  readonly shallowRipples: boolean;
  readonly flow: boolean;
  readonly foam: boolean;
  readonly reeds: boolean;
  readonly glints: boolean;
  readonly fish: boolean;
}

/** A clear day: the engine's normal weather, or no weather at all (null: the scenario has none). */
export const clearWeather = (weather: WeatherKind | null): boolean => weather === null || weather === "normal";
/** The ice rim's season (baked into the ground chunks, whose key carries the season). */
export const iceSeason = (season: SeasonIndex): boolean => season === WINTER;
/** The swaying reeds are drawn live (and the chunks leave their static reeds out) at full detail only. */
export const liveReedsAt = (zoom: number): boolean => renderDetailLevel(zoom) === "full";

export function waterMotionPlan(zoom: number, weather: WeatherKind | null, season: SeasonIndex): WaterMotionPlan {
  const level = renderDetailLevel(zoom);
  const full = level === "full";
  const any = level !== "blocks";
  return {
    deepRipples: any, flow: any,
    shallowRipples: full, reeds: full, fish: full,
    foam: full && !iceSeason(season),
    glints: full && clearWeather(weather),
  };
}

/** The frame of a looping sheet at `nowMs` (+ a spot's phase), at the sheet's fps; a static sheet (fps 0) is frame 0. */
export function waterFrame(key: Wave29WaterKey, nowMs: number, phaseMs = 0): number {
  const sheet = WAVE29_WATER[key];
  if (sheet.fps <= 0 || sheet.frames <= 1) return 0;
  const index = Math.floor(((nowMs + phaseMs) * sheet.fps) / 1000);
  return ((index % sheet.frames) + sheet.frames) % sheet.frames;
}

/** The source rect of `frame` in its sheet: one row left to right, no margins, so frame i is [i w, (i + 1) w) x [0, h). */
export function waterFrameRect(key: Wave29WaterKey, frame: number): { readonly x: number; readonly y: number; readonly width: number; readonly height: number } {
  const sheet = WAVE29_WATER[key];
  const index = ((Math.floor(frame) % sheet.frames) + sheet.frames) % sheet.frames;
  return { x: index * sheet.frameWidth, y: 0, width: sheet.frameWidth, height: sheet.frameHeight };
}

/**
 * A fish ring at the spot of `hash`: each spot has its own period of 8-20 s (FISH_INTERVAL_MS) and plays the sheet
 * once (6 frames at 6 fps) at a hashed moment inside each period; null between rings. Deterministic in (hash, nowMs).
 */
export function fishRingFrame(hash: number, nowMs: number): number | null {
  const sheet = WAVE29_WATER.fish_ring;
  const duration = (sheet.frames * 1000) / sheet.fps;
  const period = FISH_INTERVAL_MS.min + (hash % (FISH_INTERVAL_MS.max - FISH_INTERVAL_MS.min + 1));
  const shifted = nowMs + (mix(hash, 29_307) % period);
  const cycle = Math.floor(shifted / period);
  const start = mix(hash, cycle, 29_311) % Math.max(1, period - duration);
  const local = shifted - cycle * period - start;
  if (local < 0 || local >= duration) return null;
  return Math.min(sheet.frames - 1, Math.floor((local * sheet.fps) / 1000));
}
