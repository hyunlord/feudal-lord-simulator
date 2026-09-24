// RENDER_BOUNDARY_V2: curved ground (road ribbons, forest and field outlines, ground chunk cache). Default on since
// V1 (owner decision 2026-09-24, after the D1a gates); the settings toggle and `render-boundary-v2=0` turn it off. Precedence: URL query `render-boundary-v2=1|0` > the settings toggle (per browser) >
// default. With the flag off the renderer takes exactly the previous code path.

export const RENDER_BOUNDARY_V2_QUERY = "render-boundary-v2";
export const RENDER_BOUNDARY_V2_STORAGE_KEY = "feudal.renderBoundaryV2";
const RENDER_BOUNDARY_V2_DEFAULT = true;

type FlagEnvironment = {
  readonly search?: string;
  readonly storage?: Pick<Storage, "getItem"> | null;
};

export function resolveBoundaryV2Flag(environment: FlagEnvironment): boolean {
  const query = new URLSearchParams(environment.search ?? "").get(RENDER_BOUNDARY_V2_QUERY);
  if (query === "1" || query === "true") return true;
  if (query === "0" || query === "false") return false;
  let stored: string | null = null;
  try { stored = environment.storage?.getItem(RENDER_BOUNDARY_V2_STORAGE_KEY) ?? null; } catch { stored = null; }
  if (stored === "1") return true;
  if (stored === "0") return false;
  return RENDER_BOUNDARY_V2_DEFAULT;
}

function browserEnvironment(): FlagEnvironment {
  if (typeof window === "undefined") return {};
  let storage: Storage | null = null;
  try { storage = window.localStorage; } catch { storage = null; }
  return { search: window.location.search, storage };
}

let enabled = resolveBoundaryV2Flag(browserEnvironment());
const listeners = new Set<(value: boolean) => void>();

export function boundaryV2Enabled(): boolean {
  return enabled;
}

/** Settings toggle and tests. `persist` stores the choice for this browser (the URL query still wins on reload). */
export function setBoundaryV2Enabled(value: boolean, persist = false): void {
  if (persist && typeof window !== "undefined") {
    try { window.localStorage.setItem(RENDER_BOUNDARY_V2_STORAGE_KEY, value ? "1" : "0"); } catch { /* storage blocked */ }
  }
  if (enabled === value) return;
  enabled = value;
  for (const listener of listeners) listener(value);
}

export function subscribeBoundaryV2(listener: (value: boolean) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
