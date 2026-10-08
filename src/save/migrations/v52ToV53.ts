/**
 * v53 is DUES-REL: the stall fee agreed at a registry answer (`agency.duesAgreement`, decision DTR-18). It is new and
 * optional: a v52 save has none, so only the version moves — a fee set by an answer before the load is no agreement.
 */
export function migrateV52ToV53(input: unknown): unknown {
  if (typeof input !== "object" || input === null) throw new TypeError("Schema v52 save must be an envelope object");
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== "object" || envelope.state === null) throw new TypeError("Schema v52 save has no state");
  return { ...envelope, schemaVersion: 53 };
}
