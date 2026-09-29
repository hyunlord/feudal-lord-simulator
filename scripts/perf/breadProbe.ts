// FIX-10 diagnosis: where the town's bread is when a corner of houses runs dry. Every season in [firstYear, lastYear]:
// granaries and their bread, bakeries, mills, distributors on the road, and the houses with no bread.
// tsx scripts/perf/breadProbe.ts <archetypeId> <seed> [firstYear] [lastYear]
import type { GameState } from "../../src/engine/engine.types";
import { stateCalendar } from "../../src/engine/scenarioState";
import { runPhase19NaturalGrowth } from "../phase19NaturalGrowth";

const [archetypeId = "core:coastal_port", seedText = "3", firstText = "1364", lastText = "1372"] = process.argv.slice(2);
const first = Number(firstText);
const last = Number(lastText);
class Stop extends Error {}
let seen = -1;
const inv = (building: { inventory?: unknown }, resource: string) => ((building.inventory ?? {}) as Record<string, number | undefined>)[resource] ?? 0;

try {
  runPhase19NaturalGrowth({ targetLots: 24, maxTicks: (last - 1300 + 1) * 4000, seed: Number(seedText), archetypeId, onTick: (state: GameState) => {
    const { year, season } = stateCalendar(state);
    if (year > last) throw new Stop();
    const key = year * 4 + season;
    if (year < first || key === seen) return;
    seen = key;
    const of = (kind: string) => state.buildings.filter(building => building.kind === kind);
    const houseCells = new Map(state.buildings.map(building => [building.id, `${building.tx},${building.ty}`]));
    process.stdout.write(`${JSON.stringify({
      year, season, tick: state.tick, pop: state.population, coin: state.treasuryCoin, idle: state.idleWorkers,
      granaries: of("granary").map(building => ({ id: building.id, at: `${building.tx},${building.ty}`, bread: inv(building, "bread"), wheat: inv(building, "wheat"), flour: inv(building, "flour"), workers: (building as { workers?: number }).workers })),
      bakeries: of("bakery").map(building => ({ at: `${building.tx},${building.ty}`, bread: inv(building, "bread"), flour: inv(building, "flour"), workers: (building as { workers?: number }).workers })),
      mills: of("mill").length, fields: of("wheat_farm").length + of("farmstead").length,
      breadInHouses: state.houses.reduce((sum, house) => sum + house.breadStock, 0),
      distributors: state.walkers.filter(walker => walker.kind === "distributor").map(walker => ({ home: walker.homeBuildingId, at: `${walker.position.tx},${walker.position.ty}`, cargo: walker.cargo?.amount ?? 0 })),
      dry: state.houses.filter(house => house.breadStock <= 0).map(house => ({ id: house.buildingId, at: houseCells.get(house.buildingId), level: house.level, residents: house.residents, served: house.lastServicedTick, empty: house.emptyFoodTicks ?? 0 })),
    })}\n`);
  }, additionalAcceptance: state => stateCalendar(state).year > last });
} catch (error) { if (!(error instanceof Stop)) throw error; }
