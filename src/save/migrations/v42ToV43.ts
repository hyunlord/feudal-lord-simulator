/**
 * v43 is LM-E5 (spec `docs/design/living-growth.md` LG-5): a state may carry the land's own changes (`land`: footfall,
 * footpaths, fallow cells) and a lord-mode receipt its chance (`chance`). A v42 save has neither yet (the land starts
 * at its next season, a receipt's chance with the next project), so only the version moves.
 */
export function migrateV42ToV43(input: unknown): unknown {
  if (typeof input !== "object" || input === null) throw new TypeError("Schema v42 save must be an envelope object");
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== "object" || envelope.state === null) throw new TypeError("Schema v42 save has no state");
  return { ...envelope, schemaVersion: 43 };
}
