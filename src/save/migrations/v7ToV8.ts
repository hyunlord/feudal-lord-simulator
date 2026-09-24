/**
 * v8 adds the money-rule state (spec M-9): `GameState.money` (toll and mill counts, the upkeep arrears
 * queue) and `Building.upkeepUnpaid`. Both are optional and absent means nothing accrued or owed, so a
 * v7 save keeps its shape; its `market_sale` entries stay as history.
 */
export function migrateV7ToV8(input: unknown): unknown {
  if (typeof input !== 'object' || input === null) throw new TypeError('Schema v7 save must be an envelope object');
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== 'object' || envelope.state === null) throw new TypeError('Schema v7 save has no state');
  return { ...envelope, schemaVersion: 8 };
}
