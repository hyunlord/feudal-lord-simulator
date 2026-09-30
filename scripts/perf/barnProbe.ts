// BOT-4 diagnosis: where the town's wheat is each season — each barn's wheat and space, the granaries', the mills' —
// and the fields' wheat lost to winter (ripe strips never taken in). tsx scripts/perf/barnProbe.ts <archetypeId> <seed> [firstYear] [lastYear]
import { BUILDING_CONFIG_BY_KIND } from "../../src/content/buildingConfig";
import { availableSpace } from "../../src/economy/storage";
import type { GameState } from "../../src/engine/engine.types";
import { stateCalendar } from "../../src/engine/scenarioState";
import { runPhase19NaturalGrowth } from "../phase19NaturalGrowth";

const [archetypeId = "core:coastal_port", seedText = "3", firstText = "1362", lastText = "1372"] = process.argv.slice(2);
const first = Number(firstText);
const last = Number(lastText);
class Stop extends Error {}
let seen = -1;
try {
  runPhase19NaturalGrowth({ targetLots: 24, maxTicks: (last - 1300 + 1) * 4000, seed: Number(seedText), archetypeId, onTick: (state: GameState) => {
    const { year, season } = stateCalendar(state);
    if (year > last) throw new Stop();
    const key = year * 4 + season;
    if (year < first || key === seen) return;
    seen = key;
    const of = (kind: "farmstead" | "granary" | "mill") => state.buildings.filter(building => building.kind === kind);
    process.stdout.write(`${JSON.stringify({ year, season, pop: state.population,
      barns: of("farmstead").map(barn => ({ at: `${barn.tx},${barn.ty}`, wheat: barn.inventory.wheat ?? 0, space: availableSpace(barn, BUILDING_CONFIG_BY_KIND.farmstead), crop: barn.crop ?? "wheat", workers: barn.workers })),
      granaryWheat: of("granary").reduce((sum, b) => sum + (b.inventory.wheat ?? 0), 0), granaryBread: of("granary").reduce((sum, b) => sum + (b.inventory.bread ?? 0), 0),
      millWheat: of("mill").map(b => b.inventory.wheat ?? 0),
      fieldLost: (state.arableFields ?? []).reduce((sum, field) => sum + field.lostWheat, 0), fieldHarvested: (state.arableFields ?? []).reduce((sum, field) => sum + field.harvestedWheat, 0),
      carters: state.walkers.filter(walker => walker.kind === "carter").length })}\n`);
  }, additionalAcceptance: state => stateCalendar(state).year > last });
} catch (error) { if (!(error instanceof Stop)) throw error; }
