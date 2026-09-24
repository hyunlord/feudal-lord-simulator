import { normalizeZoneStroke } from "./zoneRaster";
import { isZoneKind, zoneIdFor } from "./zoneEdits";

/**
 * Save-load check of the zone fields (v6). Returns the first problem, or null when the zones are a
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
      if (owned.has(cell)) return "a cell belongs to two zones";
      owned.add(cell);
      previous = cell;
    }
  }
  return null;
}
