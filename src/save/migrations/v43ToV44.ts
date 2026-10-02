/**
 * v44 is FIX-13 (specs `docs/design/negotiation.md` NG-5b, `docs/design/estates.md` ES-11, `docs/design/map-archetypes.md`
 * MA-11): a marriage plan may carry its jointure piece and the debt it pays after the inheritance, a promise its yearly
 * share of that debt, and a drainage works the cell it was started from. A v43 save has none of them yet (its marriages
 * made no such terms, its works were started before the cell was kept), so only the version moves.
 */
export function migrateV43ToV44(input: unknown): unknown {
  if (typeof input !== "object" || input === null) throw new TypeError("Schema v43 save must be an envelope object");
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== "object" || envelope.state === null) throw new TypeError("Schema v43 save has no state");
  return { ...envelope, schemaVersion: 44 };
}
