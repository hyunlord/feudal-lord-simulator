/**
 * v45 is FIX-14 (spec `docs/design/stewardship.md` SW-11, SW-12): an estate petition may be one of the home estate's
 * twelve kinds with the party it sets against, or one a steward answered by precedent; the exceptions may bring
 * recurring kinds up again. A v44 save has none of them (its petitions are the estates' six, its rules without the
 * recurring flag: precedent applies), so only the version moves.
 */
export function migrateV44ToV45(input: unknown): unknown {
  if (typeof input !== "object" || input === null) throw new TypeError("Schema v44 save must be an envelope object");
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== "object" || envelope.state === null) throw new TypeError("Schema v44 save has no state");
  return { ...envelope, schemaVersion: 45 };
}
