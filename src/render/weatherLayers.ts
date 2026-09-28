import type { WeatherKind } from "../content/eventConfig";
import type { GameState } from "../engine/engine.types";
import { weatherActive, weatherAt } from "../engine/eventSchedule";
import type { Wave23Key } from "./wave23ArtManifest.generated";

// INSTALL-23 weather in the world (Wave 23 weather art): the layers each engine weather draws, and their alphas. Pure
// in (the weather, the tick within its season, the two switches); the drawing is weatherOverlay.ts.
//  - wet: rain over the view (drizzle; the storm sheet at the height of the season, WET_STORM_* below), a faint overcast
//    tone, drifting fog banks over the shore water in the season's morning (WET_MORNING_TO; thinner after), and puddles
//    on the land (a wet sheen patch with a ripple on it);
//  - dry (a dry summer): dust gusts blowing across the view, cracked ground on open land;
//  - cold: two decks of cold mist drifting across the view over the frost tint;
//  - normal (clear): two decks of cloud shadows drifting over the land.
// The moving layers carry the weather (rain, fog, dust, mist, cloud shadows); the static tints only support it.
//
// The artist's cap (Wave 23 records, qa.combinedLayerCap): the applied globalAlpha summed over every layer that can
// cover one pixel is at most 0.38 (380 permille). INSTALL-23b (user judgement 2026-09-28): the cap holds for the layers
// that cover the view (tints, fog, mist, dust, sheen, cracks, cloud shadows); the rain streaks and the puddle ripples are
// outside it (`overCap`: the drizzle at 0.55, the storm at 0.7 — a wet season is the dearth's warning and the player must
// see it), and instead the rain's streaks cover at most RAIN_AREA_MAX of the view (the sheets' pixels over
// RAIN_ALPHA_FLOOR; the fainter halo is cleared when the cells are cut, weatherArt.ts). Each layer is
// placed so that one of its instances covers a pixel at most once (a fill; disjoint lanes; a tile lattice; spaced
// shore anchors; a drifting cloud lattice — weatherPlacement.ts), and the "water" layers (fog over the shore) and the
// "land" layers (puddles, sheen, cracks) never meet (the land spots keep clear of every fog bank's reach). So the
// alpha stacked on one pixel is the sum of the "all" layers plus the larger of the water and land sums (stackedPermille).
export const WEATHER_ALPHA_CAP_PERMILLE = 380;
/** INSTALL-23b: the rain layers' alpha (outside the cap): the wet season's drizzle and the storm at its height. */
export const DRIZZLE_PERMILLE = 550;
export const STORM_PERMILLE = 700;
/** The share of the view the rain's streaks may cover (drizzle and storm together while they cross-fade). */
export const RAIN_AREA_MAX = 0.12;
/** A rain sheet pixel at or under this alpha (of 255) is cleared when its cell is cut: at the storm's 0.7 it would draw
 * at most 2 % (5.6 / 255), and the storm sheet's streaks with their halo cover 13.3 % of a cell against 9.0 % without. */
export const RAIN_ALPHA_FLOOR = 8;
/** Rain: each sheet cell cut once at `scale` (longer, easier streaks; the halo cleared first, then scaled nearest so the
 * streaks' share of a cell stays what it was), repeated over the view unsmoothed, falling and slanting. */
export const RAIN_DRAW = {
  drizzle_sheet: { frameMs: 120, fallPxPerS: 320, slant: 0.18, scale: 1.5 },
  storm_rain_sheet: { frameMs: 80, fallPxPerS: 680, slant: 0.32, scale: 1.25 },
} as const;
export type RainSheet = keyof typeof RAIN_DRAW;
export const SEASON_TICKS = 1_000;
/** A new season's weather fades in over its first ticks (a season is 50 s at 1x). */
export const WEATHER_FADE_TICKS = 60;
/** A wet season's morning (its first quarter): fog along the water, a light drizzle, the puddles fresh. */
export const WET_MORNING_TO = 250;
/** The height of a wet season: the storm sheet instead of the drizzle (full from +50 to -50; cross-faded at each end). */
export const WET_STORM_FROM = 450;
export const WET_STORM_TO = 700;

export type WeatherBlend = "source-over" | "multiply" | "screen";
export type WeatherZone = "all" | "water" | "land";
export type WeatherPlacement = "fill" | "lanes" | "shore" | "lattice" | "clouds";

