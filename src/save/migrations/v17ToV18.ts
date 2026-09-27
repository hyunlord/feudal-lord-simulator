/**
 * v18 adds FIX-4's season records (spec `docs/design/human-play-rules.md`, HR-7, HR-8, HR-11): `SeasonTally.starved`
 * (residents lost to hunger so far in the season), `SeasonLedger.foodNeeds` (what a food hint asks for) and the
 * `residents_starved` season event. All are optional: a v17 tally has lost no one yet and a v17 ledger has no food needs,
 * so nothing is added. The first-winter warning keeps its shape (HR-8 raises it again each short autumn).
 */
export function migrateV17ToV18(input: unknown): unknown {
  if (typeof input !== "object" || input === null) throw new TypeError("Schema v17 save must be an envelope object");
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== "object" || envelope.state === null) throw new TypeError("Schema v17 save has no state");
  return { ...envelope, schemaVersion: 18 };
}
