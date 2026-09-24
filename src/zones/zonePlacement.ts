/**
 * Placement rules v0 (spec Z-11) and the zone mismatch diagnostic (Z-8). The rules run only while at
 * least one zone exists; with no zone every answer equals `canPlaceBuilding` unchanged.
 *
 * The zone reasons are their own enum on purpose: `PlacementFailure` is switched over exhaustively by
 * render code this work may not touch, so the zone layer wraps the base check instead of widening it.
 */
import { BUILDING_CONFIG_BY_KIND, type Building, type BuildingKind } from "../content/buildingConfig";
import { ZONE_PLACEMENT_RULES } from "../content/zoneConfig";
import type { SourceRef } from "../contracts";
import { isBuildingConstructionSite } from "../economy/construction";
import type { GameState } from "../engine/engine.types";
import { canPlaceBuilding, type PlacementResult } from "../world/placement";
import { cellInsideWall, zonesOf } from "./zoneEdits";
import { interiorPlacementTiles } from "./zoneRaster";
import type { Zone, ZoneKind } from "./zone.types";

export enum ZonePlacementFailure {
  outside_zone = "outside_zone",
  arable_inside_wall = "arable_inside_wall",
}

export type ZonePlacementCheck =
  | { readonly ok: true; readonly rule: ZoneKind | null; readonly zoneId: string | null }
  | { readonly ok: false; readonly rule: ZoneKind; readonly reason: ZonePlacementFailure };

export type ZoneAwarePlacementResult =
  | PlacementResult
  | { readonly ok: false; readonly reason: ZonePlacementFailure; readonly rule: ZoneKind };

export function zoneRuleFor(kind: BuildingKind): ZoneKind | null {
  return (ZONE_PLACEMENT_RULES as Partial<Record<BuildingKind, ZoneKind>>)[kind] ?? null;
}

type ZonePlacementWorld = Pick<GameState, "zones" | "width" | "height" | "palisade">;

function footprintInsideWall(state: ZonePlacementWorld, kind: BuildingKind, tx: number, ty: number): boolean {
  const { width, height } = BUILDING_CONFIG_BY_KIND[kind];
  for (let dy = 0; dy < height; dy += 1) {
    for (let dx = 0; dx < width; dx += 1) if (cellInsideWall(state, (ty + dy) * state.width + tx + dx)) return true;
  }
  return false;
}

/** The zone of `rule` kind whose interior holds the `kind` footprint anchored at (tx,ty), if any. */
export function zoneHoldingFootprint(state: ZonePlacementWorld, rule: ZoneKind, kind: BuildingKind, tx: number, ty: number): Zone | null {
  if (tx < 0 || ty < 0 || tx >= state.width || ty >= state.height) return null;
  const { width, height } = BUILDING_CONFIG_BY_KIND[kind];
  const anchor = ty * state.width + tx;
  return zonesOf(state).find(zone => zone.kind === rule
    && interiorPlacementTiles(zone, { width, height }, state.width).has(anchor)) ?? null;
}

/** Z-11 on its own (no terrain, road or material checks). */
export function zonePlacementCheck(state: ZonePlacementWorld, kind: BuildingKind, tx: number, ty: number): ZonePlacementCheck {
  const rule = zoneRuleFor(kind);
  if (rule === null || zonesOf(state).length === 0) return { ok: true, rule: null, zoneId: null };
  if (rule === "arable" && footprintInsideWall(state, kind, tx, ty)) {
    return { ok: false, rule, reason: ZonePlacementFailure.arable_inside_wall };
  }
  const zone = zoneHoldingFootprint(state, rule, kind, tx, ty);
  return zone === null ? { ok: false, rule, reason: ZonePlacementFailure.outside_zone } : { ok: true, rule, zoneId: zone.id };
}

/** `canPlaceBuilding` followed by the zone rules; the base failure wins when both fail. */
export function canPlaceBuildingWithZones(state: GameState, kind: BuildingKind, tx: number, ty: number): ZoneAwarePlacementResult {
  const base = canPlaceBuilding(state, kind, tx, ty);
  if (!base.ok || zonesOf(state).length === 0) return base;
  const zone = zonePlacementCheck(state, kind, tx, ty);
  return zone.ok ? base : { ok: false, reason: zone.reason, rule: zone.rule };
}

export interface ZoneMismatch {
  readonly buildingId: string;
  readonly kind: BuildingKind;
  readonly rule: ZoneKind;
  readonly reason: "zone_mismatch";
  readonly sources: readonly SourceRef[];
}

/**
 * Z-8: houses and wheat farms (built or under construction) that are not inside a zone of their rule
 * kind while zones exist. Diagnostic only: nothing is moved or demolished.
 */
export function zoneMismatches(state: GameState): readonly ZoneMismatch[] {
  if (zonesOf(state).length === 0) return [];
  const placed: { readonly id: string; readonly kind: BuildingKind; readonly tx: number; readonly ty: number }[] = [
    ...state.buildings.map((building: Building) => ({ id: building.id, kind: building.kind, tx: building.tx, ty: building.ty })),
    ...state.constructionSites.filter(isBuildingConstructionSite).map(site => ({ id: site.id, kind: site.kind, tx: site.tx, ty: site.ty })),
  ];
  const mismatches: ZoneMismatch[] = [];
  for (const building of placed) {
    const rule = zoneRuleFor(building.kind);
    if (rule === null || zoneHoldingFootprint(state, rule, building.kind, building.tx, building.ty) !== null) continue;
    mismatches.push({ buildingId: building.id, kind: building.kind, rule, reason: "zone_mismatch",
      sources: [{ type: "building", id: building.id }] });
  }
  return mismatches;
}
