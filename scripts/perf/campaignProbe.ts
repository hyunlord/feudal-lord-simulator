// FIX-10 diagnosis: every five calendar years of a campaign run, what holds the town — era, wall, levels, key buildings,
// stocks, the timber order and what was bought.  tsx scripts/perf/campaignProbe.ts <archetypeId> <seed> [lastYear]
import type { GameState } from "../../src/engine/engine.types";
import { stateCalendar } from "../../src/engine/scenarioState";
import { runPhase19NaturalGrowth } from "../phase19NaturalGrowth";

const [archetypeId = "core:chalk_downs", seedText = "2", lastText = "1400"] = process.argv.slice(2);
const last = Number(lastText);
class Stop extends Error {}
let seen = 1300;
const stock = (state: GameState, resource: string) => state.buildings.reduce((sum, building) => sum + ((building.inventory as Record<string, number | undefined>)[resource] ?? 0), 0);
try {
  runPhase19NaturalGrowth({ targetLots: 24, maxTicks: (last - 1300 + 1) * 4000, seed: Number(seedText), archetypeId, onTick: state => {
    const year = stateCalendar(state).year;
    if (year !== seen && year % 5 === 0) {
      seen = year;
      const levels: Record<number, number> = {};
      for (const house of state.houses) if (house.residents > 0) levels[house.level] = (levels[house.level] ?? 0) + 1;
      const count = (kind: string) => state.buildings.filter(building => building.kind === kind).length;
      const walls = state.constructionSites.filter(site => site.kind === "palisade_segment" || site.kind === "stone_wall_segment");
      const bought = (state.ledger?.entries ?? []).filter(entry => entry.category === "timber_purchase").reduce((sum, entry) => sum - entry.amount, 0);
      process.stdout.write(`${JSON.stringify({ year, era: state.era, pop: state.population, levels, lots: state.houses.length,
        wallSites: walls.length, wallTimberNeed: walls.reduce((sum, site) => sum + Math.max(0, (site.required.timber ?? 0) - (site.delivered.timber ?? 0)), 0),
        sites: state.constructionSites.map(site => site.kind), church: count("church"), chapel: count("chapel"), quarry: count("quarry"), masonry: count("masonry"),
        logging: count("logging_camp"), sawmill: count("sawmill"), market: count("market"), timber: state.treasuryTimber + stock(state, "timber"),
        logs: stock(state, "logs"), stone: stock(state, "stone"), coin: state.treasuryCoin, timberOrder: state.timberOrder ?? 0, boughtCoin: bought,
        idle: state.idleWorkers, waterRoads: state.tiles.filter(tile => tile.terrain === "water" && tile.hasRoad).map(tile => `${tile.tx},${tile.ty}`),
        roads: state.tiles.filter(tile => tile.hasRoad).length, buildings: state.buildings.length })}\n`);
    }
    if (year > last) throw new Stop();
  }, additionalAcceptance: state => stateCalendar(state).year > last });
} catch (error) { if (!(error instanceof Stop)) throw error; }
