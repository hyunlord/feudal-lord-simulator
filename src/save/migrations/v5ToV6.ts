/** v6 adds painted zones (`GameState.zones`, `nextZoneOrdinal`). Every earlier save had none (spec Z-1). */
export function migrateV5ToV6(input: unknown): unknown {
  if (typeof input !== 'object' || input === null) throw new TypeError('Schema v5 save must be an envelope object');
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== 'object' || envelope.state === null) throw new TypeError('Schema v5 save has no state');
  const state = envelope.state as Record<string, unknown>;
  return { ...envelope, schemaVersion: 6, state: { ...state, zones: [], nextZoneOrdinal: 1 } };
}
