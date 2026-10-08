// LM-R3 phase 2a (the lord slice's start and end screens) lord-mode states for the captures and the geometry rows of the
// set `slice` (src/ui/slice/surfaces.ts): the lord's slice as the lord bot plays it, from its first tick to its end
// (`lordSliceOutcome(state).ended`: twenty years, or five after a second estate), each state taken at the first tick it
// holds:
//  - `slice-eve`: 40 ticks before the slice's end (the capture runs the town over it: the end page opens by itself);
//  - `slice-end`: the first tick of the end (the page is due: ended, unseen, within its season).
// No mark is injected (the bot never marks): neither state opens a year card after the load, the end page does.
// Beside them slice-states.json (each: the seed, the tick, the year, the outcome) and each year's milliseconds.
//   tsx scripts/sliceEndsStates.ts <out-dir> [seed=3]
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("영주 모드 1300→조각의 끝(scripts/sliceEndsStates.ts)", { remote: "scripts/remote/run.sh render-LMR3-slice-states-<sha7> --detach --keep -- bash -c 'node_modules/.bin/tsx scripts/sliceEndsStates.ts \"$HOME/fls-slice-end-states\"'", entry: import.meta.url });
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import type { GameState } from "../src/engine/engine.types";
import { lordBotCommands } from "../src/engine/lordBot";
import { lordSliceEndTick, lordSliceOutcome } from "../src/engine/lordSlice";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";

const EVE_TICKS = 40;
const out = process.argv[2];
if (out === undefined) throw new Error("usage: tsx scripts/sliceEndsStates.ts <out-dir> [seed]");
const seed = Number(process.argv[3] ?? 3);
mkdirSync(out, { recursive: true });
const found: Record<string, Record<string, unknown>> = {};
const years: { year: number; ms: number; population: number }[] = [];
const save = (name: string, state: GameState, about: Record<string, unknown>) => {
  const date = stateCalendar(state);
  found[name] = { seed, tick: state.tick, year: date.year, season: date.season, ...about };
  writeFileSync(join(out, `${name}.json`), JSON.stringify(state));
  process.stderr.write(`${name} at tick ${state.tick} (${date.year}) ${JSON.stringify(about)}\n`);
};
const step = (state: GameState) => { let next = state; for (const { command } of lordBotCommands(next)) next = gameReducer(next, command); return advanceTick(next); };

let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed })!;
let yearStarted = Date.now();
let year = stateCalendar(state).year;
while (found["slice-end"] === undefined) {
  state = step(state);
  const now = stateCalendar(state).year;
  if (now !== year) {
    years.push({ year, ms: Date.now() - yearStarted, population: state.population });
    process.stderr.write(`${year}: ${Date.now() - yearStarted} ms, population ${state.population}\n`);
    year = now; yearStarted = Date.now();
  }
  if (found["slice-eve"] === undefined && lordSliceEndTick(state) - state.tick <= EVE_TICKS && lordSliceEndTick(state) > state.tick) save("slice-eve", state, { endTick: lordSliceEndTick(state) });
  const outcome = lordSliceOutcome(state);
  if (outcome?.ended === true) save("slice-end", state, { reason: outcome.reason, endTick: outcome.endTick, summary: outcome.summary });
}

writeFileSync(join(out, "slice-states.json"), JSON.stringify({ found, years }, null, 1));
const missing = ["slice-eve", "slice-end"].filter(name => found[name] === undefined);
if (missing.length > 0) { process.stderr.write(`missing: ${missing.join(", ")}\n`); process.exit(1); }
