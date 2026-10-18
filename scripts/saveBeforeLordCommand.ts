/**
 * The lord slice played by the lord bot until it first sends a command of the given type; the state just before that
 * command is written as a save (gzipped) — a natural state for a test that starts at that moment instead of replaying the
 * bot's whole history (the user's note 2026-10-15: history-bound tests start from a saved state when they next break).
 * Usage: npx tsx scripts/saveBeforeLordCommand.ts <seed> <commandType> <maxTicks> <out.save.json.gz>
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import type { GameState } from "../src/engine/engine.types";
import { lordBotCommands } from "../src/engine/lordBot";
import { advanceTick } from "../src/engine/tick";
import { encodeSave } from "../src/save/saveCodec";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";

const [seedArg, type, maxArg, out] = process.argv.slice(2);
let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: Number(seedArg) }) as GameState;
const max = Number(maxArg);
let found = false;
while (!found && state.tick < max) {
  for (const { command } of lordBotCommands(state)) {
    if (command.type === type) { found = true; break; }
    const next = gameReducer(state, command); if (next !== state) state = next;
  }
  if (!found) state = advanceTick(state);
}
if (!found) { console.error(`no ${type} before tick ${max}`); process.exit(1); }
writeFileSync(out!, gzipSync(encodeSave({ state, createdAt: "2026-10-18T00:00:00.000Z", savedAt: "2026-10-18T00:00:00.000Z" }).bytes));
console.log(JSON.stringify({ seed: Number(seedArg), type, tick: state.tick, out }));
