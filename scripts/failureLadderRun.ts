// FAIL-3 gate (spec docs/design/failure-ladder-campaign.md FL-12): runs the bot from a seed's growth opening and records
// when the failure ladder reaches stage 3 (decline: the right lost, by whom) and stage 4 (the house withdrew), when
// chapter 2 begins, and the worst dereliction and arrears on the way. The run stops at the first house change.
//   tsx scripts/failureLadderRun.ts <seed> <maxTicks> [--naive-upkeep] [--naive-reserve] [--famine-response=<choice>] > seed.json
// Without flags, the guardrail bot. `--naive-upkeep` ignores its debts (FL-12), `--naive-reserve` its reserves (FP-6),
// `--famine-response` answers the Great Famine otherwise than relief (FC-2).
import { arrearsPeriods, derelictPermille } from "../src/engine/lordship";
import { lordHouse, lordshipOf, lordTitle } from "../src/engine/lordshipState";
import type { GameState } from "../src/engine/engine.types";
import { stateCalendar } from "../src/engine/scenarioState";
import { runPhase19NaturalGrowth } from "./phase19NaturalGrowth";

const [seedArg, maxArg] = process.argv.slice(2);
const seed = Number(seedArg);
const maxTicks = Number(maxArg ?? 400_000);
const naiveUpkeep = process.argv.includes("--naive-upkeep");
const naiveReserve = process.argv.includes("--naive-reserve");
const famineArg = process.argv.find(arg => arg.startsWith("--famine-response="))?.split("=")[1];
const famineResponse = famineArg as import("../src/content/chapterConfig").FamineResponseChoice | undefined;
const naive = { naiveUpkeep, naiveReserve, famineResponse: famineResponse ?? "relief" };

const when = (state: GameState) => ({ tick: state.tick, year: stateCalendar(state).year });
let stage3: (ReturnType<typeof when> & { cause: string; lost: string | null; by: string }) | null = null;
let stage4: (ReturnType<typeof when> & { withdrew: string; arrived: string }) | null = null;
let chapter2: ReturnType<typeof when> | null = null;
let declines = 0;
let restorations = 0;
let maxDerelict = 0;
let maxArrears = 0;
let previous: GameState | null = null;
let last: GameState | null = null;

class Stop extends Error {}
try {
  runPhase19NaturalGrowth({ targetLots: 24, maxTicks, seed, ...(naiveUpkeep ? { naiveUpkeep: true } : {}), ...(naiveReserve ? { naiveReserve: true } : {}),
    ...(famineResponse === undefined ? {} : { famineResponse }), onTick: state => {
    last = state;
    if (state.tick % 50 !== 0) return;
    maxDerelict = Math.max(maxDerelict, derelictPermille(state) ?? 0);
    maxArrears = Math.max(maxArrears, arrearsPeriods(state));
    const now = lordshipOf(state);
    const was = previous === null ? null : lordshipOf(previous);
    if (now.decline !== null && (was === null || was.decline === null)) {
      declines += 1;
      stage3 ??= { ...when(state), cause: now.decline.cause, lost: now.decline.lost, by: now.decline.by };
    }
    if (was !== null && was.decline !== null && now.decline === null && now.house.order === was.house.order) restorations += 1;
    if ((state.politics?.chapter.number ?? 1) >= 2) chapter2 ??= when(state);
    if (was !== null && now.house.order > was.house.order) {
      stage4 = { ...when(state), withdrew: was.house.name, arrived: now.house.name };
      previous = state;
      throw new Stop();
    }
    previous = state;
  } });
} catch (error) {
  if (!(error instanceof Stop)) throw error;
}
const final = last as GameState | null;
process.stdout.write(`${JSON.stringify({ seed, naive, maxTicks, stage3, stage4, chapter2, declines, restorations,
  maxDerelictPermille: maxDerelict, maxArrearsPeriods: maxArrears,
  final: final === null ? null : { tick: final.tick, year: stateCalendar(final).year, population: final.population, houses: final.houses.length,
    house: lordHouse(final), title: lordTitle(final), lordship: lordshipOf(final) } }, null, 1)}\n`);
