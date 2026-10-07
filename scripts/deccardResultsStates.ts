// DEC-CARD (result side) lord-mode states for the result captures (scripts/deccardResultsCaptures.mjs), from the lord slice
// (core:lord_slice) seed 3 as the lord bot plays it (scripts/lmr1PetitionStates.ts' loop: `lordBotCommands` each tick —
// the home petitions as they come, the policies, the town's requests). Nothing injected:
//  - `actual-in`: the first tick the ledger wrote a big decision's actual (history fillActuals) — its chip's season;
//  - `year-eve`: 40 ticks before the first year turn after a year with a big decision and a faction's move (the year's
//    card opens at the next year's first tick the game is watched, so the capture runs the town over the turn).
// Beside them results.json (what each is).
//   tsx scripts/deccardResultsStates.ts <out-dir>
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("엔진 영주 모드 1300→(scripts/deccardResultsStates.ts)", { remote: "scripts/remote/run.sh render-DECCARD-results-<sha7> --light -- node_modules/.bin/tsx scripts/deccardResultsStates.ts <디렉터리>", entry: import.meta.url });
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import type { GameState } from "../src/engine/engine.types";
import { lordBotCommands } from "../src/engine/lordBot";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";

const SEED = 3;
const YEAR = 4_000;
const END = 10 * YEAR;
const out = process.argv[2];
if (out === undefined) throw new Error("usage: tsx scripts/deccardResultsStates.ts <out-dir>");
mkdirSync(out, { recursive: true });
const found: Record<string, Record<string, unknown>> = {};
const save = (name: string, state: GameState, about: Record<string, unknown>) => {
  const date = stateCalendar(state);
  found[name] = { seed: SEED, tick: state.tick, year: date.year, season: date.season, ...about };
  writeFileSync(join(out, `${name}.json`), JSON.stringify(state));
  process.stderr.write(`${name} at tick ${state.tick} (${date.year}) ${JSON.stringify(about)}\n`);
};

/** The year's decision records and faction moves (the year card has both to show). */
const yearHas = (state: GameState) => {
  const from = Math.floor(state.tick / YEAR) * YEAR;
  const records = (state.history?.records ?? []).filter(record => record.tick >= from && record.tick < from + YEAR);
  return { decisions: records.filter(record => record.kind === "decision").length, relations: records.filter(record => record.template === "faction.relation").length };
};

let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: SEED })!;
let pending = 0;
while (state.tick < END && (found["actual-in"] === undefined || found["year-eve"] === undefined)) {
  // An actual written this tick: a pending decision left the ledger's list (the record keeps its actual).
  const now = state.history?.pendingActuals.length ?? 0;
  const filled = now < pending;
  pending = now;
  if (found["actual-in"] === undefined && filled) {
    const written = (state.history?.records ?? []).find(record => record.decision?.actual !== undefined && record.decision.actualDueTick === state.tick);
    if (written !== undefined) save("actual-in", state, { record: written.id, template: written.template, predicted: written.decision!.predicted, actual: written.decision!.actual });
  }
  if (found["year-eve"] === undefined && state.tick % YEAR === YEAR - 40) {
    const has = yearHas(state);
    if (has.decisions > 0 && has.relations > 0) save("year-eve", state, { reviewYear: stateCalendar(state).year, ...has });
  }
  for (const { command } of lordBotCommands(state)) state = gameReducer(state, command);
  state = advanceTick(state);
}
writeFileSync(join(out, "results.json"), JSON.stringify(found, null, 1));
process.stderr.write(`found ${Object.keys(found).join(", ")} (end tick ${state.tick})\n`);
