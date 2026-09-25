import { BUILDING_CONFIG_BY_KIND } from "../content/buildingConfig";
import type { GameState } from "../engine/engine.types";
import { zonesOf } from "../zones/zoneEdits";

/**
 * Origins whose farmstead footprint, or a cell next to it, lies in an arable zone: exactly the origins the zone rule
 * (zonePlacement `arableZoneBesideFootprint`, Z-11) can accept, so skipping the others changes no target (C1f 0-B).
 * Without an arable zone (every new game) the set is empty and the search stops at once: scanning every origin, and
 * again for every road the food-chain hint tries, cost ~300 ms per guidance update after C1c-2.
 * Cache (AGENTS rule 10): (a) keyed on the zones array identity (zone edits replace it); (b) the width is fixed per
 * map; nothing else is read; (c) new game: guidance update 260-400 ms -> see docs/verification/c1f-farmstead/REPORT.md.
 */
const arableOriginCache = new WeakMap<object, ReadonlySet<number>>();
export function arableAdjacentOrigins(state: Pick<GameState, "zones" | "width" | "height">): ReadonlySet<number> {
  const zones = zonesOf(state);
  const cached = arableOriginCache.get(zones);
  if (cached !== undefined) return cached;
  const { width: footprintWidth, height: footprintHeight } = BUILDING_CONFIG_BY_KIND.farmstead;
  const origins = new Set<number>();
  for (const zone of zones) {
    if (zone.kind !== "arable") continue;
    for (const index of zone.membership) {
      const cx = index % state.width; const cy = Math.floor(index / state.width);
      // The footprint's cells and their 4-neighbours: one cell beyond it on each side, but not the diagonal corners.
      for (let oy = cy - footprintHeight; oy <= cy + 1; oy += 1) {
        for (let ox = cx - footprintWidth; ox <= cx + 1; ox += 1) {
          const dx = cx - ox; const dy = cy - oy;
          const corner = (dx === -1 || dx === footprintWidth) && (dy === -1 || dy === footprintHeight);
          if (!corner && ox >= 0 && oy >= 0 && ox < state.width && oy < state.height) origins.add(oy * state.width + ox);
        }
      }
    }
  }
  arableOriginCache.set(zones, origins);
  return origins;
}

