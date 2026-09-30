/**
 * v36 is LM-E1 (spec `docs/design/town-agency.md` TA-8): a state may carry lord mode's town agency (`agency`: the actors'
 * funds, the lord's policy, subsidies and dues, the receipts). A v35 save kept none, so it stays a sandbox town.
 */
export function migrateV35ToV36(input: unknown): unknown {
  if (typeof input !== "object" || input === null) throw new TypeError("Schema v35 save must be an envelope object");
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== "object" || envelope.state === null) throw new TypeError("Schema v35 save has no state");
  return { ...envelope, schemaVersion: 36 };
}
