// Adds fixtures/saves/v8/money-arrears.save.json: the opening village after one period close with an empty
// treasury, so its facilities fall into arrears (upkeepUnpaid), plus pending toll and mill counts. Built
// through the money rules themselves (settleMoneyPeriod, accrue*), not a growth run, so the save-schema
// watcher sees the whole MoneyState shape. Usage: tsx scripts/buildMoneyFixtures.ts (after buildSaveFixtures --from-version 7)
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { GameState } from "../src/engine/engine.types";
import { accrueMilledWheat, accrueTollCrossings, settleMoneyPeriod } from "../src/engine/moneyRules";
import { LEDGER_PERIOD_TICKS } from "../src/ledger/ledger";
import { encodeSave } from "../src/save/saveCodec";
import { SAVE_SCHEMA_VERSION } from "../src/save/saveTypes";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

export function moneyArrearsState(): GameState {
  const opening = structuredClone(DEFAULT_GAME_STATE);
  // No homes pay this period, so the well's and storehouse's upkeep cannot be met.
  const settled = settleMoneyPeriod({ ...opening, tick: LEDGER_PERIOD_TICKS, houses: opening.houses.map(house => ({ ...house, residents: 0 })) });
  const withCounts = accrueMilledWheat(accrueTollCrossings({ ...settled, houses: opening.houses }, new Map([["gate:40,30.5", 3]])),
    new Map([["mill-fixture", 7]]));
  return withCounts;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const state = moneyArrearsState();
  const fixed = "2026-09-25T00:00:00.000Z";
  const encoded = encodeSave({ state, createdAt: fixed, savedAt: fixed, gameVersion: "0.1.0+fixture" });
  const directory = resolve(ROOT, `fixtures/saves/v${SAVE_SCHEMA_VERSION}`);
  writeFileSync(resolve(directory, "money-arrears.save.json"), encoded.bytes);
  const manifestPath = resolve(directory, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { fixtures: Record<string, unknown>[] };
  manifest.fixtures = manifest.fixtures.filter(entry => entry.id !== "money-arrears");
  manifest.fixtures.push({ id: "money-arrears", description: "DEFAULT_GAME_STATE after one period close with no rent: well and storehouse upkeep in arrears, pending toll and mill counts",
    provenance: "Built through settleMoneyPeriod and the accrue* rules by scripts/buildMoneyFixtures.ts; world state is the opening. Not a growth run.",
    file: "money-arrears.save.json", bytes: encoded.bytes.byteLength, tick: state.tick, treasuryCoin: state.treasuryCoin,
    arrears: state.money?.arrears.length ?? 0, unpaidBuildings: state.buildings.filter(building => building.upkeepUnpaid === true).length });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ tick: state.tick, arrears: state.money?.arrears, treasury: state.treasuryCoin })}\n`);
}
