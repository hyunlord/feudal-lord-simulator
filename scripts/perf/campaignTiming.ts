// SMOOTH-2E: where a long campaign run's time goes — per calendar year, the run's wall time and one tick's own cost
// (the median of 9 advanceTick calls on that year's state, pure), so the growth bot's share is the rest.
//   tsx scripts/perf/campaignTiming.ts <archetypeId> <seed> [lastYear=1450] [saveDir] > timing.jsonl
import { mkdirSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import type { GameState } from "../../src/engine/engine.types";
import { stateCalendar } from "../../src/engine/scenarioState";
import { advanceTick } from "../../src/engine/tick";
import { runPhase19NaturalGrowth } from "../phase19NaturalGrowth";

const [archetypeId = "core:fen_drainage", seedText = "1", lastYearText = "1450", saveDir] = process.argv.slice(2);
const seed = Number(seedText); const lastYear = Number(lastYearText);
const YEAR = 4000;
class Stop extends Error {}
let yearStarted = performance.now(); let lastYearSeen = 1300; const started = performance.now();
const tickCost = (state: GameState) => {
  const samples: number[] = [];
  for (let i = 0; i < 9; i++) { const at = performance.now(); advanceTick(state); samples.push(performance.now() - at); }
  return samples.sort((a, b) => a - b)[4]!;
};
if (saveDir !== undefined) mkdirSync(saveDir, { recursive: true });
try {
  runPhase19NaturalGrowth({ targetLots: 24, maxTicks: (lastYear - 1300 + 1) * YEAR, seed, archetypeId, onTick: state => {
    const year = stateCalendar(state).year;
    if (year !== lastYearSeen) {
      const wall = (performance.now() - yearStarted) / 1000;
      const water = state.tiles.filter(tile => tile.terrain === "water").length;
      process.stdout.write(`${JSON.stringify({ year: lastYearSeen, wallSeconds: Math.round(wall * 10) / 10, tickMs: Math.round(tickCost(state) * 100) / 100,
        population: state.population, buildings: state.buildings.length, walkers: state.walkers.length, sites: state.constructionSites.length,
        roads: state.tiles.filter(tile => tile.hasRoad).length, water, pathCache: Object.keys(state.pathCache ?? {}).length,
        heapMB: Math.round(process.memoryUsage().heapUsed / 1e6), elapsedMinutes: Math.round((performance.now() - started) / 6000) / 10 })}\n`);
      if (saveDir !== undefined && wall > 60) writeFileSync(`${saveDir}/${archetypeId.replace("core:", "")}-${seed}-${lastYearSeen}.json.gz`, gzipSync(JSON.stringify(state)));
      lastYearSeen = year; yearStarted = performance.now();
    }
    if (year > lastYear) throw new Stop();
  }, additionalAcceptance: state => stateCalendar(state).year > lastYear });
} catch (error) { if (!(error instanceof Stop)) throw error; }
