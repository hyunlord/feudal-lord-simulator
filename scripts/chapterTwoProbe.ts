// F2-A probe: runs the guardrail bot from a seed's growth opening to `tick` and writes the state there as a save, with
// the numbers chapter 2's war rules are sized on (treasury, a year of cash by category, households, workers, the wall).
//   tsx scripts/chapterTwoProbe.ts <seed> <tick> <out.save.json>
import { writeFileSync } from "node:fs";
import type { GameState } from "../src/engine/engine.types";
import { stateCalendar } from "../src/engine/scenarioState";
import { treasuryBalance } from "../src/ledger/ledger";
import { encodeSave } from "../src/save/saveCodec";
import { runPhase19NaturalGrowth } from "./phase19NaturalGrowth";

const [seedArg, tickArg, out] = process.argv.slice(2);
const seed = Number(seedArg);
const stopAt = Number(tickArg);
const cash = new Map<string, number>();
let last: GameState | null = null;
class Stop extends Error {}
try {
  runPhase19NaturalGrowth({ targetLots: 24, maxTicks: stopAt + 1, seed, onTick: state => {
    last = state;
    if (state.tick >= stopAt - 4000) for (const entry of state.ledger?.entries ?? []) if (entry.tick === state.tick && entry.account === "cash") cash.set(entry.category, (cash.get(entry.category) ?? 0) + entry.amount);
    if (state.tick >= stopAt) throw new Stop();
  } });
} catch (error) {
  if (!(error instanceof Stop)) throw error;
}
const state = last as GameState | null;
if (state === null) throw new Error("no state");
writeFileSync(out!, encodeSave({ state, createdAt: "2026-09-27T00:00:00.000Z", savedAt: "2026-09-27T00:00:00.000Z" }).bytes);
const occupied = state.houses.filter(house => house.residents > 0);
process.stdout.write(`${JSON.stringify({ seed, tick: state.tick, year: stateCalendar(state).year, era: state.era, population: state.population,
  treasury: treasuryBalance(state), houses: state.houses.length, occupied: occupied.length, chapter: state.politics?.chapter,
  palisadeSegments: state.palisade?.segments.length ?? 0, stoneSegments: state.palisade?.segments.filter(s => s.material === "stone" && s.completed).length ?? 0,
  buildings: state.buildings.length, yearCash: Object.fromEntries([...cash.entries()].sort()) }, null, 1)}\n`);
