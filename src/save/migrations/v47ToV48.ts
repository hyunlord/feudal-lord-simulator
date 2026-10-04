/**
 * v48 is LM-E9b (spec `docs/design/town-agency.md` TA-13): the town agency's last walk kept while it started nothing
 * (`AgencyState.lastWalk`) and a receipt's reused walk (`ProjectReceipt.reusedWalk`). A v47 save has neither; the next
 * week walks as before, so only the version moves.
 */
export function migrateV47ToV48(input: unknown): unknown {
  if (typeof input !== "object" || input === null) throw new TypeError("Schema v47 save must be an envelope object");
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== "object" || envelope.state === null) throw new TypeError("Schema v47 save has no state");
  return { ...envelope, schemaVersion: 48 };
}
