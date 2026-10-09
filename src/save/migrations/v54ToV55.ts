/**
 * v55 is GROW-BLOCK (decisions GB-1…GB-4): the charter wall search's last failure (`agency.charterWallFailure`) and the
 * building sites the town gave up (`agency.abandonedSites`) — both new and optional: a v54 save has none, so only the
 * version moves (a search that failed before the load is tried again at once).
 */
export function migrateV54ToV55(input: unknown): unknown {
  if (typeof input !== "object" || input === null) throw new TypeError("Schema v54 save must be an envelope object");
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== "object" || envelope.state === null) throw new TypeError("Schema v54 save has no state");
  return { ...envelope, schemaVersion: 55 };
}
