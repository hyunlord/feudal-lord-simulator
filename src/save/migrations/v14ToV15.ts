/**
 * v15 adds F0-C2's history ledger (spec `docs/design/history-ledger.md`, HL-1…HL-9): `GameState.history` (append-only
 * records, map thumbnails, the season's decision counts, milestones reached, pending actuals). Nothing is made up for
 * the past: a v14 town's ledger starts on its first tick after loading (its milestones already reached are recorded
 * then, once).
 */
export function migrateV14ToV15(input: unknown): unknown {
  if (typeof input !== 'object' || input === null) throw new TypeError('Schema v14 save must be an envelope object');
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== 'object' || envelope.state === null) throw new TypeError('Schema v14 save has no state');
  return { ...envelope, schemaVersion: 15 };
}
