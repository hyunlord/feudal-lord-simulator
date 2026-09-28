import type { WeatherKind } from "../content/eventConfig";

// INSTALL-23 proof hook: with `?phase10-proof=1`, `&weather=wet|dry|cold|normal|none` presents that weather and
// `&weather-tick=<0-999>` that moment of its season instead of the state's, so the captures show the four weathers
// on one scene (scripts/weatherCaptures.ts). Presentation only: the game state, its weather and everything that reads
// it (harvests, the arable fields, the puddle decals, the rain sound) are untouched. Outside proof mode it is inert.
export interface WeatherProofOverride {
  /** undefined: the state's weather; null: none. */
  readonly weather?: WeatherKind | null;
  readonly seasonTick?: number;
}

const KINDS: readonly WeatherKind[] = ["normal", "wet", "dry", "cold"];

export function parseWeatherProof(search: string): WeatherProofOverride | null {
  const query = new URLSearchParams(search);
  if (query.get("phase10-proof") !== "1") return null;
  const kind = query.get("weather");
  const tick = Number(query.get("weather-tick"));
  const override: { weather?: WeatherKind | null; seasonTick?: number } = {};
  if (kind === "none") override.weather = null;
  else if (kind !== null && (KINDS as readonly string[]).includes(kind)) override.weather = kind as WeatherKind;
  if (query.has("weather-tick") && Number.isInteger(tick) && tick >= 0 && tick < 1_000) override.seasonTick = tick;
  return override.weather === undefined && override.seasonTick === undefined ? null : override;
}

let parsed: WeatherProofOverride | null | undefined;

export function weatherProofOverride(): WeatherProofOverride | null {
  if (parsed === undefined) parsed = typeof window === "undefined" ? null : parseWeatherProof(window.location.search);
  return parsed;
}
