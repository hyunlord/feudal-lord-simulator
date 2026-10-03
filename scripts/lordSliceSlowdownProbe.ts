// LM-E9b: where the lord's slice played by the lord-mode bot gets slow (LM-E9 report: seeds 2 and 3 spent about seven
// CPU hours from 1300 to 1350, seed 1 about 1.7 for 125 years). Plays a seed year by year and lists each year's
// milliseconds with the sizes of the lists the tick walks (people, buildings, history records, ledger lines, petitions,
// the registry's occurrences, the stewardship's audits, the suits). With a save year, writes the state at the start of
// that year as a save, and with `--from <save>` plays on from it (for `node --cpu-prof`).
//   tsx scripts/lordSliceSlowdownProbe.ts <seed> <years> <out.json> [saveYear <save.json>]
//   tsx scripts/lordSliceSlowdownProbe.ts --from <save.json> <ticks>
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import type { GameState } from "../src/engine/engine.types";
import { lordBotCommands } from "../src/engine/lordBot";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { decodeSave, encodeSave } from "../src/save/saveCodec";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";

const FIXED_TIME = "2026-10-03T00:00:00.000Z";

function step(state: GameState): GameState {
  let next = state;
  for (const { command } of lordBotCommands(next)) {
    const after = gameReducer(next, command);
    if (after !== next) next = after;
  }
  return advanceTick(next);
}

function sizes(state: GameState) {
  return {
    population: state.population, people: state.persons?.people.length ?? 0, buildings: state.buildings.length,
    history: state.history?.records.length ?? 0, ledger: state.ledger?.entries.length ?? 0,
    petitions: state.stewardship?.petitions.length ?? 0, audits: state.stewardship?.audits.length ?? 0,
    occurrences: state.registry?.occurrences.length ?? 0, suits: state.estates?.suits.length ?? 0, claims: state.estates?.claims.length ?? 0,
    houses: state.houses?.length ?? 0, json: JSON.stringify(state).length,
  };
}

export function slowdownProbe(seed: number, years: number, out: string, saveYear?: number, savePath?: string) {
  let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed }) as GameState;
  const startYear = stateCalendar(state).year;
  const rows: unknown[] = [];
  let year = startYear;
  let started = performance.now();
  while (year < startYear + years) {
    if (saveYear !== undefined && savePath !== undefined && year === saveYear && stateCalendar(state).year === year && state.tick % 4_000 === 0) {
      writeFileSync(savePath, encodeSave({ state, createdAt: FIXED_TIME, savedAt: FIXED_TIME }).bytes);
    }
    state = step(state);
    const now = stateCalendar(state).year;
    if (now !== year) {
      rows.push({ year, ms: Math.round(performance.now() - started), ...sizes(state) });
      writeFileSync(out, `${JSON.stringify({ seed, rows })}\n`);
      year = now;
      started = performance.now();
    }
  }
  return rows;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args[0] === "--from") {
    let state = decodeSave(new Uint8Array(readFileSync(args[1]!))).envelope.state as GameState;
    const ticks = Number(args[2] ?? 1000);
    const started = performance.now();
    for (let tick = 0; tick < ticks; tick += 1) state = step(state);
    process.stdout.write(`${JSON.stringify({ ticks, ms: Math.round(performance.now() - started), ...sizes(state) })}\n`);
  } else {
    const [seed, years, out, saveYear, savePath] = args;
    slowdownProbe(Number(seed ?? 2), Number(years ?? 50), out!, saveYear === undefined ? undefined : Number(saveYear), savePath);
  }
}
