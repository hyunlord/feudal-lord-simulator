// ARCH-1 gate ① (spec docs/design/map-archetypes.md AR-7): the guardrail's growth bot on one land and seed, run until
// chapter 1 ends (a market town through the Great Famine with 60 % of its people, `chapterEnd(state, 1)`) or the
// calendar reaches `toYear` (default 1330: the famine waits at most five years past 1315 and lasts about three).
//   tsx scripts/archetypeChapterOne.ts <archetypeId> <seed> [toYear] > run.json
// Several at once: tsx scripts/archetypeChapterOne.ts all <seeds, e.g. 1,2,3> [toYear] (one child per run).
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MAP_ARCHETYPE_IDS } from "../src/content/scenario/archetypes";
import { GREAT_FAMINE_EVENT_ID } from "../src/content/eventConfig";
import type { GameState } from "../src/engine/engine.types";
import { chapterEnd } from "../src/engine/politics";
import { stateCalendar } from "../src/engine/scenarioState";
import { treasuryBalance } from "../src/ledger/ledger";
import { runPhase19NaturalGrowth } from "./phase19NaturalGrowth";

const YEAR = 4000;

export function archetypeChapterOne(archetypeId: string, seed: number, toYear = 1330) {
  let last: GameState | null = null;
  const yearly: { year: number; population: number; era: string; lots: number; treasury: number }[] = [];
  class Stop extends Error {}
  let report: ReturnType<typeof runPhase19NaturalGrowth> | null = null;
  const started = performance.now();
  try {
    report = runPhase19NaturalGrowth({ targetLots: 24, maxTicks: (toYear - 1300) * YEAR, seed, archetypeId, onTick: state => {
      last = state;
      if (state.tick % YEAR === 0) yearly.push({ year: stateCalendar(state).year, population: state.population, era: state.era,
        lots: state.houses.filter(house => house.residents > 0).length, treasury: treasuryBalance(state) });
      if (chapterEnd(state) !== null) throw new Stop();
    } });
  } catch (error) {
    if (!(error instanceof Stop)) throw error;
  }
  const final = last as GameState | null;
  const end = final === null ? null : chapterEnd(final);
  const famine = final?.events?.records.find(record => record.defId === GREAT_FAMINE_EVENT_ID);
  return {
    archetypeId, seed, toYear, completed: end !== null,
    chapterEndYear: end === null || final === null ? null : stateCalendar({ ...final, tick: end.tick }).year,
    stoppedBy: end !== null ? "chapter-1-end" : report?.stopReason ?? "unknown",
    failures: report?.failures ?? [],
    final: final === null ? null : { tick: final.tick, year: stateCalendar(final).year, population: final.population, era: final.era,
      abandoned: final.settlement?.outcome === "abandoned", treasury: treasuryBalance(final) },
    famine: famine === undefined ? null : { arrivalTick: famine.arrivalTick, populationAtArrival: famine.populationAtArrival ?? null,
      populationAtEnd: famine.populationAtEnd ?? null, endTick: famine.endTick ?? null },
    yearly, elapsedSeconds: Math.round((performance.now() - started) / 100) / 10,
  };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [archetypeArg, seedArg, yearArg] = process.argv.slice(2);
  const toYear = yearArg === undefined ? 1330 : Number(yearArg);
  if (archetypeArg === "all") {
    // One child per land and seed, in turn (the DGX task runs the lands side by side).
    const rows = [];
    for (const id of MAP_ARCHETYPE_IDS) for (const seed of (seedArg ?? "1,2,3").split(",").map(Number)) {
      rows.push(JSON.parse(execFileSync(process.execPath, [...process.execArgv, fileURLToPath(import.meta.url), id, String(seed), String(toYear)],
        { maxBuffer: 64 * 1024 * 1024 }).toString()));
    }
    process.stdout.write(`${JSON.stringify(rows, null, 1)}\n`);
  } else {
    process.stdout.write(`${JSON.stringify(archetypeChapterOne(archetypeArg!, Number(seedArg ?? 1), toYear), null, 1)}\n`);
  }
}
