/**
 * v26 adds F3-A's Black Death (spec `docs/design/chapter-three-plague.md` PL-1…PL-11): `state.plague` (the sequence, the
 * pestilences, the answers, the vacant plots) and a church's `curacyVacant`. A v25 town has not met the pestilence: it
 * comes with the collapse era (a town already past 1350 has missed it).
 */
export function migrateV25ToV26(input: unknown): unknown {
  if (typeof input !== "object" || input === null) throw new TypeError("Schema v25 save must be an envelope object");
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== "object" || envelope.state === null) throw new TypeError("Schema v25 save has no state");
  return { ...envelope, schemaVersion: 26 };
}
