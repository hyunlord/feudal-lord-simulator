/**
 * v57 (STONE-1a, the user's ruling 2026-10-21): `palisade.closedTick`, the tick a lord-mode wall's last segment was done.
 * An older save never recorded it: a lord-mode wall standing closed reads as closed long ago (tick 0), so its first season
 * close is behind it; an open wall, and the sandbox, have none.
 */
export function migrateV56ToV57(input: unknown): unknown {
  if (typeof input !== "object" || input === null) throw new TypeError("Schema v56 save must be an envelope object");
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== "object" || envelope.state === null) throw new TypeError("Schema v56 save has no state");
  const state = envelope.state as { readonly agency?: unknown; readonly palisade?: { readonly segments?: readonly { readonly completed?: boolean }[] } | null };
  const wall = state.palisade;
  const closed = state.agency !== undefined && wall !== null && wall !== undefined && Array.isArray(wall.segments)
    && wall.segments.length > 0 && wall.segments.every(segment => segment.completed === true);
  return { ...envelope, schemaVersion: 57, ...(closed ? { state: { ...state, palisade: { ...wall, closedTick: 0 } } } : {}) };
}
