/**
 * v52 is DEC-TRACE: the lord's standing policies (`stewardship.standing`), the steward's answers by them (`policy` on a
 * petition or an offer), an offer's weights and the side its answer took, the factions' memories tied to decisions, the
 * history's `because`, and the thread itself (`GameState.trace`). All are new and optional: a v51 save has none of them,
 * so only the version moves — its decisions before the load have no thread (nothing is made up for them).
 */
export function migrateV51ToV52(input: unknown): unknown {
  if (typeof input !== "object" || input === null) throw new TypeError("Schema v51 save must be an envelope object");
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== "object" || envelope.state === null) throw new TypeError("Schema v51 save has no state");
  return { ...envelope, schemaVersion: 52 };
}
