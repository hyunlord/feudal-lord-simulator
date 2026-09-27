/**
 * v21 adds FACTION-0's factions (spec `docs/design/factions.md`, FX-1…FX-8): `GameState.factions` (the nine factions,
 * their leaders, relations, memories and timelines, and the outside factions' people). A v20 town has no factions yet:
 * `factions` stays absent and the next tick creates them from the seed as a new game would (their memory starts there;
 * the older petitions stay in the history ledger without a faction's record).
 */
export function migrateV20ToV21(input: unknown): unknown {
  if (typeof input !== "object" || input === null) throw new TypeError("Schema v20 save must be an envelope object");
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== "object" || envelope.state === null) throw new TypeError("Schema v20 save has no state");
  return { ...envelope, schemaVersion: 21 };
}
