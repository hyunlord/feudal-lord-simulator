// Long-run probe (the user's request 2026-10-06, before EXT-2's start and end years): lord mode played by the lord-mode
// bot past the game's end (1450; the simulation itself runs on — only the ending is a screen) to a given year. Every ten
// years: the mean tick time over that decade and what the state holds — each top-level part's JSON size and every
// array one or two levels down with its length — so what grows with time (the ledger, the chronicle, the dead, event
// records…) shows. Every fifty years also: the save's size, serialise and load times, and the heap after a GC. An error
// stops the run and is recorded with its year. Diagnosis only.
//   node --expose-gc --import tsx scripts/longRunProbe.ts <seed> <toYear> <out.json>
import { writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import type { GameState } from "../src/engine/engine.types";
import { lordBotCommands } from "../src/engine/lordBot";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { decodeSave, encodeSave } from "../src/save/saveCodec";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";

const [seedText, toYearText, out] = process.argv.slice(2);
const seed = Number(seedText ?? 1);
const toYear = Number(toYearText ?? 1600);
const gc = (globalThis as { gc?: () => void }).gc;

/** Arrays one or two levels down, by path, with their length and JSON size. */
function arrays(state: GameState): Record<string, { length: number; bytes: number }> {
  const found: Record<string, { length: number; bytes: number }> = {};
  const visit = (value: unknown, path: string, depth: number) => {
    if (Array.isArray(value)) { found[path] = { length: value.length, bytes: JSON.stringify(value).length }; return; }
    if (depth >= 2 || typeof value !== "object" || value === null) return;
    for (const [key, inner] of Object.entries(value)) visit(inner, path === "" ? key : `${path}.${key}`, depth + 1);
  };
  visit(state, "", 0);
  return found;
}

function parts(state: GameState): Record<string, number> {
  return Object.fromEntries(Object.entries(state).map(([key, value]) => [key, JSON.stringify(value ?? null).length]));
}

let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed }) as GameState;
const startYear = stateCalendar(state).year;
const rows: unknown[] = [];
let decadeStart = performance.now();
let decadeTicks = 0;
let year = startYear;
let error: { year: number; tick: number; message: string } | null = null;
const record = (full: boolean) => {
  const row: Record<string, unknown> = { year, tick: state.tick, population: state.population, msPerTick: decadeTicks === 0 ? null : (performance.now() - decadeStart) / decadeTicks,
    stateJsonBytes: JSON.stringify(state).length, parts: parts(state), arrays: arrays(state) };
  if (full) {
    const encoded = encodeSave({ state, createdAt: "1970-01-01T00:00:00.000Z", savedAt: "1970-01-01T00:00:00.000Z" });
    const loadStart = performance.now();
    decodeSave(encoded.bytes);
    row.saveBytes = encoded.bytes.length;
    row.saveSerializeMs = encoded.saveSerializeMs;
    row.saveLoadMs = performance.now() - loadStart;
    gc?.();
    row.heapUsedMb = Math.round(process.memoryUsage().heapUsed / 1e5) / 10;
  }
  rows.push(row);
  writeFileSync(out!, JSON.stringify({ seed, toYear, startYear, rows, error }));
};
record(true);
try {
  while (stateCalendar(state).year < toYear) {
    for (const { command } of lordBotCommands(state)) { const next = gameReducer(state, command); if (next !== state) state = next; }
    state = advanceTick(state);
    decadeTicks += 1;
    const now = stateCalendar(state).year;
    if (now !== year) {
      year = now;
      if ((year - startYear) % 10 === 0) {
        record((year - startYear) % 50 === 0);
        decadeStart = performance.now();
        decadeTicks = 0;
      }
    }
  }
} catch (caught) {
  error = { year: stateCalendar(state).year, tick: state.tick, message: caught instanceof Error ? `${caught.message}\n${caught.stack?.split("\n").slice(0, 6).join("\n")}` : String(caught) };
  writeFileSync(out!, JSON.stringify({ seed, toYear, startYear, rows, error }));
  throw caught;
}
