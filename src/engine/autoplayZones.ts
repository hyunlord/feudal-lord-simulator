/**
 * DevAutoPlayer and the zone rules (spec Z-15a, C1c). Every autoplay candidate for a zone-ruled building
 * (house, wheat farm) is checked against the active zone rule, so the reducer never refuses an autoplay
 * placement for a zone reason. A candidate that still fails (a path this filter missed) is excluded for the
 * rest of that decision and counted, so the same refused placement is never proposed twice in a row.
 * With no zone of the rule's kind every answer equals `canPlaceBuilding(...).ok` (zone-free towns unchanged).
 */
import { BUILDING_CONFIG_BY_KIND, type BuildingKind } from "../content/buildingConfig";
import { zonesOf } from "../zones/zoneEdits";
import { canPlaceBuilding } from "../world/placement";
import { zonePlacementCheck } from "../zones/zonePlacement";
import type { AdvisorAction } from "./autoplayBotRecovery";
import type { GameState } from "./engine.types";

const excluded = new Set<string>();
let rejections = 0;

const key = (kind: BuildingKind, tx: number, ty: number) => `${kind}:${tx},${ty}`;

/** `canPlaceBuilding` plus the active zone rule and this decision's exclusions. */
export function autoplayCanPlace(state: GameState, kind: BuildingKind, tx: number, ty: number): boolean {
  if (!canPlaceBuilding(state, kind, tx, ty).ok) return false;
  if (excluded.size > 0 && excluded.has(key(kind, tx, ty))) return false;
  if (kind !== "farmstead" && coversArableCell(state, kind, tx, ty)) return false;
  return zonePlacementCheck(state, kind, tx, ty).ok;
}

/** AF-13: autoplay keeps buildings off its fields (an old farm was a building; a field is only cells). */
function coversArableCell(state: GameState, kind: BuildingKind, tx: number, ty: number): boolean {
  const arable = zonesOf(state).filter(zone => zone.kind === "arable");
  if (arable.length === 0) return false;
  const { width, height } = BUILDING_CONFIG_BY_KIND[kind];
  for (let dy = 0; dy < height; dy += 1) {
    for (let dx = 0; dx < width; dx += 1) {
      const index = (ty + dy) * state.width + tx + dx;
      if (arable.some(zone => zone.membership.includes(index))) return true;
    }
  }
  return false;
}

/** True when the action is a placement the zone rules refuse. */
export function zoneRefusesAction(state: GameState, action: AdvisorAction): boolean {
  return action.kind === "place_building" && !zonePlacementCheck(state, action.building, action.tx, action.ty).ok;
}

/** Excludes a refused placement for the rest of the current decision and counts it. */
export function excludeZoneRefusal(action: AdvisorAction): void {
  if (action.kind !== "place_building") return;
  excluded.add(key(action.building, action.tx, action.ty));
  rejections += 1;
}

export function clearZoneExclusions(): void {
  excluded.clear();
}

/** Zone-refused autoplay candidates caught since the last reset (gate ③ diagnostic). */
export function autoplayZoneRejections(): number {
  return rejections;
}

export function resetAutoplayZoneRejections(): void {
  rejections = 0;
}
