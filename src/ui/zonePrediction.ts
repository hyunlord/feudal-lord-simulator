import type { BuildingKind } from '../content/buildingConfig';
import type { GameState } from '../engine/engine.types';
import type { TileCoordinate } from '../world/grid';
import { canPlaceBuilding } from '../world/placement';
import { ZONE_CAUSE_LABELS, ZONE_KIND_LABELS, ZONE_PREDICTION_COPY } from '../zones/zoneCopy.ko';
import { paintZone, zonePaintAssessment, zonesOf } from '../zones/zoneEdits';
import { arableLayouts, stripSeasonYield, stripTending } from '../zones/arableFields';
import { ARABLE_PREDICTION_COPY } from '../zones/arableCopy.ko';
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
    const lines: PredictionLine[] = [{ id: 'zone-paint', severity: 'ok', text: ZONE_PREDICTION_COPY.paintCells(ZONE_KIND_LABELS[kind], assessment.cells.length), sources }];
    if (assessment.excludedInsideWall > 0) lines.push({ id: 'zone-paint-wall', severity: 'warn', text: ZONE_PREDICTION_COPY.excludedInsideWall(assessment.excludedInsideWall), sources: [] });
    if (kind === 'arable') lines.push(...arablePaintLines(state, stroke, sources));
    return lines;
  }
  if (assessment.reason === 'arable_inside_wall') {
    return [{ id: 'zone-paint', severity: 'block', text: ZONE_PREDICTION_COPY.arableInsideWall, sources: [] }];
  }
  return [];
}

/**
 * AF-10: what the painted field adds — its cultivable cells and a season's wheat — and whether a farmstead reaches
 * it or one must be built (`경작 N칸 · 연간 밀 약 M`, `헛간 1개 필요` / `기존 헛간이 맡음`).
 */
function arablePaintLines(state: GameState, stroke: ZoneStroke, sources: PredictionLine['sources']): readonly PredictionLine[] {
  const before = arableLayouts(state);
  const projected = paintZone(state, 'arable', stroke);
  const after = arableLayouts(projected);
  const cells = (layouts: typeof before) => layouts.reduce((sum, layout) => sum + layout.strips.reduce((total, strip) => total + strip.cells.length, 0), 0);
  const wheat = (layouts: typeof before) => layouts.reduce((sum, layout) => sum + layout.strips.reduce((total, strip) => total + stripSeasonYield(strip), 0), 0);
  const tending = stripTending(projected, after);
  const untended = after.some(layout => layout.strips.some(strip => tending.get(strip.id)?.status !== 'tended'));
  return [
    { id: 'arable-yield', severity: 'ok', text: ARABLE_PREDICTION_COPY.fieldYield(cells(after) - cells(before), wheat(after) - wheat(before)), sources },
    untended ? { id: 'arable-farmstead', severity: 'warn', text: ARABLE_PREDICTION_COPY.farmsteadNeeded, sources: [] }
      : { id: 'arable-farmstead', severity: 'ok', text: ARABLE_PREDICTION_COPY.farmsteadTends, sources: [] },
  ];
}

/** Diagnostic line for a building standing outside the zone its rule asks for (spec Z-8). */
export function zoneMismatchLines(state: GameState, buildingId: string): readonly PredictionLine[] {
  if (zonesOf(state).length === 0) return [];
  const mismatch = zoneMismatches(state).find(entry => entry.buildingId === buildingId);
  return mismatch === undefined ? [] : [{ id: 'zone-mismatch', severity: 'warn', text: ZONE_CAUSE_LABELS.zone_mismatch, sources: mismatch.sources }];
}
