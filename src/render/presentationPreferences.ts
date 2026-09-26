// UI-4 / INSTALL-15 presentation switches (per browser, platform preferences; never saved in the game): the rain
// overlay of a wet summer, whether an arriving event's card stops time, and the season effects (falling leaves,
// snowfall). Defaults: rain on, stop off (UI-4: event cards are not modal), season effects on.
import { platformServices } from "../platform/platform";

export type PresentationPreference = "rainOverlay" | "eventPause" | "seasonFx";
const DEFAULTS: Readonly<Record<PresentationPreference, boolean>> = { rainOverlay: true, eventPause: false, seasonFx: true };
const KEY = (preference: PresentationPreference) => `feudal.presentation.${preference}`;
const values = new Map<PresentationPreference, boolean>();
const listeners = new Set<() => void>();

export function presentationPreference(preference: PresentationPreference): boolean {
  let value = values.get(preference);
  if (value === undefined) {
    let stored: string | null = null;
    try { stored = platformServices().preferences.get(KEY(preference)); } catch { stored = null; }
    value = stored === null ? DEFAULTS[preference] : stored === "1";
    values.set(preference, value);
  }
  return value;
}

export function setPresentationPreference(preference: PresentationPreference, value: boolean): void {
  try { platformServices().preferences.set(KEY(preference), value ? "1" : "0"); } catch { /* per session only */ }
  values.set(preference, value);
  for (const listener of listeners) listener();
}

export function subscribePresentationPreferences(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
