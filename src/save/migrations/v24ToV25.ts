/**
 * v25 adds FIX-7's ale count (spec `docs/design/ale-chain.md` AL-10): `state.ale`, the town's ale brewed, drunk and
 * sold this season and the last. A v24 town has not been counted yet: its count opens at its next brew or drink.
 */
export function migrateV24ToV25(input: unknown): unknown {
  if (typeof input !== "object" || input === null) throw new TypeError("Schema v24 save must be an envelope object");
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== "object" || envelope.state === null) throw new TypeError("Schema v24 save has no state");
  return { ...envelope, schemaVersion: 25 };
}
