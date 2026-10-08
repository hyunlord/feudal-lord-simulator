import { useEffect, type ReactNode } from "react";

import type { AlertCrisis } from "../alertStackModel";
import { useUiParts } from "../lord/uiPartArt";

// INSTALL-18: the HUD's Wave 18 pictures (catalog bundle `ui-wave18-hud`, renderer B's `ui-image` kind, through LM-R2's
// screen-part loader). A picture shows only once it has loaded at one of its declared CSS widths, in the same box the
// current icon had; until then — and when it is missing or fails — the current icon (the fallback) stays. HUD pictures
// load with the HUD (they cannot wait for a screen).

export const HUD_ART = {
  population: "hud.main.pill_population", food: "hud.main.pill_food_days", money: "hud.main.pill_money",
  build: "hud.main.dock_build", ledger: "hud.main.dock_ledger",
  lock: "hud.misc.layer_lock_badge", confirm: "hud.misc.confirm_check_touch", cancel: "hud.misc.cancel_touch",
  brush: "hud.zone.zone_brush", polygon: "hud.zone.zone_polygon", erase: "hud.zone.zone_erase", undo: "hud.zone.zone_undo",
  redo: "hud.zone.zone_redo", sizeSmall: "hud.zone.zone_size_small", sizeLarge: "hud.zone.zone_size_large", barred: "hud.zone.zone_paint_forbidden",
} as const;

/** The crisis pictures by alert kind (alertStackModel `crisis`); a row without one keeps the Wave 8 bell. */
export const CRISIS_ART: Readonly<Record<AlertCrisis, string>> = {
  fire: "hud.crisis.crisis_fire", household_leaving: "hud.crisis.crisis_household_leaving", construction_blocked: "hud.crisis.crisis_construction_blocked",
  upkeep_unpaid: "hud.crisis.crisis_upkeep_unpaid", storage_full: "hud.crisis.crisis_storage_full", food_shortage: "hud.crisis.crisis_food_shortage",
};

/** The brush-size button: small at 18 for 1 tile, the large stamp at 14 for 2 and at 18 for 3 (two pictures, three sizes:
 * the stamps' painted diameters then read about 6 / 11 / 14 px, the order of the old dots 6 / 11 / 16). */
export const ZONE_SIZE_ART: Readonly<Record<1 | 2 | 3, readonly [string, number]>> = {
  1: [HUD_ART.sizeSmall, 18], 2: [HUD_ART.sizeLarge, 14], 3: [HUD_ART.sizeLarge, 18],
};

const PULSE_RING = "hud.misc.pulse_ring";
const PULSE_RING_WIDTH = 288;

/** One HUD picture at `width` CSS px with the fallback's class (so the HUD's layout rules still apply), or the fallback. */
export function HudArt({ id, width, className, fallback, label }: {
  readonly id: string; readonly width: number; readonly className: string; readonly fallback: ReactNode; readonly label?: string;
}) {
  const style = useUiParts([id]).image(id, width);
  if (style === null) return <>{fallback}</>;
  return label === undefined
    ? <span className={className} aria-hidden="true" data-art={id} style={style} />
    : <span className={className} role="img" aria-label={label} data-art={id} style={style} />;
}

/**
 * The tutorial pulse's ring (tutorial.css): once the three-frame sheet has loaded, its URL goes on the root as
 * `--hud-pulse-ring` with `data-hud-pulse-ring`, and the HUD's pulsing buttons play its frames instead of the gold
 * box-shadow. Not loaded (or failed): nothing is set and the box-shadow pulse stays.
 */
export function useHudPulseRing(): void {
  const background = useUiParts([PULSE_RING]).image(PULSE_RING, PULSE_RING_WIDTH)?.backgroundImage;
  useEffect(() => {
    if (typeof background !== "string" || typeof document === "undefined") return undefined;
    const root = document.documentElement;
    root.style.setProperty("--hud-pulse-ring", background);
    root.dataset.hudPulseRing = "ready";
    return () => { root.style.removeProperty("--hud-pulse-ring"); delete root.dataset.hudPulseRing; };
  }, [background]);
}
