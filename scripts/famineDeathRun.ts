// FIX-16 evidence (the Great Famine's dead by the lord's answer): the guardrail's growth bot on one seed, answering the
// famine with each choice in turn; for each, who died between the famine's arrival and its end, by cause, and the
// people at both ends. Hunger ("famine") is a house without bread or among the famine's poor; "famine_year" is a fed
// house's death in a year of dear bread.
//   tsx scripts/famineDeathRun.ts <seed> [choices, e.g. relief,laissez_faire] > seed.json
import type { FamineResponseChoice } from "../src/content/chapterConfig";
import type { GameState } from "../src/engine/engine.types";
import { dearthEndTick } from "../src/engine/eventSchedule";
import { famineRecord } from "../src/engine/politics";
import { stateCalendar } from "../src/engine/scenarioState";
import { treasuryBalance } from "../src/ledger/ledger";
import { runPhase19NaturalGrowth } from "./phase19NaturalGrowth";

const seed = Number(process.argv[2] ?? 1);
const choices = (process.argv[3] ?? "relief,laissez_faire").split(",") as FamineResponseChoice[];

function run(choice: FamineResponseChoice) {
  class Stop extends Error {}
  let atArrival: { tick: number; year: number; population: number; treasury: number; dead: Set<string> } | null = null;
  let last: GameState | null = null;
  try {
    runPhase19NaturalGrowth({ targetLots: 24, maxTicks: 30 * 4_000, seed, famineResponse: choice, onTick: state => {
      last = state;
      const record = famineRecord(state);
      if (record === undefined || state.tick < record.arrivalTick) return;
      if (atArrival === null) atArrival = { tick: state.tick, year: stateCalendar(state).year, population: state.population, treasury: treasuryBalance(state),
        dead: new Set((state.persons?.past ?? []).filter(person => !person.alive).map(person => person.id)) };
      if (state.tick >= dearthEndTick(record)) throw new Stop();
    } });
  } catch (error) {
    if (!(error instanceof Stop)) throw error;
  }
  const start = atArrival as { tick: number; year: number; population: number; treasury: number; dead: Set<string> } | null;
  const end = last as GameState | null;
  if (start === null || end === null) return { choice, reached: false };
  const byCause: Record<string, number> = {};
  for (const person of end.persons?.past ?? []) {
    if (person.alive || start.dead.has(person.id)) continue;
    const cause = person.deathCause ?? "unknown";
    byCause[cause] = (byCause[cause] ?? 0) + 1;
  }
  return { choice, reached: true, arrivalYear: start.year, endYear: stateCalendar(end).year, populationAtArrival: start.population,
    populationAtEnd: end.population, treasuryAtArrival: start.treasury, treasuryAtEnd: treasuryBalance(end), deathsByCause: byCause,
    hungerDeaths: byCause.famine ?? 0, famineYearDeaths: byCause.famine_year ?? 0 };
}

process.stdout.write(`${JSON.stringify({ seed, runs: choices.map(run) }, null, 1)}\n`);
