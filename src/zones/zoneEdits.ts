/**
 * Zone edits: `zone_paint`, `zone_erase`, `zone_remove` (spec Z-5…Z-9). Edits change zones only; no
 * building, construction site or road ever moves or disappears because of them (Z-8).
 */
import { ZONE_KIND_CONFIG } from "../content/zoneConfig";
import type { GameState } from "../engine/engine.types";
import type { TileCoordinate } from "../geometry/tileGeometry";
import { isPointInsidePalisade } from "../world/palisadeGeometry";
import { cellCoordinate, normalizeZoneStroke, rasterizeZoneStroke } from "./zoneRaster";
import { ZONE_KINDS, type Zone, type ZoneKind, type ZoneStroke } from "./zone.types";

type ZoneWorld = Pick<GameState, "width" | "height" | "tiles" | "palisade" | "zones" | "nextZoneOrdinal">;

export function zonesOf(state: Pick<GameState, "zones">): readonly Zone[] {
  return state.zones ?? [];
}

export function zoneIdFor(ordinal: number): string {
  return `zone-${String(ordinal).padStart(6, "0")}`;
}

export function isZoneKind(value: unknown): value is ZoneKind {
  return typeof value === "string" && (ZONE_KINDS as readonly string[]).includes(value);
}

/** The zone that owns `tile`, or null. */
export function zoneAt(state: Pick<GameState, "zones" | "width">, tile: TileCoordinate): Zone | null {
  const index = tile.ty * state.width + tile.tx;
  return zonesOf(state).find(zone => binaryHas(zone.membership, index)) ?? null;
}

function binaryHas(sorted: readonly number[], value: number): boolean {
  let low = 0;
  let high = sorted.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const at = sorted[mid]!;
    if (at === value) return true;
    if (at < value) low = mid + 1;
    else high = mid - 1;
  }
  return false;
}

/** True when the cell centre lies inside the proclaimed wall line (same test the wall rules use). */
export function cellInsideWall(state: Pick<GameState, "palisade" | "width">, index: number): boolean {
  if (state.palisade === null) return false;
  const { tx, ty } = cellCoordinate(state.width, index);
  return isPointInsidePalisade({ x: tx + 0.5, y: ty + 0.5 }, state.palisade.polygon);
}

export type ZonePaintRejection = "invalid_stroke" | "empty" | "arable_inside_wall";

export type ZonePaintAssessment =
  | {
      readonly ok: true;
      readonly stroke: ZoneStroke;
      readonly cells: readonly number[];
      /** Same-kind zones the stroke merges into, oldest first; empty means a new zone. */
      readonly mergeZoneIds: readonly string[];
    }
  | { readonly ok: false; readonly reason: ZonePaintRejection; readonly cells: readonly number[] };

function touches(membership: ReadonlySet<number>, cells: readonly number[], width: number): boolean {
  return cells.some(cell => membership.has(cell)
    || (cell % width > 0 && membership.has(cell - 1))
    || (cell % width < width - 1 && membership.has(cell + 1))
    || membership.has(cell - width)
    || membership.has(cell + width));
}

/** Preview and validation of a paint stroke; the reducer applies exactly this result (Z-5, Z-9). */
export function zonePaintAssessment(state: ZoneWorld, kind: ZoneKind, stroke: ZoneStroke): ZonePaintAssessment {
  const normalized = isZoneKind(kind) ? normalizeZoneStroke(stroke) : null;
  if (normalized === null) return { ok: false, reason: "invalid_stroke", cells: [] };
  const cells = rasterizeZoneStroke(normalized, state);
  if (cells.length === 0) return { ok: false, reason: "empty", cells };
  if (ZONE_KIND_CONFIG[kind].forbiddenInsideWall && cells.some(cell => cellInsideWall(state, cell))) {
    return { ok: false, reason: "arable_inside_wall", cells };
  }
  const mergeZoneIds = zonesOf(state)
    .filter(zone => zone.kind === kind && touches(new Set(zone.membership), cells, state.width))
    .sort((left, right) => left.createdOrdinal - right.createdOrdinal)
    .map(zone => zone.id);
  return { ok: true, stroke: normalized, cells, mergeZoneIds };
}

function without(membership: readonly number[], removed: ReadonlySet<number>): readonly number[] {
  return membership.some(cell => removed.has(cell)) ? membership.filter(cell => !removed.has(cell)) : membership;
}

function sortedUnion(...lists: readonly (readonly number[])[]): readonly number[] {
  return [...new Set(lists.flat())].sort((left, right) => left - right);
}

/**
 * Z-5: painted cells leave every other zone. A new zone takes the next ordinal, so the later zone wins
 * a shared cell. Same-kind zones the stroke overlaps or edge-touches merge into the oldest of them,
 * which keeps its id, ordinal and label and gains the stroke.
 */
export function paintZone(state: GameState, kind: ZoneKind, stroke: ZoneStroke): GameState {
  const assessment = zonePaintAssessment(state, kind, stroke);
  if (!assessment.ok) return state;
  const painted = new Set(assessment.cells);
  const zones = zonesOf(state);
  const merging = new Set(assessment.mergeZoneIds);
  const targetId = assessment.mergeZoneIds[0];
  const ordinal = state.nextZoneOrdinal ?? 1;
  const next: Zone[] = [];
  if (targetId === undefined) {
    for (const zone of zones) {
      const membership = without(zone.membership, painted);
      if (membership.length > 0) next.push(membership === zone.membership ? zone : { ...zone, membership });
    }
    next.push({ id: zoneIdFor(ordinal), kind, strokes: [assessment.stroke], membership: assessment.cells, createdOrdinal: ordinal });
    return { ...state, zones: next, nextZoneOrdinal: ordinal + 1 };
  }
  const merged = zones.filter(zone => merging.has(zone.id)).sort((left, right) => left.createdOrdinal - right.createdOrdinal);
  const target = merged[0]!;
  const combined: Zone = {
    ...target,
    strokes: [...merged.flatMap(zone => zone.strokes), assessment.stroke],
    membership: sortedUnion(...merged.map(zone => zone.membership), assessment.cells),
  };
  for (const zone of zones) {
    if (zone.id === target.id) next.push(combined);
    else if (merging.has(zone.id)) continue;
    else {
      const membership = without(zone.membership, painted);
      if (membership.length > 0) next.push(membership === zone.membership ? zone : { ...zone, membership });
    }
  }
  return { ...state, zones: next, nextZoneOrdinal: ordinal };
}

/** Z-6: removes the stroke's cells from every zone; a zone left with no cell is deleted. */
export function eraseZone(state: GameState, stroke: ZoneStroke): GameState {
  const normalized = normalizeZoneStroke(stroke);
  if (normalized === null) return state;
  const erased = new Set(rasterizeZoneStroke(normalized, state));
  if (erased.size === 0) return state;
  let changed = false;
  const next: Zone[] = [];
  for (const zone of zonesOf(state)) {
    const membership = without(zone.membership, erased);
    if (membership !== zone.membership) changed = true;
    if (membership.length > 0) next.push(membership === zone.membership ? zone : { ...zone, membership });
  }
  return changed ? { ...state, zones: next } : state;
}

/** Z-7. */
export function removeZone(state: GameState, id: string): GameState {
  const zones = zonesOf(state);
  return zones.some(zone => zone.id === id) ? { ...state, zones: zones.filter(zone => zone.id !== id) } : state;
}
