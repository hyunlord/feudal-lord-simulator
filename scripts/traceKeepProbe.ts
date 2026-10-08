// TRACE-KEEP gate (the user's ruling 2026-10-09): the lord's slice played 20 years by the lord-mode bot; at its end the
// years 1300–1308 opened as the end page opens them (`yearReview`) — each big decision with the lines that followed it
// (`traceInRange`) and who remembers it — and the memory fold (LONGRUN-1) run on the end state keeps those memories.
//   tsx scripts/traceKeepProbe.ts <seed> [years] > out.json
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { decisionRemembers, traceInRange, yearReview } from "../src/engine/decisionReads";
import { isBigDecision, traceOf } from "../src/engine/decisionTrace";
import type { GameState } from "../src/engine/engine.types";
import { lordBotCommands } from "../src/engine/lordBot";
import { foldFactionMemories } from "../src/engine/memoryFold";
import { scenarioOf, stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";

export function traceKeepProbe(seed: number, years = 20) {
  let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed }) as GameState;
  const start = stateCalendar(state).year;
  while (stateCalendar(state).year < start + years) {
    for (const { command } of lordBotCommands(state)) { const next = gameReducer(state, command); if (next !== state) state = next; }
    state = advanceTick(state);
  }
  const yearTicks = 4_000;
  const startYear = scenarioOf(state).startYear;
  const folded = foldFactionMemories(state, state.tick - 3 * yearTicks);
  const rows = [];
  for (let year = startYear; year <= startYear + 8; year += 1) {
    const review = yearReview(state, year);
    const big = review.decisions.filter(decision => decision.weights.length > 0 && decision.by === "lord");
    rows.push({ year, big: big.map(decision => {
      const followed = traceInRange(state, decision.tick, state.tick).filter(row => row.decisionId === decision.decisionId);
      const remembers = decisionRemembers(state, decision.decisionId);
      return { id: decision.decisionId, kind: decision.kind, weights: decision.weights, followed: followed.length, keys: [...new Set(followed.map(row => row.key))],
        remembers: remembers.length, remembersAfterFold: decisionRemembers(folded, decision.decisionId).length };
    }), summarised: review.summarised });
  }
  const trace = traceOf(state);
  return { seed, years, endYear: stateCalendar(state).year, traceDecisions: trace.decisions.length, bigInTrace: trace.decisions.filter(isBigDecision).length, rows };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [seed = "1", years = "20"] = process.argv.slice(2);
  process.stdout.write(`${JSON.stringify(traceKeepProbe(Number(seed), Number(years)))}\n`);
}
