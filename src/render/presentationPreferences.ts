// UI-4 / INSTALL-15 / INSTALL-23 presentation switches (per browser, platform preferences; never saved in the game):
// the rain of a wet season, whether an arriving event's card stops time, the season effects (falling leaves,
// snowfall) and the weather effects (INSTALL-23: rain, fog, dust, mist, frost, cloud shadows; off draws none of them).
// Defaults: rain on, stop off (UI-4: event cards are not modal), season effects on, weather effects on. UI-7b: the
// developer display (how a portrait was chosen, on the biography and the person card), off. NAT-2: the QA info overlay
// (tick, camera, the last click, the selection; src/ui/qa), off. LM-R3 (the user's ruling 2026-10-09): the lord-mode
// auto-pause (src/ui/hud/useLordAutoPause.ts), on.
import { platformServices } from "../platform/platform";

export type PresentationPreference = "rainOverlay" | "eventPause" | "seasonFx" | "weatherFx" | "developerInfo" | "qaOverlay" | "lordAutoPause";
const DEFAULTS: Readonly<Record<PresentationPreference, boolean>> = { rainOverlay: true, eventPause: false, seasonFx: true, weatherFx: true, developerInfo: false, qaOverlay: false, lordAutoPause: true };
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
