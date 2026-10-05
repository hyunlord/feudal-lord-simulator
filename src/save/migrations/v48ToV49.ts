/**
 * v49 is LM-E9b (spec `docs/design/registry.md` ER-13…ER-15): a registry occurrence of the content canon v4 keeps its
 * source, its bound targets' identities, its dedup key and recurrence context (`RegistryOccurrence.source`, `bound`,
 * `key`, `context`). A v48 save has no v4 occurrence, so only the version moves.
 */
export function migrateV48ToV49(input: unknown): unknown {
  if (typeof input !== "object" || input === null) throw new TypeError("Schema v48 save must be an envelope object");
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== "object" || envelope.state === null) throw new TypeError("Schema v48 save has no state");
  return { ...envelope, schemaVersion: 49 };
}
