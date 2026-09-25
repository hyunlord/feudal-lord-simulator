// F0-A gate ① (spec docs/design/flow-pressure.md FP-3, FP-6): runs the bot from a seed's growth opening and records
// when the failure ladder first reaches stage 1 (떠날 준비) and stage 2 (이탈·황폐), with the calendar season.
//   tsx scripts/pressureGateRun.ts <seed> <maxTicks> [--naive-reserve] > seed.json
// The standard bot is the guardrail bot; `--naive-reserve` turns its reserve measures off (FP-6).
import type { GameState } from "../src/engine/engine.types";
import { stateCalendar } from "../src/engine/scenarioState";
import { runPhase19NaturalGrowth } from "./phase19NaturalGrowth";

const [seedArg, maxArg] = process.argv.slice(2);
const seed = Number(seedArg);
const maxTicks = Number(maxArg ?? 16_000);
const naiveReserve = process.argv.includes("--naive-reserve");
const SEASONS = ["spring", "summer", "autumn", "winter"] as const;

const label = (state: GameState) => {
  const date = stateCalendar(state);
  return { tick: state.tick, year: date.year, season: SEASONS[date.season], winterOfYear: date.season === 3 ? date.year - 1299 : null };
};
let stage1: ReturnType<typeof label> | null = null;
let stage2: ReturnType<typeof label> | null = null;
let maxLeaving = 0;
let maxAbandoned = 0;
let departures = 0;
const winters: { year: number; minReserveTicks: number | null }[] = [];
let lastState: GameState | null = null;
runPhase19NaturalGrowth({ targetLots: 24, maxTicks, seed, naiveReserve, onTick: state => {
  lastState = state;
  if (state.tick % 50 !== 0) return;
  const leaving = state.houses.filter(house => house.leavingSinceTick !== undefined).length;
  const abandoned = state.houses.filter(house => house.abandonedTick !== undefined).length;
  if (leaving > 0 && stage1 === null) stage1 = label(state);
  if (abandoned > 0 && stage2 === null) stage2 = label(state);
  maxLeaving = Math.max(maxLeaving, leaving);
  maxAbandoned = Math.max(maxAbandoned, abandoned);
} });
const final = lastState as GameState | null;
for (const ledger of final?.seasons?.history ?? []) {
  for (const event of ledger.notableEvents) if (event.kind === "households_abandoned") departures += event.count;
}
process.stdout.write(`${JSON.stringify({ seed, naiveReserve, maxTicks, stage1, stage2, maxLeaving, maxAbandoned,
  finalTick: final?.tick ?? null, finalPopulation: final?.population ?? null, finalHouses: final?.houses.length ?? null,
  seasonLedgers: final?.seasons?.history ?? [] }, null, 1)}\n`);
