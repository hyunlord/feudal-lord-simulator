// SIM-SPEED (user order 2026-10-11): proof that a speed change keeps the game the same. The lord's slice played by the
// lord-mode bot (the loop of scripts/growBlockProbe.ts) for <years>; the whole state's SHA-256 at every year's turn and
// at the end. Two commits that print the same hashes played the same game, tick for tick.
//   tsx scripts/perf/simIdentity.ts <seed> [years] > out.json
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LORD_SLICE_SCENARIO_ID } from "../../src/content/lordSliceConfig";
import type { GameState } from "../../src/engine/engine.types";
import { lordBotCommands } from "../../src/engine/lordBot";
import { stateCalendar } from "../../src/engine/scenarioState";
import { advanceTick } from "../../src/engine/tick";
import { gameReducer } from "../../src/state/gameStore";
import { newGameState } from "../../src/state/newGame";

const sha = (state: GameState) => createHash("sha256").update(JSON.stringify(state)).digest("hex");

export function simIdentity(seed: number, years: number) {
  const started = Date.now();
  let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed }) as GameState;
  const start = stateCalendar(state).year;
  let last = start;
  const yearly: string[] = [];
  while (stateCalendar(state).year < start + years) {
    for (const { command } of lordBotCommands(state)) { const next = gameReducer(state, command); if (next !== state) state = next; }
    state = advanceTick(state);
    const year = stateCalendar(state).year;
    if (year !== last) { last = year; yearly.push(sha(state)); }
  }
  return { seed, years, tick: state.tick, population: state.population, finalStateSha256: sha(state), yearly, seconds: Math.round((Date.now() - started) / 1000) };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [seed = "1", years = "30"] = process.argv.slice(2);
  process.stdout.write(`${JSON.stringify(simIdentity(Number(seed), Number(years)))}\n`);
}
