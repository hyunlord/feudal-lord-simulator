/**
 * v32 is ARCH-1b (spec `docs/design/map-archetypes.md` MA-9, MA-11): a state may carry its map's river (`river`) and the
 * fen's drainage works (`drainage`). A v31 save has neither: its map had no river, so all its water reads as flowing
 * (the fulling mill's old rule), and no works are open.
 */
export function migrateV31ToV32(input: unknown): unknown {
  if (typeof input !== "object" || input === null) throw new TypeError("Schema v31 save must be an envelope object");
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== "object" || envelope.state === null) throw new TypeError("Schema v31 save has no state");
  return { ...envelope, schemaVersion: 32 };
}
