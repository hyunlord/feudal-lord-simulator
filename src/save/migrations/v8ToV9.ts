/**
 * v9 adds the zone undo stack (spec Z-17): `GameState.zoneUndo`, optional and absent = nothing to undo.
 * A v8 save keeps its shape; edits made before v9 cannot be undone.
 */
export function migrateV8ToV9(input: unknown): unknown {
  if (typeof input !== 'object' || input === null) throw new TypeError('Schema v8 save must be an envelope object');
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== 'object' || envelope.state === null) throw new TypeError('Schema v8 save has no state');
  return { ...envelope, schemaVersion: 9 };
}
