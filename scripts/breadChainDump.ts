// Diagnosis: where the bread chain breaks — the lord's slice by the lord-mode bot to a year, then each food building's
// stock, workers and reservations, and the houses' bread.   tsx scripts/breadChainDump.ts <seed> <year> <out.json>
import { writeFileSync } from "node:fs";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import type { GameState } from "../src/engine/engine.types";
import { lordBotCommands } from "../src/engine/lordBot";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";
const [seed, year, out] = process.argv.slice(2);
let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: Number(seed) }) as GameState;
const snaps: unknown[] = [];
while (stateCalendar(state).year < Number(year) + 1) {
  for (const { command } of lordBotCommands(state)) { const next = gameReducer(state, command); if (next !== state) state = next; }
  state = advanceTick(state);
  if (stateCalendar(state).year >= Number(year) - 1 && state.tick % 1000 === 0) {
    snaps.push({ tick: state.tick, year: stateCalendar(state).year, season: stateCalendar(state).season, idle: state.idleWorkers,
      food: state.buildings.filter(b => ["farmstead", "mill", "granary", "storehouse", "market", "barn"].includes(b.kind))
        .map(b => ({ id: b.id, kind: b.kind, workers: b.workers, inventory: b.inventory, reserved: b.reserved, progress: b.productionProgress })),
      walkers: state.walkers.length, walkerKinds: Object.entries(state.walkers.reduce((m: Record<string, number>, w: { kind?: string; role?: string }) => { const k = String(w.kind ?? w.role ?? "?"); m[k] = (m[k] ?? 0) + 1; return m; }, {})),
      houses: state.houses.map(h => ({ id: h.buildingId, level: h.level, residents: h.residents, bread: h.breadStock, short: h.foodShortSinceTick !== undefined })),
      labour: state.labour ?? null });
  }
}
writeFileSync(out!, JSON.stringify(snaps));
