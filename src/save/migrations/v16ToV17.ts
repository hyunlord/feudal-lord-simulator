/**
 * v17 adds WALL-2's palisade expansion (spec `docs/design/wall-expansion.md`, WX-1…WX-6): `PalisadeState.expansion`
 * (the last expansion's tick and the arable cells it took inside, until they have turned to pasture). A v16 wall was never expanded: nothing
 * to add.
 */
export function migrateV16ToV17(input: unknown): unknown {
  if (typeof input !== "object" || input === null) throw new TypeError("Schema v16 save must be an envelope object");
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== "object" || envelope.state === null) throw new TypeError("Schema v16 save has no state");
  return { ...envelope, schemaVersion: 17 };
}
