// FIX-10 diagnosis: why a late town's L4 count wobbles. Every house level drop in [firstYear, lastYear], with the
// requirements its house met the tick before, and once a year the houses below L4 with the same flags.
// tsx scripts/perf/levelDropProbe.ts <archetypeId> <seed> [firstYear] [lastYear]
import type { GameState } from "../../src/engine/engine.types";
import { stateCalendar } from "../../src/engine/scenarioState";
import { householdServices } from "../../src/engine/householdServices";
import { aleServedHouses } from "../../src/engine/ale";
import { houseHasFood } from "../../src/population/houseFood";
import { palisadeProtectionForBuilding } from "../../src/geometry/palisadeProtection";
import { runPhase19NaturalGrowth } from "../phase19NaturalGrowth";

const [archetypeId = "core:coastal_port", seedText = "3", firstText = "1365", lastText = "1405"] = process.argv.slice(2);
const first = Number(firstText);
const last = Number(lastText);
class Stop extends Error {}
let previous: GameState | null = null;
let seenYear = 0;

function flags(state: GameState, buildingId: string) {
  const house = state.houses.find(entry => entry.buildingId === buildingId);
  const home = state.buildings.find(building => building.id === buildingId);
  if (house === undefined || home === undefined) return null;
  const services = householdServices(state).houses.get(buildingId);
  return {
    id: buildingId, at: `${home.tx},${home.ty}`, level: house.level, residents: house.residents, water: house.hasWater,
    bread: houseHasFood(house), market: services?.market.kind === "served", church: services?.church.kind === "served",
    wall: palisadeProtectionForBuilding(home, state.palisade), ale: aleServedHouses(state).has(buildingId),
    burnt: house.burntTick !== undefined, abandoned: house.abandonedTick !== undefined, leaving: house.leavingSinceTick !== undefined,
    unmet: house.unmetRequirementTicks, promo: house.promotionTicks ?? 0,
    marketWhy: services?.market.kind === "served" ? undefined : services?.market,
    churchWhy: services?.church.kind === "served" ? undefined : services?.church,
  };
}

try {
  runPhase19NaturalGrowth({ targetLots: 24, maxTicks: (last - 1300 + 1) * 4000, seed: Number(seedText), archetypeId, onTick: state => {
    const { year, season } = stateCalendar(state);
    if (year > last) throw new Stop();
    if (year >= first && previous !== null) {
      for (const house of state.houses) {
        const before = previous.houses.find(entry => entry.buildingId === house.buildingId);
        if (before !== undefined && house.level < before.level) {
          process.stdout.write(`${JSON.stringify({ drop: `${before.level}->${house.level}`, year, season, tick: state.tick, before: flags(previous, house.buildingId) })}\n`);
        }
      }
      if (year !== seenYear) {
        seenYear = year;
        const below = state.houses.filter(house => house.level < 4).map(house => flags(state, house.buildingId));
        const events = (state.events?.records ?? []).filter(event => stateCalendar({ ...state, tick: event.arrivalTick }).year === year - 1).map(event => event.kind);
        process.stdout.write(`${JSON.stringify({ year, pop: state.population, houses: state.houses.length, l4: state.houses.filter(house => house.level === 4).length,
          palisade: state.palisade === null ? null : { points: state.palisade.polygon.length, done: state.palisade.segments.filter(segment => segment.completed).length,
            of: state.palisade.segments.length, stone: state.palisade.segments.filter(segment => segment.material === "stone").length, expanded: state.palisade.expansion?.tick },
          lastYearEvents: events, below })}\n`);
      }
    }
    previous = state;
  }, additionalAcceptance: state => stateCalendar(state).year > last });
} catch (error) { if (!(error instanceof Stop)) throw error; }
