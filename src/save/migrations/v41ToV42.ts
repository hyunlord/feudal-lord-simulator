/**
 * v42 is LM-E4 (spec `docs/design/stewardship.md` SW-9): a state may carry the oversight of the estates the lord holds
 * off the map (`stewardship`: oversight, stewards, petitions, seasons, audits, exceptions). A v41 save holds none yet
 * (it is made at the next season once the lord holds one), so only the version moves.
 */
export function migrateV41ToV42(input: unknown): unknown {
  if (typeof input !== "object" || input === null) throw new TypeError("Schema v41 save must be an envelope object");
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== "object" || envelope.state === null) throw new TypeError("Schema v41 save has no state");
  return { ...envelope, schemaVersion: 42 };
}
