// Adds fixtures/saves/v7/ledger-rollup.save.json: a new game whose ledger holds market-sale entries and
// roll-ups, so the save-schema watcher sees the whole Ledger shape. Synthetic postings through
// postLedgerEntries (the only writer), not a growth run; natural ledgers are measured by
// scripts/ledgerBalanceTrace.ts. Usage: tsx scripts/buildLedgerFixtures.ts (after buildSaveFixtures --from-version 6)
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { GameState } from "../src/engine/engine.types";
import { LEDGER_PERIOD_TICKS, LEDGER_RETAINED_PERIODS, postLedgerEntries } from "../src/ledger/ledger";
import { encodeSave } from "../src/save/saveCodec";
import { SAVE_SCHEMA_VERSION } from "../src/save/saveTypes";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

export function ledgerRollupState(): GameState {
  let state: GameState = structuredClone(DEFAULT_GAME_STATE);
  const periods = LEDGER_RETAINED_PERIODS + 3;
  for (let period = 0; period < periods; period += 1) {
    for (const [offset, amount, sold] of [[80, 6, "timber"], [1_280, 5, "bread"]] as const) {
      const tick = period * LEDGER_PERIOD_TICKS + offset;
      const posted = postLedgerEntries({ ...state, tick },
        [{ account: "cash", category: "market_sale", amount, sourceRefs: [{ type: "building", id: "market-fixture", detail: `sold:${sold}` }] }]);
      state = { ...state, tick, ledger: posted.ledger, treasuryCoin: posted.treasuryCoin };
    }
  }
  return state;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const state = ledgerRollupState();
  const fixed = "2026-09-25T00:00:00.000Z";
  const encoded = encodeSave({ state, createdAt: fixed, savedAt: fixed, gameVersion: "0.1.0+fixture" });
  const directory = resolve(ROOT, `fixtures/saves/v${SAVE_SCHEMA_VERSION}`);
  writeFileSync(resolve(directory, "ledger-rollup.save.json"), encoded.bytes);
  const manifestPath = resolve(directory, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { fixtures: Record<string, unknown>[] };
  manifest.fixtures = manifest.fixtures.filter(entry => entry.id !== "ledger-rollup");
  manifest.fixtures.push({ id: "ledger-rollup", description: "DEFAULT_GAME_STATE with market-sale ledger entries over 9 periods, the oldest rolled up",
    provenance: "Synthetic postings through postLedgerEntries by scripts/buildLedgerFixtures.ts; world state is the untouched opening. Not a growth run.",
    file: "ledger-rollup.save.json", bytes: encoded.bytes.byteLength, tick: state.tick, treasuryCoin: state.treasuryCoin,
    ledgerEntries: state.ledger?.entries.length ?? 0, ledgerRollups: state.ledger?.rollups.length ?? 0 });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ tick: state.tick, entries: state.ledger?.entries.length, rollups: state.ledger?.rollups.length, treasury: state.treasuryCoin })}\n`);
}
