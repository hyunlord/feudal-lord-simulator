/**
 * v20 adds F2-A's war of 1337 (spec `docs/design/chapter-two-war.md`, WR-1…WR-10): `GameState.war` (the messenger's
 * season, the Crown's favour, the answers, the men away, instalments, the war tax, the raid, the purveyance licence, the
 * wall or the market), the `crown`, `refugees` and `townsfolk` petitioners, the five war petitions, an arrears line's
 * `category` and chapter 2's end. A v19 town has had no war — `war` stays absent, which means exactly that. A v19 town
 * in 1337–1340 meets the messenger at its next season start (the sequence starts late); one past 1340 missed the war.
 */
export function migrateV19ToV20(input: unknown): unknown {
  if (typeof input !== "object" || input === null) throw new TypeError("Schema v19 save must be an envelope object");
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== "object" || envelope.state === null) throw new TypeError("Schema v19 save has no state");
  return { ...envelope, schemaVersion: 20 };
}
