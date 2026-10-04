// FIX-17 gate: a lord-mode campaign game played by the lord-mode bot for N years (Astra's long runs: newGameState
// campaign lord, a land, a seed), saved and loaded at every year's turn — the save decodes and the decoded state is the
// state saved. Writes its rows as it goes (year, ok, bytes, the problem if any), so a stopped run leaves its part.
//   tsx scripts/saveRoundTripRun.ts <seed> <land> <years> <out.json>
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { GameState } from "../src/engine/engine.types";
import { lordBotCommands } from "../src/engine/lordBot";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { decodeSave, encodeSave } from "../src/save/saveCodec";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";

const FIXED_TIME = "2026-10-04T00:00:00.000Z";

export function saveRoundTripRun(seed: number, land: string, years: number, out: string) {
  let state = newGameState({ scenarioId: "core:campaign_market_town", mode: "lord", archetypeId: land, seed }) as GameState;
  const startYear = stateCalendar(state).year;
  const rows: { year: number; tick: number; ok: boolean; bytes: number; ms: number; problem?: string }[] = [];
  let year = startYear;
  let started = performance.now();
  while (year < startYear + years) {
    for (const { command } of lordBotCommands(state)) {
      const next = gameReducer(state, command);
      if (next !== state) state = next;
    }
    state = advanceTick(state);
    const now = stateCalendar(state).year;
    if (now === year) continue;
    let ok = false;
    let bytes = 0;
    let problem: string | undefined;
    try {
      const encoded = encodeSave({ state, createdAt: FIXED_TIME, savedAt: FIXED_TIME });
      bytes = encoded.bytes.length;
      const decoded = decodeSave(encoded.bytes).envelope.state;
      ok = JSON.stringify(decoded) === JSON.stringify(state);
      if (!ok) problem = "the decoded state differs from the state saved";
    } catch (error) {
      problem = (error as Error).message;
    }
    rows.push({ year: now, tick: state.tick, ok, bytes, ms: Math.round(performance.now() - started), ...(problem === undefined ? {} : { problem }) });
    writeFileSync(out, `${JSON.stringify({ seed, land, years, rows })}\n`);
    year = now;
    started = performance.now();
  }
  return rows;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [seed, land, years, out] = process.argv.slice(2);
  saveRoundTripRun(Number(seed ?? 1), land ?? "core:open_field", Number(years ?? 150), out!);
}
