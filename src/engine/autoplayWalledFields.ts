/**
 * AR-9 (F0-B guardrail run 1, seed 3): a walled town that encloses its own fields runs short of house sites. The
 * interior sites it can still build on are fewer than the lots it still needs, the interior-plot rule (AR-7) then
 * refuses the one road that would open a site, and the town stops at 13 lots for good. The lord gives the fields
 * inside the wall over to house plots: the arable zone inside the wall is erased (one polygon stroke along the wall),
 * and the bot's arable step paints the lost fields again outside (arable land inside the wall is refused, Z-9a).
 * Only when every zone cell inside the wall is arable: burgage plots inside are never erased.
 */
import { isBuildingConstructionSite } from "../economy/construction";
import type { GameState } from "./engine.types";
import type { AutoplayAction } from "./autoplay.types";
import { insideWall } from "./autoplayBotRecovery";
import { housingLotsStillNeeded, interiorHouseSites } from "./autoplayInteriorPlots";
import { autoplayCanPlace } from "./autoplayZones";
import { zonesOf } from "../zones/zoneEdits";

const NONE = { kind: "none" } as const satisfies AutoplayAction;

/** AR-9: zone cells inside the wall, by kind. */
function interiorZoneCells(state: GameState): { readonly arable: number; readonly other: number } {
  let arable = 0;
  let other = 0;
  for (const zone of zonesOf(state)) {
    for (const index of zone.membership) {
      if (!insideWall(state, "house", { tx: index % state.width, ty: Math.floor(index / state.width) })) continue;
      if (zone.kind === "arable") arable += 1; else other += 1;
    }
  }
  return { arable, other };
}

export function walledFieldsAction(state: GameState, targetLots: number): AutoplayAction {
  if (state.palisade === null || state.constructionSites.some(site => isBuildingConstructionSite(site) && site.kind === "house")) return NONE;
  const needed = housingLotsStillNeeded(state, targetLots);
  if (needed === 0) return NONE;
  const sites = interiorHouseSites(state).filter(site => autoplayCanPlace(state, "house", site.tx, site.ty, "later")).length;
  if (sites >= needed) return NONE;
  const cells = interiorZoneCells(state);
  if (cells.arable === 0 || cells.other > 0) return NONE;
  return { kind: "erase_zone", stroke: { tool: "polygon", points: state.palisade.polygon.map(point => ({ x: point.x, y: point.y })) } };
}
