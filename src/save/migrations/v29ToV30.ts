/**
 * v30 is FIX-9 (spec `docs/design/chapter-five-legacy.md` LG-13): chapter 5's interlude — `legacy.interludes` (the
 * Staple, the guild's quarrel or the market's fire, the parish's nave, the deposition) and `legacy.naveRebuilt`. A v29
 * chapter-5 town has had none of them: those still ahead come by the calendar, those past are left out.
 */
export function migrateV29ToV30(input: unknown): unknown {
  if (typeof input !== "object" || input === null) throw new TypeError("Schema v29 save must be an envelope object");
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== "object" || envelope.state === null) throw new TypeError("Schema v29 save has no state");
  return { ...envelope, schemaVersion: 30 };
}
