/**
 * v23 adds C4's ale chain (spec `docs/design/ale-chain.md`, AL-1…AL-9): barley, malt and ale among the goods, a
 * farmstead's `crop` (absent = wheat) and a strip's `barley` crop, the malt kiln, and household slots brewing `brew_ale`.
 * A v22 town grows wheat only and brews nothing yet — nothing to fill in.
 */
export function migrateV22ToV23(input: unknown): unknown {
  if (typeof input !== "object" || input === null) throw new TypeError("Schema v22 save must be an envelope object");
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== "object" || envelope.state === null) throw new TypeError("Schema v22 save has no state");
  return { ...envelope, schemaVersion: 23 };
}
