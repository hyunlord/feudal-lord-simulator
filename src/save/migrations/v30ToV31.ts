/**
 * v31 is ARCH-1 (spec `docs/design/map-archetypes.md` AR-6): a state may name its land, `archetypeId`. A v30 save has
 * none and reads as its scenario's land — the open field, the riverside market town — as it always has.
 */
export function migrateV30ToV31(input: unknown): unknown {
  if (typeof input !== "object" || input === null) throw new TypeError("Schema v30 save must be an envelope object");
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== "object" || envelope.state === null) throw new TypeError("Schema v30 save has no state");
  return { ...envelope, schemaVersion: 31 };
}
