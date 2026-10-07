/**
 * v51 is LM-R2-E ①: the stories the screen has shown (`GameState.seen`, `storySeen.ts`). A v50 save has no mark, so only
 * the version moves — a story it showed may show once more after loading (as before).
 */
export function migrateV50ToV51(input: unknown): unknown {
  if (typeof input !== "object" || input === null) throw new TypeError("Schema v50 save must be an envelope object");
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== "object" || envelope.state === null) throw new TypeError("Schema v50 save has no state");
  return { ...envelope, schemaVersion: 51 };
}
