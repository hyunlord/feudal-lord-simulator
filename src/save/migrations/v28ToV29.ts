/**
 * v29 adds F5-A's chapter 5 (spec `docs/design/chapter-five-legacy.md` LG-1…LG-11): `state.legacy` (the steps, the four
 * answers, the heirs offered and named, the mayor, the backlash, the legacy, the scores and the ending) and a petition's
 * `options`. A v28 town has not begun it: it begins at its next season start once in chapter 5 (the sandbox's the season
 * after the reorganisation ended).
 */
export function migrateV28ToV29(input: unknown): unknown {
  if (typeof input !== "object" || input === null) throw new TypeError("Schema v28 save must be an envelope object");
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== "object" || envelope.state === null) throw new TypeError("Schema v28 save has no state");
  return { ...envelope, schemaVersion: 29 };
}
