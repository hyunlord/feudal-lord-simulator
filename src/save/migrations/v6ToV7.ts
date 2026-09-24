import { openingLedger } from "../../ledger/ledger";

/**
 * v7 replaces the income window `coinLedger` with the economy ledger (spec L-9). An older save starts
 * its ledger with one `opening_balance` entry holding the treasury it had; earlier sales are not
 * replayed into entries.
 */
export function migrateV6ToV7(input: unknown): unknown {
  if (typeof input !== 'object' || input === null) throw new TypeError('Schema v6 save must be an envelope object');
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== 'object' || envelope.state === null) throw new TypeError('Schema v6 save has no state');
  const { coinLedger: _coinLedger, ...state } = envelope.state as Record<string, unknown>;
  const treasuryCoin = typeof state.treasuryCoin === 'number' ? state.treasuryCoin : 0;
  const tick = typeof state.tick === 'number' ? state.tick : 0;
  const scenarioId = typeof state.scenarioId === 'string' ? state.scenarioId : undefined;
  const ledger = openingLedger({ treasuryCoin, tick, ...(scenarioId === undefined ? {} : { scenarioId }) }, 'save_v6');
  return { ...envelope, schemaVersion: 7, state: { ...state, ledger } };
}
