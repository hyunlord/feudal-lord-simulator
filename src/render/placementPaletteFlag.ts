// UX-3 S-52 colourblind mode: the placement "fine" colour turns from green to blue (the blocked colour keeps its 45°
// hatch and reason icon, so the two never differ by colour alone). Precedence: URL query `colorblind=1|0` > the
// settings toggle (platform preferences) > off.
import { platformServices } from "../platform/platform";

export const PLACEMENT_COLORBLIND_QUERY = "colorblind";
export const PLACEMENT_COLORBLIND_STORAGE_KEY = "feudal.placementColorblind";

export function resolveColorblind(search: string, stored: string | null): boolean {
  const query = new URLSearchParams(search).get(PLACEMENT_COLORBLIND_QUERY);
  if (query === "1" || query === "true") return true;
  if (query === "0" || query === "false") return false;
  return stored === "1";
}

function initial(): boolean {
  let stored: string | null = null;
  try { stored = platformServices().preferences.get(PLACEMENT_COLORBLIND_STORAGE_KEY); } catch { stored = null; }
  return resolveColorblind(typeof window === "undefined" ? "" : window.location.search, stored);
}

let enabled: boolean | null = null;
const listeners = new Set<(value: boolean) => void>();

export function colorblindEnabled(): boolean {
  enabled ??= initial();
  return enabled;
}

export function setColorblindEnabled(value: boolean, persist = false): void {
  if (persist) platformServices().preferences.set(PLACEMENT_COLORBLIND_STORAGE_KEY, value ? "1" : "0");
  if (colorblindEnabled() === value) return;
  enabled = value;
  for (const listener of listeners) listener(value);
}

export function subscribeColorblind(listener: (value: boolean) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
