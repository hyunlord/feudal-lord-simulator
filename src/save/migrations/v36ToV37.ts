/**
 * v37 is LM-E1b (spec `docs/design/town-agency.md` TA-10, TA-11, TA-6 ②): a lord-mode receipt may carry the candidate
 * sites it compared (`sites`), the agency the week's requests to its lord (`requests`) and the last subsidy refused
 * (`lastRefusal`). All three are optional: a v36 receipt compared no sites, and its town's requests are found on the
 * next week's walk, so the step only moves the version.
 */
export function migrateV36ToV37(input: unknown): unknown {
  if (typeof input !== "object" || input === null) throw new TypeError("Schema v36 save must be an envelope object");
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== "object" || envelope.state === null) throw new TypeError("Schema v36 save has no state");
  return { ...envelope, schemaVersion: 37 };
}
