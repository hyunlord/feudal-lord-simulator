// F0-C1 gates ② and ③ (spec docs/design/flow-chapter-one.md FC-1…FC-6): runs the bot from a seed's growth opening
// through chapter 1 — the famine's entry, the answer, survival and the chapter's end — and records what it cost.
//   tsx scripts/chapterRun.ts <seed> <maxTicks> [--famine-response=relief|price_control|laissez_faire|speculation] > seed.json
import type { FamineResponseChoice } from "../src/content/chapterConfig";
import type { GameState } from "../src/engine/engine.types";
import { chapterEnd, famineRecord } from "../src/engine/politics";
import { calendar, scenarioOf } from "../src/engine/scenarioState";
import { runPhase19NaturalGrowth } from "./phase19NaturalGrowth";

const [seedArg, maxArg] = process.argv.slice(2);
const seed = Number(seedArg);
const maxTicks = Number(maxArg ?? 100_000);
const responseArg = process.argv.find(arg => arg.startsWith("--famine-response="))?.split("=")[1] as FamineResponseChoice | undefined;
const SEASONS = ["spring", "summer", "autumn", "winter"] as const;

let lastState: GameState | null = null;
let treasuryAtArrival: number | null = null;
let departuresInFamine = 0;
let minPopulationInFamine: number | null = null;
let relief = 0;
let released = 0;
runPhase19NaturalGrowth({ targetLots: 24, maxTicks, seed, ...(responseArg === undefined ? {} : { famineResponse: responseArg }), onTick: state => {
  lastState = state;
  if (state.tick % 1000 === 0) {
    // FC-2a: the cash bought and, apart, the granary bread released (in kind, at the market price).
    for (const entry of state.ledger?.entries ?? []) {
      if (entry.tick !== state.tick || entry.category !== "famine_relief") continue;
      if (entry.account === "in_kind") released -= entry.amount; else relief -= entry.amount;
    }
  }
  const famine = famineRecord(state);
  if (famine === undefined) return;
  if (treasuryAtArrival === null) treasuryAtArrival = state.treasuryCoin;
  if (famine.endTick === undefined) {
    departuresInFamine += state.houses.filter(house => house.abandonedTick === state.tick).length;
    minPopulationInFamine = Math.min(minPopulationInFamine ?? state.population, state.population);
  }
} });
const final = lastState as GameState | null;
const startYear = final === null ? 1300 : scenarioOf(final).startYear;
const at = (tick: number | undefined) => {
  if (tick === undefined) return null;
  const date = calendar(tick, startYear);
  return { tick, year: date.year, season: SEASONS[date.season] };
};
const famine = final === null ? undefined : famineRecord(final);
const era = final?.historicalEras?.find(entry => entry.id === "famine");
const end = final === null ? null : chapterEnd(final);
process.stdout.write(`${JSON.stringify({ seed, famineResponse: responseArg ?? "relief", maxTicks,
  famineEra: era === undefined ? null : { ...at(era.enteredTick), forced: era.forced },
  famine: famine === undefined ? null : { id: famine.id, arrival: at(famine.arrivalTick), end: at(famine.endTick), harvestFromYear: famine.harvestFromYear,
    harvestYears: famine.harvestYears, response: famine.response ?? null, populationAtArrival: famine.populationAtArrival ?? null,
    populationAtEnd: famine.populationAtEnd ?? null, losses: famine.losses },
  departuresInFamine, minPopulationInFamine, treasuryAtArrival, reliefSpent: relief, reliefReleasedValue: released,
  chapterEnd: end === null ? null : { ...at(end.tick), chronicle: end.chronicle },
  petitions: final?.politics?.petitions ?? [], rights: final?.politics?.rights ?? [], merchantGauge: final?.politics?.merchantGauge ?? null,
  final: { tick: final?.tick ?? null, era: final?.era ?? null, population: final?.population ?? null, houses: final?.houses.length ?? null,
    treasury: final?.treasuryCoin ?? null } }, null, 1)}\n`);