export interface WeatherLayer {
  readonly id: string;
  /** The art drawn (one or alternating variants). */
  readonly assets: readonly Wave23Key[];
  readonly blend: WeatherBlend;
  readonly alphaPermille: number;
  readonly moving: boolean;
  /** "view": screen space over the whole view; "world": anchored on the map (moves with the camera). */
  readonly space: "view" | "world";
  /** "ground": drawn in the ground pass (under buildings); "sky": over the world after the objects. */
  readonly pass: "ground" | "sky";
  readonly zone: WeatherZone;
  readonly placement: WeatherPlacement;
  /** Only rain: the rain switch ("rainOverlay") drops it. */
  readonly rain?: true;
  /** Outside the 0.38 cap (INSTALL-23b): the rain streaks and the puddle ripples. */
  readonly overCap?: true;
}

export interface WeatherInput {
  /** The engine weather of the season, or null when the scenario has no weather. */
  readonly weather: WeatherKind | null;
  /** Ticks into the season (0 … SEASON_TICKS - 1). */
  readonly seasonTick: number;
  /** The "weather effects" switch. */
  readonly enabled: boolean;
  /** The rain switch. */
  readonly rain: boolean;
}

type Def = Omit<WeatherLayer, "alphaPermille">;
const DEFS = {
  overcast: { id: "overcast", assets: ["overcast_tint"], blend: "multiply", moving: false, space: "view", pass: "sky", zone: "all", placement: "fill" },
  drizzle: { id: "drizzle", assets: ["drizzle_sheet"], blend: "source-over", moving: true, space: "view", pass: "sky", zone: "all", placement: "fill", rain: true, overCap: true },
  storm: { id: "storm", assets: ["storm_rain_sheet"], blend: "source-over", moving: true, space: "view", pass: "sky", zone: "all", placement: "fill", rain: true, overCap: true },
  riverFog: { id: "river_fog", assets: ["fog_bank_a", "fog_bank_b", "fog_bank_c"], blend: "source-over", moving: true, space: "world", pass: "sky", zone: "water", placement: "shore" },
  sheen: { id: "wet_sheen", assets: ["wet_ground_sheen"], blend: "screen", moving: false, space: "world", pass: "ground", zone: "land", placement: "lattice" },
  ripples: { id: "puddle_ripples", assets: ["puddle_ripple_sheet"], blend: "screen", moving: true, space: "world", pass: "ground", zone: "land", placement: "lattice", overCap: true },
  dust: { id: "dust_wind", assets: ["dry_dust_a", "dry_dust_b"], blend: "source-over", moving: true, space: "view", pass: "sky", zone: "all", placement: "lanes" },
  cracks: { id: "cracked_ground", assets: ["heat_cracked_ground"], blend: "multiply", moving: false, space: "world", pass: "ground", zone: "land", placement: "lattice" },
  frost: { id: "frost_tint", assets: ["frost_morning_tint"], blend: "source-over", moving: false, space: "view", pass: "sky", zone: "all", placement: "fill" },
  mist: { id: "cold_mist", assets: ["fog_bank_c", "fog_bank_b"], blend: "source-over", moving: true, space: "view", pass: "sky", zone: "all", placement: "lanes" },
  mistHigh: { id: "cold_mist_high", assets: ["fog_bank_a"], blend: "source-over", moving: true, space: "view", pass: "sky", zone: "all", placement: "lanes" },
  clouds: { id: "cloud_shadows", assets: ["cloud_shadow_a"], blend: "multiply", moving: true, space: "world", pass: "sky", zone: "all", placement: "clouds" },
  cloudsHigh: { id: "cloud_shadows_high", assets: ["cloud_shadow_b"], blend: "multiply", moving: true, space: "world", pass: "sky", zone: "all", placement: "clouds" },
} as const satisfies Record<string, Def>;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const layer = (def: Def, permille: number): WeatherLayer => ({ ...def, alphaPermille: Math.floor(permille) });
/** a + (b - a) w, in permille. */
const mixed = (a: number, b: number, w: number): number => a + (b - a) * w;

// A wet season through its ticks (permille; straight lines between the keys): overcast, drizzle, storm | fog | sheen,
// ripples. Under the cap (all + max(water, land), the rain and ripples not counted): the morning 140 | 180 | 60 = 320,
// the day 150 | 100 | 60 = 250, the storm 180 | 0 | 80 = 260. The sum is convex along a straight line between two keys,
// so it stays at or under the cap between them too (tests/weatherOverlay.test.ts checks every tick). Outside the cap:
// the drizzle 550 all season and the storm 700 at the height (cross-faded), the ripples at their art's 350. The
// overcast tone (INSTALL-23b: 140-180 of its art cap 180, was 60-80) darkens a wet season's view enough to tell it from
// a clear one in a still frame.
type WetMix = readonly [overcast: number, drizzle: number, storm: number, fog: number, sheen: number, ripples: number];
type WetKey = readonly [tick: number, ...mix: WetMix];
const MORNING: WetMix = [140, DRIZZLE_PERMILLE, 0, 180, 60, 350];
const DAY: WetMix = [150, DRIZZLE_PERMILLE, 0, 100, 60, 300];
const STORM: WetMix = [180, 0, STORM_PERMILLE, 0, 80, 350];
const WET_KEYS: readonly WetKey[] = [[0, ...MORNING], [WET_MORNING_TO, ...MORNING], [WET_MORNING_TO + 100, ...DAY], [WET_STORM_FROM, ...DAY],
  [WET_STORM_FROM + 50, ...STORM], [WET_STORM_TO - 50, ...STORM], [WET_STORM_TO, ...DAY], [SEASON_TICKS, ...DAY]];

