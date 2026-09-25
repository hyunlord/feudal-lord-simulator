// RENDER_WALL_STRIPS: completed walls as extruded strips along the smoothed wall baseline, on top of the curved ground
// (RENDER_BOUNDARY_V2). History: D3b v1 strips were turned off by default (owner decision 2026-09-25, WL6: no wall
// walk or parapet, too light); D3b-2 v2 strips (face + top, Wave 4d) are on by default (owner approval 2026-09-25 of
// the three-way captures, WL8). Off (`render-wall-strips=0`), finished walls are the previous per-edge pieces. The
// shoreline shares the wall baseline either way; only the shore strip under a wall follows this flag (the face strip
// is what covers it). Precedence: URL query `render-wall-strips=1|0` > stored choice > default.

import { platformServices } from "../platform/platform";

export const RENDER_WALL_STRIPS_QUERY = "render-wall-strips";
export const RENDER_WALL_STRIPS_STORAGE_KEY = "feudal.renderWallStrips";
const RENDER_WALL_STRIPS_DEFAULT = true;

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
