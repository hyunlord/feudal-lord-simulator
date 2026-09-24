import type { BuildingKind } from '../content/buildingConfig';
import type { GameState } from '../engine/engine.types';
import type { TileCoordinate } from '../world/grid';
import { canPlaceBuilding } from '../world/placement';
import { ZONE_CAUSE_LABELS, ZONE_KIND_LABELS, ZONE_PREDICTION_COPY } from '../zones/zoneCopy.ko';
import { zonePaintAssessment, zonesOf } from '../zones/zoneEdits';
import { zoneMismatches, zonePlacementCheck, ZonePlacementFailure } from '../zones/zonePlacement';
import type { ZoneKind, ZoneStroke } from '../zones/zone.types';
import type { PredictionLine } from './predictionTypes';

/** Cause-registry rows for the zone placement reasons (spec Z-16), beside `PLACEMENT_REASON_LABELS`. */
export const ZONE_PLACEMENT_REASON_LABELS = {
  [ZonePlacementFailure.outside_zone]: ZONE_CAUSE_LABELS.outside_zone,
  [ZonePlacementFailure.arable_inside_wall]: ZONE_CAUSE_LABELS.arable_inside_wall,
} as const satisfies Record<ZonePlacementFailure, string>;

/**
 * Placement preview line for the zone rules. Empty while no zone exists or the building ignores zones.
 * "…안 · 배치 가능" only when the ordinary checks pass too; otherwise their own line explains the block.
 */
export function zonePlacementLines(state: GameState, kind: BuildingKind, tile: TileCoordinate): readonly PredictionLine[] {
  const check = zonePlacementCheck(state, kind, tile.tx, tile.ty);
  if (check.rule === null) return [];
  if (!check.ok) {
    const text = check.reason === ZonePlacementFailure.arable_inside_wall ? ZONE_PREDICTION_COPY.arableInsideWall
      : check.rule === 'burgage' ? ZONE_PREDICTION_COPY.outsideBurgage : ZONE_PREDICTION_COPY.outsideArable;
    return [{ id: 'zone', severity: 'block', text, sources: [] }];
  }
  if (!canPlaceBuilding(state, kind, tile.tx, tile.ty).ok) return [];
  const text = check.rule === 'burgage' ? ZONE_PREDICTION_COPY.insideBurgage : ZONE_PREDICTION_COPY.insideArable;
  return [{ id: 'zone', severity: 'ok', text, sources: check.zoneId === null ? [] : [{ type: 'zone', id: check.zoneId }] }];
}

/** Paint-stroke preview (for the C1b brush): cells the stroke would take, or why it is refused. */
export function zonePaintLines(state: GameState, kind: ZoneKind, stroke: ZoneStroke): readonly PredictionLine[] {
  const assessment = zonePaintAssessment(state, kind, stroke);
  if (assessment.ok) {
    const sources = assessment.mergeZoneIds.map(id => ({ type: 'zone' as const, id }));
    return [{ id: 'zone-paint', severity: 'ok', text: ZONE_PREDICTION_COPY.paintCells(ZONE_KIND_LABELS[kind], assessment.cells.length), sources }];
  }
  if (assessment.reason === 'arable_inside_wall') {
    return [{ id: 'zone-paint', severity: 'block', text: ZONE_PREDICTION_COPY.arableInsideWall, sources: [] }];
  }
  return [];
}

/** Diagnostic line for a building standing outside the zone its rule asks for (spec Z-8). */
export function zoneMismatchLines(state: GameState, buildingId: string): readonly PredictionLine[] {
  if (zonesOf(state).length === 0) return [];
  const mismatch = zoneMismatches(state).find(entry => entry.buildingId === buildingId);
  return mismatch === undefined ? [] : [{ id: 'zone-mismatch', severity: 'warn', text: ZONE_CAUSE_LABELS.zone_mismatch, sources: mismatch.sources }];
}
