/**
 * v13 adds F0-B events (spec `docs/design/flow-events.md`, EV-1…EV-9): `GameState.events` (events that arrived, fires
 * burning), `House.burntTick` / `burntByEventId` and a construction site's `rebuildOf`. The schedule and the weather
 * are derived from the seed, so a v12 save needs nothing added: its first tick finds no event arrived, and an event
 * whose time is already past (a dearth begun before the save) catches up on that tick (EV-5).
 */
export function migrateV12ToV13(input: unknown): unknown {
  if (typeof input !== 'object' || input === null) throw new TypeError('Schema v12 save must be an envelope object');
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== 'object' || envelope.state === null) throw new TypeError('Schema v12 save has no state');
  return { ...envelope, schemaVersion: 13 };
}
