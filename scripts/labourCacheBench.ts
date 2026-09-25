// C3 rule 10 measurement for the tended-cells cache (LB-5): cells per farmstead on the migrated seed-2 town with a
// cold key (a fresh tending map: fresh `tiles`, so layouts and tending recompute) and a warm key (same state), and
// the whole labour-demand step on the warm state. Usage: tsx scripts/labourCacheBench.ts [calls=2000]
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import type { GameState } from "../src/engine/engine.types";
import { allocateLabourDemands, tendedCellsByFarmstead } from "../src/engine/labourDemand";
import { migrateStateV9ToV10 } from "../src/save/migrations/v9ToV10";
import { migrateStateV10ToV11 } from "../src/save/migrations/v10ToV11";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const state = migrateStateV10ToV11(migrateStateV9ToV10(JSON.parse(gunzipSync(readFileSync(resolve(ROOT, "docs/verification/c1b-zone-brush/seed2-natural-snapshot.json.gz"))).toString()) as GameState));
const calls = Number(process.argv[2] ?? 2000);
const time = (label: string, run: () => void) => {
  const started = performance.now();
  for (let index = 0; index < calls; index += 1) run();
  return { label, calls, msPerCall: Number(((performance.now() - started) / calls).toFixed(4)) };
};
const cold = time("tended cells, cold key (fresh tiles each call)", () => tendedCellsByFarmstead({ ...state, tiles: [...state.tiles] }));
const warm = time("tended cells, warm key (same state)", () => tendedCellsByFarmstead(state));
const step = time("allocateLabourDemands, warm", () => allocateLabourDemands({ state, buildings: state.buildings, houses: state.houses,
  remaining: 100, constructionWorkers: 0, adults: 200, tick: state.tick, eligible: () => true }));
process.stdout.write(`${JSON.stringify({ farmsteads: tendedCellsByFarmstead(state).size, cold, warm, step }, null, 2)}\n`);
