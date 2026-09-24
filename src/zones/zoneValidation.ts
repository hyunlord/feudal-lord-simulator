import { ZONE_UNDO_LIMIT } from "../content/zoneConfig";
import { normalizeZoneStroke } from "./zoneRaster";
import { isZoneKind, zoneIdFor } from "./zoneEdits";

function zoneShapeProblem(zone: Record<string, unknown>, next: number, cells: number): string | null {
  if (typeof zone !== "object" || zone === null) return "zone must be an object";
  const ordinal = zone.createdOrdinal;
  if (typeof ordinal !== "number" || !Number.isSafeInteger(ordinal) || ordinal < 1 || ordinal >= next) return "zone ordinal is out of range";
  if (zone.id !== zoneIdFor(ordinal)) return "zone id does not match its ordinal";
  if (!isZoneKind(zone.kind)) return "zone kind is unknown";
  if (zone.label !== undefined && typeof zone.label !== "string") return "zone label must be a string";
  if (!Array.isArray(zone.strokes) || zone.strokes.length === 0) return "zone strokes must be a non-empty array";
  for (const stroke of zone.strokes) {
    const normalized = normalizeZoneStroke(stroke);
    if (normalized === null || JSON.stringify(normalized) !== JSON.stringify(stroke)) return "zone stroke is not a snapped stroke";
  }
  if (!Array.isArray(zone.membership) || zone.membership.length === 0) return "zone membership must be a non-empty array";
  let previous = -1;
  for (const cell of zone.membership as unknown[]) {
    if (typeof cell !== "number" || !Number.isSafeInteger(cell) || cell <= previous || cell >= cells) return "zone membership must be ascending map cells";
    previous = cell;
  }
  return null;
}

/** Z-17 (v9): at most `ZONE_UNDO_LIMIT` records, each with zone ids, well-formed earlier zones and an ordinal. */
function zoneUndoProblem(stack: unknown, next: number, cells: number): string | null {
  if (stack === undefined) return null;
  if (!Array.isArray(stack) || stack.length === 0 || stack.length > ZONE_UNDO_LIMIT) return "zone undo stack must hold 1–20 records";
  for (const record of stack as Record<string, unknown>[]) {
    if (typeof record !== "object" || record === null || !Array.isArray(record.order) || !Array.isArray(record.previous)) return "zone undo record is malformed";
    const ordinal = record.nextZoneOrdinal;
    if (typeof ordinal !== "number" || !Number.isSafeInteger(ordinal) || ordinal < 1 || ordinal > next) return "zone undo ordinal is out of range";
    if (record.order.some(id => typeof id !== "string")) return "zone undo order must list zone ids";
    for (const zone of record.previous as Record<string, unknown>[]) {
      const problem = zoneShapeProblem(zone, next, cells);
      if (problem !== null) return `zone undo: ${problem}`;
    }
  }
  return null;
}

/**
 * Save-load check of the zone fields (v6; undo stack v9). Returns the first problem, or null when the zones are a
 * state the edit rules could have produced: known kinds, snapped strokes, ascending in-map membership,
 * no cell owned twice, ids from ordinals below `nextZoneOrdinal`.
 */
export function zoneStateProblem(state: Readonly<Record<string, unknown>>): string | null {
  const zones = state.zones;
  const next = state.nextZoneOrdinal;
  if (zones === undefined && next === undefined) return null;
  if (!Array.isArray(zones)) return "zones must be an array";
  if (typeof next !== "number" || !Number.isSafeInteger(next) || next < 1) return "nextZoneOrdinal must be a positive integer";
  const cells = Number(state.width) * Number(state.height);
  const owned = new Set<number>();
  for (const zone of zones as Record<string, unknown>[]) {
    const problem = zoneShapeProblem(zone, next, cells);
    if (problem !== null) return problem;
    for (const cell of zone.membership as number[]) {
      if (owned.has(cell)) return "a cell belongs to two zones";
      owned.add(cell);
    }
  }
  return zoneUndoProblem(state.zoneUndo, next, cells);
}