function wetLayers(seasonTick: number): readonly WeatherLayer[] {
  const index = Math.max(0, WET_KEYS.findIndex((key, at) => seasonTick < (WET_KEYS[at + 1]?.[0] ?? Infinity) && seasonTick >= key[0]));
  const from = WET_KEYS[index]!; const to = WET_KEYS[index + 1] ?? from;
  const w = to[0] === from[0] ? 0 : clamp01((seasonTick - from[0]) / (to[0] - from[0]));
  const at = (column: 1 | 2 | 3 | 4 | 5 | 6) => mixed(from[column], to[column], w);
  return [
    layer(DEFS.overcast, at(1)), layer(DEFS.drizzle, at(2)), layer(DEFS.storm, at(3)),
    layer(DEFS.riverFog, at(4)), layer(DEFS.sheen, at(5)), layer(DEFS.ripples, at(6)),
  ].filter(entry => entry.alphaPermille > 0);
}

/** The share of the view the rain layers present cover: each sheet's streak share (pixels over RAIN_ALPHA_FLOOR, its
 * fullest cell) summed over the rain layers drawn (a bound: two sheets cross-fading may overlap). */
export function rainArea(layers: readonly WeatherLayer[], streakShare: (key: Wave23Key) => number): number {
  return layers.filter(entry => entry.rain === true).reduce((total, entry) => total + Math.max(...entry.assets.map(streakShare)), 0);
}

const LAYERS: Readonly<Record<Exclude<WeatherKind, "wet">, readonly WeatherLayer[]>> = {
  // dust 180 (its cap) over cracks 200 (under their cap 320): 380.
  dry: [layer(DEFS.dust, 180), layer(DEFS.cracks, 200)],
  // two decks of mist, 160 and 120 (the fog cap is 200), over the frost tint 100 (its cap): 380.
  cold: [layer(DEFS.mist, 160), layer(DEFS.mistHigh, 120), layer(DEFS.frost, 100)],
  // two decks of cloud shadows drifting at different speeds and sizes, each at its cap 120: 240 where they cross. (A
  // third deck measured 5.1 ms against 3.6 ms for two at zoom 1 on the Mac software raster, and did not read better.)
  normal: [layer(DEFS.clouds, 120), layer(DEFS.cloudsHigh, 120)],
};

/** The layers drawn now, with their alphas (the season's fade-in applied). Empty: nothing is drawn. */
export function weatherLayers(input: WeatherInput): readonly WeatherLayer[] {
  if (!input.enabled || input.weather === null) return [];
  const base = input.weather === "wet" ? wetLayers(input.seasonTick) : LAYERS[input.weather];
  const fade = clamp01(input.seasonTick / WEATHER_FADE_TICKS);
  return base.filter(entry => input.rain || entry.rain !== true)
    .map(entry => fade >= 1 ? entry : { ...entry, alphaPermille: Math.floor(entry.alphaPermille * fade) })
    .filter(entry => entry.alphaPermille > 0);
}

/** The most alpha the capped layers stack on one pixel (see the head comment): the "all" layers plus the larger zone;
 * the rain and ripples (`overCap`) are not counted. */
export function stackedPermille(layers: readonly WeatherLayer[]): number {
  const sum = (zone: WeatherZone) => layers.filter(entry => entry.zone === zone && entry.overCap !== true).reduce((total, entry) => total + entry.alphaPermille, 0);
  return sum("all") + Math.max(sum("water"), sum("land"));
}

/** The engine's weather now (null: the scenario has no weather) and the tick within its season. */
export function engineWeather(state: Pick<GameState, "tick" | "seed" | "scenarioId"> & Partial<Pick<GameState, "events" | "historicalEras">>):
  { readonly weather: WeatherKind | null; readonly seasonTick: number } {
  const seasonTick = ((state.tick % SEASON_TICKS) + SEASON_TICKS) % SEASON_TICKS;
  return { weather: weatherActive(state) ? weatherAt(state).kind : null, seasonTick };
}
