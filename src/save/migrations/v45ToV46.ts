/**
 * v46 is LM-E6a (spec `docs/design/trades.md` TR-9): lord mode's trades (`GameState.trades` — trade households, the
 * town's trade goods, chains, streets and the carters' haulage). A v45 save has none; the field appears the first
 * season a lord-mode town is played, so only the version moves.
 */
export function migrateV45ToV46(input: unknown): unknown {
  if (typeof input !== "object" || input === null) throw new TypeError("Schema v45 save must be an envelope object");
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== "object" || envelope.state === null) throw new TypeError("Schema v45 save has no state");
  return { ...envelope, schemaVersion: 46 };
}
