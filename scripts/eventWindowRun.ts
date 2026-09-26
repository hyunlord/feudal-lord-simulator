// F0-B gate ② (spec docs/design/flow-events.md EV-4, EV-5, EV-7): runs the bot from a seed's growth opening through
// chapter 1's first fire and first dearth, and records when they came and what they cost.
//   tsx scripts/eventWindowRun.ts <seed> <maxTicks> [--naive-reserve] [--no-wells] > seed.json
// The standard bot is the guardrail bot; `--naive-reserve --no-wells` is the unprepared town (no reserve, no wells).
import type { GameState } from "../src/engine/engine.types";
import { calendar, scenarioOf } from "../src/engine/scenarioState";
import { runPhase19NaturalGrowth } from "./phase19NaturalGrowth";

const [seedArg, maxArg] = process.argv.slice(2);
const seed = Number(seedArg);
const maxTicks = Number(maxArg ?? 28_000);
const naiveReserve = process.argv.includes("--naive-reserve");
const noWells = process.argv.includes("--no-wells");
const SEASONS = ["spring", "summer", "autumn", "winter"] as const;

let lastState: GameState | null = null;
let maxBurning = 0;
const departures = new Set<string>();
runPhase19NaturalGrowth({ targetLots: 24, maxTicks, seed, naiveReserve, noWells, onTick: state => {
  lastState = state;
  maxBurning = Math.max(maxBurning, state.events?.burning.length ?? 0);
  for (const house of state.houses) if (house.abandonedTick === state.tick) departures.add(`${house.buildingId}@${state.tick}`);
} });
const final = lastState as GameState | null;
const startYear = final === null ? 1300 : scenarioOf(final).startYear;
const at = (tick: number | undefined) => {
  if (tick === undefined) return null;
  const date = calendar(tick, startYear);
  return { tick, year: date.year, season: SEASONS[date.season] };
};
const records = (final?.events?.records ?? []).map(record => ({ id: record.id, defId: record.defId, kind: record.kind,
  arrival: at(record.arrivalTick), end: at(record.endTick), recoveryUntil: at(record.recoveryUntilTick),
  originBuildingId: record.originBuildingId ?? null, losses: record.losses }));
const firstFire = records.find(record => record.defId === "first_fire") ?? null;
const rehearsal = records.find(record => record.defId === "dearth_rehearsal") ?? null;
const burntHouses = records.reduce((total, record) => total + record.losses.burntHouses, 0);
process.stdout.write(`${JSON.stringify({ seed, naiveReserve, noWells, maxTicks,
  firstFire: firstFire === null ? null : { year: firstFire.arrival?.year ?? null, season: firstFire.arrival?.season ?? null, burntHouses: firstFire.losses.burntHouses },
  rehearsal: rehearsal === null ? null : { year: rehearsal.arrival?.year ?? null, harvestLost: rehearsal.losses.harvestLost, departures: rehearsal.losses.departures },
  missed: final?.events?.missed ?? [],
  losses: { burntHouses, departures: departures.size, total: burntHouses + departures.size },
  maxBurning,
  final: { tick: final?.tick ?? null, population: final?.population ?? null, houses: final?.houses.length ?? null,
    wells: final?.buildings.filter(building => building.kind === "well").length ?? null,
    burntNow: final?.houses.filter(house => house.burntTick !== undefined).length ?? null },
  records }, null, 1)}\n`);
