// UI-3 gate 4: a naive-reserve bot town (F0-A FP-6, the guardrail bot with its reserve measures off) at the first
// sampled tick where households are leaving and a house stands abandoned; written as the game state the browser
// captures open (scripts/ui3Captures.mjs).
//   tsx scripts/ui3PressureState.ts <seed> <maxTicks> <out.json>
import { writeFileSync } from "node:fs";
import type { GameState } from "../src/engine/engine.types";
import { runPhase19NaturalGrowth } from "./phase19NaturalGrowth";

const [seedArg, maxArg, out] = process.argv.slice(2);
let found: GameState | null = null;
runPhase19NaturalGrowth({ targetLots: 24, maxTicks: Number(maxArg ?? 16_000), seed: Number(seedArg), naiveReserve: true, onTick: state => {
  if (found !== null || state.tick % 50 !== 0) return;
  const leaving = state.houses.some(house => house.leavingSinceTick !== undefined && house.abandonedTick === undefined);
  const abandoned = state.houses.some(house => house.abandonedTick !== undefined);
  if (leaving && abandoned) found = state;
} });
if (found === null) { console.error("no tick with both leaving and abandoned households"); process.exit(1); }
const state = found as GameState;
writeFileSync(out!, JSON.stringify(state));
console.log(JSON.stringify({ tick: state.tick, leaving: state.houses.filter(h => h.leavingSinceTick !== undefined && h.abandonedTick === undefined).map(h => h.buildingId),
  abandoned: state.houses.filter(h => h.abandonedTick !== undefined).map(h => h.buildingId) }));
