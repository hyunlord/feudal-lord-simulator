/**
 * v34 is BOT-4 (spec `docs/design/arable-fields.md` GP-1): a state may carry the town's harvest record
 * (`harvestRecord`, the year's expected and harvested wheat and the last three years'). A v33 save kept none, so the
 * record starts with the next harvest and the bot's grain plan reads the expected harvest as before until a year is kept.
 */
export function migrateV33ToV34(input: unknown): unknown {
  if (typeof input !== "object" || input === null) throw new TypeError("Schema v33 save must be an envelope object");
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== "object" || envelope.state === null) throw new TypeError("Schema v33 save has no state");
  return { ...envelope, schemaVersion: 34 };
}
