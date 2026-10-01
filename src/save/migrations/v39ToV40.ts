/**
 * v40 is LM-E3 (spec `docs/design/negotiation.md` NG-1, NG-10): a state may carry its diplomacy (`diplomacy`: the
 * negotiations, the promise ledger, the marriage). A v39 save offered nothing yet, so it keeps none; only the version
 * moves.
 */
export function migrateV39ToV40(input: unknown): unknown {
  if (typeof input !== "object" || input === null) throw new TypeError("Schema v39 save must be an envelope object");
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== "object" || envelope.state === null) throw new TypeError("Schema v39 save has no state");
  return { ...envelope, schemaVersion: 40 };
}
