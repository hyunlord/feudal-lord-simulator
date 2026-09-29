// NAT-1 audit states: a new game on each of the five lands (ARCH-1, seed 1), the guardrail bot's autoplay for
// `ticks` ticks (a village with its first houses, fields and walkers), saved as current-format bare states.
//   npx tsx scripts/nat1LandStates.ts <out-dir> [ticks=30000]
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { DEFAULT_SCENARIO_ID } from "../src/content/scenario/coreScenarios";
import { mapArchetypes, newGameState } from "../src/state/newGame";
import { createAutoplayTraceDriver } from "./economyHarnessAutoplay";

const [out, ticksArg] = process.argv.slice(2);
mkdirSync(out!, { recursive: true });
const ticks = Number(ticksArg ?? 30_000);
for (const land of mapArchetypes()) {
  let state = newGameState({ scenarioId: DEFAULT_SCENARIO_ID, archetypeId: land.id, seed: 1 });
  if (state === null) { console.log(JSON.stringify({ land: land.id, error: "no new game" })); continue; }
  const driver = createAutoplayTraceDriver();
  for (let step = 0; step < ticks; step += 1) state = advanceTick(driver.apply(state));
  const name = land.id.split(":").pop()!;
  writeFileSync(join(out!, `${name}.json`), JSON.stringify(state));
  console.log(JSON.stringify({ land: land.id, tick: state.tick, year: stateCalendar(state).year, buildings: state.buildings.length, walkers: state.walkers.length }));
}
