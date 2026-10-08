// PLAY-2 (Astra's second lord-mode play, the screen's part) lord-mode states for the captures (scripts/play2Captures.mjs):
// the lord's slice seed 3 as the lord bot plays it (its registry answers and the steward's), each state taken at the first
// tick it holds — nothing injected:
//  - `chronicle-cards`: the history holds a registry card answered by the lord and a petition the steward answered
//    (the chronicle's list names them: chronicleRecordCard); beside it the lines the list should show;
//  - `famine-answered`: the Great Famine answered by the bot, 60 ticks on (its card's bottleneck and the next lever:
//    famineAfterFacts).
// Beside them play2-states.json (each: the seed, the tick, the year and what it holds).
//   tsx scripts/play2States.ts <out-dir> [lastYear=1324]
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("영주 모드 1300→(scripts/play2States.ts)", { remote: "scripts/remote/run.sh render-PLAY2-captures-<sha7> --light -- bash scripts/play2Captures.sh", entry: import.meta.url });
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { preparedness } from "../src/engine/crisisReads";
import type { GameState } from "../src/engine/engine.types";
import { lordBotCommands } from "../src/engine/lordBot";
import { famineStatus } from "../src/engine/politics";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";
import { chronicleRecordCard } from "../src/ui/chronicle/decisionThreadModel";
import { famineAfterFacts } from "../src/ui/lord/advice/famineAfter";

const out = process.argv[2];
if (out === undefined) throw new Error("usage: tsx scripts/play2States.ts <out-dir> [lastYear]");
const lastYear = Number(process.argv[3] ?? 1324);
mkdirSync(out, { recursive: true });
const found: Record<string, Record<string, unknown>> = {};
const save = (name: string, state: GameState, about: Record<string, unknown>) => {
  const date = stateCalendar(state);
  found[name] = { seed, tick: state.tick, year: date.year, season: date.season, ...about };
  writeFileSync(join(out, `${name}.json`), JSON.stringify(state));
  process.stderr.write(`${name} at tick ${state.tick} (${date.year}) ${JSON.stringify(about)}\n`);
};
const step = (state: GameState) => { let next = state; for (const { command } of lordBotCommands(next)) next = gameReducer(next, command); return advanceTick(next); };
/** The card answers the chronicle's list names (a registry card the lord answered, a petition the steward did). */
const cardLines = (state: GameState) => (state.history?.records ?? []).filter(record => record.template === "decision.steward"
  || (record.template === "decision.card" && record.params?.command === "answer_registry_offer"))
  .map(record => ({ id: record.id, template: record.template, line: chronicleRecordCard(state, { key: record.id, tick: record.tick, record, bundle: null }).sentence }));

const seed = 3;
let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed })!;
let answeredAt: number | null = null;
const started = Date.now();
while (stateCalendar(state).year <= lastYear && found["famine-answered"] === undefined) {
  state = step(state);
  if (found["chronicle-cards"] === undefined && state.tick % 100 === 0) {
    const lines = cardLines(state);
    if (lines.some(entry => entry.template === "decision.card") && lines.some(entry => entry.template === "decision.steward")) save("chronicle-cards", state, { lines });
  }
  const famine = famineStatus(state);
  if (answeredAt === null && famine !== null && famine.response !== null) answeredAt = state.tick;
  if (answeredAt !== null && state.tick === answeredAt + 60) {
    save("famine-answered", state, { response: famine?.response ?? null, stage: famine?.stage ?? null, weakPoints: preparedness(state).weakPoints, facts: famineAfterFacts(state) });
  }
}
process.stderr.write(`ran to ${stateCalendar(state).year} (tick ${state.tick}) in ${Math.round((Date.now() - started) / 1000)} s\n`);
writeFileSync(join(out, "play2-states.json"), JSON.stringify(found, null, 1));
const missing = ["chronicle-cards", "famine-answered"].filter(name => found[name] === undefined);
if (missing.length > 0) { process.stderr.write(`missing: ${missing.join(", ")}\n`); process.exit(1); }
