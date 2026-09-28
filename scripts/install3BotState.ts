// INSTALL-3 UI capture state for the bot's label: the guardrail bot's natural growth (seed N, scripts/phase19NaturalGrowth)
// run until its next action is `set_farmstead_crop` (a barn to barley for the ale, AL-8), checked at the bot's cadence
// once ale is required and a malt kiln stands. Writes bot-crop.json (a current-format bare state) and bot-crop.moment.json.
//   npx tsx scripts/install3BotState.ts <out-dir> <seed> <maxTicks>
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { aleRequired } from "../src/engine/ale";
import { decideNextAction } from "../src/engine/autoplay";
import { AUTOPLAY_TICK_CADENCE } from "../src/engine/autoplay.types";
import type { GameState } from "../src/engine/engine.types";
import { stateCalendar } from "../src/engine/scenarioState";
import { runPhase19NaturalGrowth } from "./phase19NaturalGrowth";

const [out, seedArg, maxArg] = process.argv.slice(2);
mkdirSync(out!, { recursive: true });
class Stop extends Error {}
let found: Record<string, unknown> | null = null;
try {
  runPhase19NaturalGrowth({ targetLots: 24, maxTicks: Number(maxArg), seed: Number(seedArg), onTick: (state: GameState) => {
    if (state.tick % AUTOPLAY_TICK_CADENCE !== 0 || !aleRequired(state) || !state.buildings.some(building => building.kind === "malt_kiln")) return;
    const action = decideNextAction(state);
    if (action.kind !== "set_farmstead_crop") return;
    const barn = state.buildings.find(building => building.id === action.buildingId)!;
    found = { tick: state.tick, year: stateCalendar(state).year, seed: Number(seedArg), action: { kind: action.kind, buildingId: action.buildingId, crop: action.crop }, barnTile: [barn.tx, barn.ty] };
    writeFileSync(join(out!, "bot-crop.json"), JSON.stringify(state));
    throw new Stop();
  } });
} catch (error) {
  if (!(error instanceof Stop)) throw error;
}
writeFileSync(join(out!, "bot-crop.moment.json"), `${JSON.stringify(found, null, 1)}\n`);
console.log(JSON.stringify(found));
process.exitCode = found === null ? 1 : 0;
