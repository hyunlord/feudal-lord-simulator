/**
 * v27 adds F4-A's reorganisation (spec `docs/design/chapter-four-reorganisation.md` RG-1…RG-12): `state.reorganisation`
 * (the steps, the four answers, the influence, the guild, chapter 5's start). A v26 town has not begun it: it begins at
 * its next season start once in chapter 4 (the sandbox's from 1364).
 */
export function migrateV26ToV27(input: unknown): unknown {
  if (typeof input !== "object" || input === null) throw new TypeError("Schema v26 save must be an envelope object");
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== "object" || envelope.state === null) throw new TypeError("Schema v26 save has no state");
  return { ...envelope, schemaVersion: 27 };
}
