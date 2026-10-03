/**
 * v47 is LM-E9 (spec `docs/design/registry.md` ER-12): the registry (`GameState.registry` — its occurrences, timed terms
 * and the player's house), and a right piece's ruled scope (`RightPiece.scope`, ER-8). A v46 save has none of them; the
 * registry appears with a lord-mode new game or the first registry season, so only the version moves.
 */
export function migrateV46ToV47(input: unknown): unknown {
  if (typeof input !== "object" || input === null) throw new TypeError("Schema v46 save must be an envelope object");
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== "object" || envelope.state === null) throw new TypeError("Schema v46 save has no state");
  return { ...envelope, schemaVersion: 47 };
}
