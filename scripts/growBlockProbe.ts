// GROW-BLOCK gate (the user's ruling 2026-10-09): the lord's slice played by the lord-mode bot for 125 years; each year
// the town's size and wall, and the woods (stumps standing, trees felled that year, the wood in store, the camps and
// sawmills). The summary: the highest population (the gate: past 528), the first palisade, and every stall — ten years
// or more with the population and the wall both unchanged below the lord mode's full town (24 lots at level 4, 768).
//   tsx scripts/growBlockProbe.ts <seed> [years] > out.json
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { isBuildingConstructionSite } from "../src/economy/construction";
import type { GameState } from "../src/engine/engine.types";
import { treeStage } from "../src/engine/land";
import { lordBotCommands } from "../src/engine/lordBot";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";

const YEAR = 4_000;
const FULL_TOWN = 768;

function row(state: GameState, year: number) {
  const kinds: Record<string, number> = {};
  for (const building of state.buildings) kinds[building.kind] = (kinds[building.kind] ?? 0) + 1;
  let timber = 0; let logs = 0;
  for (const building of state.buildings) {
    const held = building as { readonly stock?: Readonly<Record<string, number>>; readonly inventory?: Readonly<Record<string, number>> };
    const stock = held.inventory ?? held.stock ?? {};
    timber += stock.timber ?? 0; logs += stock.logs ?? 0;
  }
  const harvests = state.forestHarvests ?? [];
  return { year, population: state.population, era: state.era, palisade: state.palisade?.polygon.length ?? 0, houses: state.houses.length,
    buildings: state.buildings.length, camps: kinds.logging_camp ?? 0, sawmills: kinds.sawmill ?? 0, quarry: kinds.quarry ?? 0, church: kinds.church ?? 0,
    stumps: harvests.filter(harvest => treeStage(harvest, state.tick) === "stump").length,
    felled: harvests.filter(harvest => harvest.harvestedAtTick > state.tick - YEAR).length, timber, logs,
    abandoned: state.agency?.abandonedSites?.length ?? 0, charterFailures: state.agency?.charterWallFailure?.attempts ?? 0 };
}

export function growBlockProbe(seed: number, years = 125) {
  let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed }) as GameState;
  const start = stateCalendar(state).year;
  const rows: (ReturnType<typeof row> & { abandonedBy: Record<string, number>; replaced: number })[] = [];
  let lastYear = start;
  // GB-4/GB-5: the sites given up this year by their reason, and a site laid out again where one was given up.
  const seenSites = new Set<string>();
  const seenAbandoned = new Set<string>();
  const abandonedSpots: { kind: string; tx: number; ty: number }[] = [];
  let abandonedBy: Record<string, number> = {};
  let replaced = 0;
  while (stateCalendar(state).year < start + years) {
    for (const { command } of lordBotCommands(state)) { const next = gameReducer(state, command); if (next !== state) state = next; }
    state = advanceTick(state);
    for (const entry of state.agency?.abandonedSites ?? []) if (!seenAbandoned.has(entry.id)) {
      seenAbandoned.add(entry.id); abandonedSpots.push(entry); abandonedBy[entry.reason] = (abandonedBy[entry.reason] ?? 0) + 1;
    }
    for (const site of state.constructionSites) if (!seenSites.has(site.id)) {
      seenSites.add(site.id);
      if (isBuildingConstructionSite(site) && abandonedSpots.some(spot => spot.kind === site.kind && spot.tx === site.tx && spot.ty === site.ty)) replaced += 1;
    }
    const year = stateCalendar(state).year;
    if (year !== lastYear) { lastYear = year; rows.push({ ...row(state, year), abandonedBy, replaced }); abandonedBy = {}; replaced = 0; }
  }
  const stalls: { from: number; to: number; population: number; palisade: number }[] = [];
  let runStart = 0;
  for (let index = 1; index <= rows.length; index += 1) {
    const same = index < rows.length && rows[index]!.population === rows[runStart]!.population && rows[index]!.palisade === rows[runStart]!.palisade;
    if (same) continue;
    const first = rows[runStart]!, last = rows[index - 1]!;
    if (last.year - first.year >= 10 && first.population < FULL_TOWN) stalls.push({ from: first.year, to: last.year, population: first.population, palisade: first.palisade });
    runStart = index;
  }
  return { seed, years, maxPopulation: Math.max(...rows.map(entry => entry.population)), firstPalisade: rows.find(entry => entry.palisade > 0)?.year ?? null,
    stalls, peakStumps: Math.max(...rows.map(entry => entry.stumps)), abandoned: rows.reduce((sum, entry) => sum + Object.values(entry.abandonedBy).reduce((a, b) => a + b, 0), 0),
    replaced: rows.reduce((sum, entry) => sum + entry.replaced, 0), rows };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [seed = "1", years = "125"] = process.argv.slice(2);
  process.stdout.write(`${JSON.stringify(growBlockProbe(Number(seed), Number(years)))}\n`);
}
