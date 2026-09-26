// MARKET-1 gate (spec docs/design/market-reach.md MK-1…MK-4): runs the bot on a seed to stability and, every season,
// counts the lived-in lots no market reaches (outside or unreachable) under the road reach (the game's rule now) and
// under the old radius (footprint distance 8 and a road) on the same town, and the markets standing.
//   tsx scripts/marketReachRun.ts <seed> <maxTicks> [out.json]
import { writeFileSync } from "node:fs";
import type { GameState } from "../src/engine/engine.types";
import { householdServices } from "../src/engine/householdServices";
import { marketRoadService } from "../src/engine/marketService";
import { houseLotArea } from "../src/geometry/buildingFootprint";
import { allocateHouseServices, type ServiceAllocation } from "../src/population/serviceAllocation";
import { runPhase19NaturalGrowth } from "./phase19NaturalGrowth";

const [seedArg, maxArg, outArg] = process.argv.slice(2);
const seed = Number(seedArg);
const maxTicks = Number(maxArg ?? 600_000);

function unreachedLots(state: GameState, services: ServiceAllocation): number {
  const homes = new Map(state.buildings.map(building => [building.id, building]));
  return state.houses.reduce((sum, house) => {
    const kind = services.houses.get(house.buildingId)?.market.kind;
    return house.residents > 0 && (kind === "outside" || kind === "unreachable") ? sum + houseLotArea(homes.get(house.buildingId)) : sum;
  }, 0);
}

const samples: { tick: number; markets: number; unreachedNow: number; unreachedOldRadius: number }[] = [];
let last: GameState | null = null;
const report = runPhase19NaturalGrowth({ targetLots: 24, maxTicks, seed, onTick: state => {
  last = state;
  if (state.tick % 1_000 !== 0 || !state.buildings.some(building => building.kind === "market")) return;
  const connection = marketRoadService(state);
  const old = allocateHouseServices({ houses: state.houses, buildings: state.buildings, roadService: (home, market) => connection(home, market) });
  samples.push({ tick: state.tick, markets: state.buildings.filter(building => building.kind === "market").length,
    unreachedNow: unreachedLots(state, householdServices(state)), unreachedOldRadius: unreachedLots(state, old) });
} });
const final = last as GameState | null;
const sum = (key: "unreachedNow" | "unreachedOldRadius") => samples.reduce((total, sample) => total + sample[key], 0);
const result = { seed, finalTick: final?.tick ?? null, stopReason: report.stopReason, victoryTick: report.victoryTick, samples: samples.length,
  unreachedLotSeasons: { now: sum("unreachedNow"), oldRadius: sum("unreachedOldRadius") },
  seasonsWithUnreached: { now: samples.filter(sample => sample.unreachedNow > 0).length, oldRadius: samples.filter(sample => sample.unreachedOldRadius > 0).length },
  finalMarkets: samples.at(-1)?.markets ?? 0, finalUnreached: { now: samples.at(-1)?.unreachedNow ?? null, oldRadius: samples.at(-1)?.unreachedOldRadius ?? null } };
if (outArg !== undefined) writeFileSync(outArg, `${JSON.stringify({ ...result, series: samples.filter((_, index) => index % 4 === 0) }, null, 1)}\n`);
process.stdout.write(`${JSON.stringify(result)}\n`);
