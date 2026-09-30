/**
 * v33 is FIX-10 (spec `docs/design/timber-trade.md` TT-1): a state may carry a standing timber order with the market's
 * traders (`timberOrder`). A v32 save had no such trade, so it has no order.
 */
export function migrateV32ToV33(input: unknown): unknown {
  if (typeof input !== "object" || input === null) throw new TypeError("Schema v32 save must be an envelope object");
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== "object" || envelope.state === null) throw new TypeError("Schema v32 save has no state");
  return { ...envelope, schemaVersion: 33 };
}
