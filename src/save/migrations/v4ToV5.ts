/** v5 adds `GameState.scenarioId`. Every earlier save was a default-campaign game (spec SC-14). */
export function migrateV4ToV5(input: unknown): unknown {
  if (typeof input !== 'object' || input === null) throw new TypeError('Schema v4 save must be an envelope object');
  const envelope = input as { readonly state?: unknown; readonly scenarioId?: unknown };
  if (typeof envelope.state !== 'object' || envelope.state === null) throw new TypeError('Schema v4 save has no state');
  const state = envelope.state as Record<string, unknown>;
  const scenarioId = typeof state.scenarioId === 'string' ? state.scenarioId : 'core:campaign_market_town';
  return { ...envelope, schemaVersion: 5, scenarioId, state: { ...state, scenarioId } };
}
