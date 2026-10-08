// DEC-CARD-2 (steward) lord-mode states for the steward's captures (scripts/deccard2StewardCaptures.mjs), from the lord
// slice (core:lord_slice) seed 3 as the lord bot plays it (`lordBotCommands` each tick, as scripts/deccardResultsStates.ts),
// with two standing policies the lord set on the first day through the game's own command (`set_standing_policy`: the
// heriot lightly, the stall dispute strictly) so the season holds more than the custom:
//  - `season-eve`: 40 ticks before the first season close whose season the steward worked in (two matters or more, a
//    faction moved by a policy) — the season card opens at the close with "청지기가 처리한 일".
// Beside it steward.json (what it holds).
//   tsx scripts/deccard2StewardStates.ts <out-dir>
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("엔진 영주 모드 1300→(scripts/deccard2StewardStates.ts)", { remote: "scripts/remote/run.sh render-DC2-steward-<what>-<sha7> --light -- node_modules/.bin/tsx scripts/deccard2StewardStates.ts <디렉터리>", entry: import.meta.url });
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { stewardReport } from "../src/engine/decisionReads";
import { lordBotCommands } from "../src/engine/lordBot";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";

const SEED = 3;
const SEASON = 1_000;
const END = 10 * 4 * SEASON;
const out = process.argv[2];
if (out === undefined) throw new Error("usage: tsx scripts/deccard2StewardStates.ts <out-dir>");
mkdirSync(out, { recursive: true });

let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: SEED })!;
state = gameReducer(state, { type: "set_standing_policy", kind: "heriot", setting: "lenient" });
state = gameReducer(state, { type: "set_standing_policy", kind: "stall_dispute", setting: "strict" });
let found: Record<string, unknown> | null = null;
while (state.tick < END && found === null) {
  if (state.tick % SEASON === SEASON - 40 && state.tick > SEASON) {
    const start = state.tick - (SEASON - 40);
    const report = stewardReport(state, start, start + SEASON);
    if (report.handled.length + report.events.length >= 2 && report.policyRelations.length > 0) {
      const date = stateCalendar(state);
      found = { seed: SEED, tick: state.tick, year: date.year, season: date.season, seasonStart: start, handled: report.handled.length, events: report.events.length,
        brought: report.brought.length, lapsed: report.lapsed, policyRelations: report.policyRelations };
      writeFileSync(join(out, "season-eve.json"), JSON.stringify(state));
      process.stderr.write(`season-eve at tick ${state.tick} (${date.year}) ${JSON.stringify(found)}\n`);
      break;
    }
  }
  for (const { command } of lordBotCommands(state)) state = gameReducer(state, command);
  state = advanceTick(state);
}
if (found === null) throw new Error(`no season with the steward's work by tick ${state.tick}`);
writeFileSync(join(out, "steward.json"), JSON.stringify({ "season-eve": found }, null, 1));
