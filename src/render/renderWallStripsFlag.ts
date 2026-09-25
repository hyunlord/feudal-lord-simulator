// RENDER_WALL_STRIPS: completed walls as extruded face strips along the smoothed wall baseline (D3b), on top of the
// curved ground (RENDER_BOUNDARY_V2). Default off (owner decision 2026-09-25: the strips have no wall walk or parapet
// and read too light to be walls); off, finished walls are the previous per-edge pieces. The shoreline keeps sharing
// the wall baseline, the water tint and the strip join fix either way; only the shore strip under a wall follows this
// flag (the face strip is what covers it). Precedence: URL query `render-wall-strips=1|0` > stored choice > default.

import { platformServices } from "../platform/platform";

export const RENDER_WALL_STRIPS_QUERY = "render-wall-strips";
export const RENDER_WALL_STRIPS_STORAGE_KEY = "feudal.renderWallStrips";
const RENDER_WALL_STRIPS_DEFAULT = false;

type FlagEnvironment = {
  readonly search?: string;
  readonly storage?: Pick<Storage, "getItem"> | null;
};

export function resolveWallStripsFlag(environment: FlagEnvironment): boolean {
  const query = new URLSearchParams(environment.search ?? "").get(RENDER_WALL_STRIPS_QUERY);
  if (query === "1" || query === "true") return true;
  if (query === "0" || query === "false") return false;
  let stored: string | null = null;
  try { stored = environment.storage?.getItem(RENDER_WALL_STRIPS_STORAGE_KEY) ?? null; } catch { stored = null; }
  if (stored === "1") return true;
  if (stored === "0") return false;
  return RENDER_WALL_STRIPS_DEFAULT;
}

function browserEnvironment(): FlagEnvironment {
  // The stored choice lives in the platform preferences (B9); the URL query stays a web-only override.
  const preferences = platformServices().preferences;
  return { search: typeof window === "undefined" ? "" : window.location.search, storage: { getItem: key => preferences.get(key) } };
}

let enabled = resolveWallStripsFlag(browserEnvironment());

export function wallStripsEnabled(): boolean {
  return enabled;
}

/** Tests and evidence runs. */
export function setWallStripsEnabled(value: boolean): void {
  enabled = value;
}
