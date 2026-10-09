// GROW-BLOCK diagnosis of what holds a town in a plateau: each year the market and stone town's unmet conditions, the
// town agency's last walk (its needs by planner), the needs its builders refused, the proposals not started and why,
// the houses and the lots the wall has room for. Diagnosis only.
//   tsx scripts/growWhyProbe.ts <seed> [years] > out.json
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import type { GameState } from "../src/engine/engine.types";
import { evaluateEraRequirements } from "../src/engine/era";
import { lordBotCommands } from "../src/engine/lordBot";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";

export function growWhyProbe(seed: number, years = 70) {
  let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed }) as GameState;
  const start = stateCalendar(state).year;
  const rows: Record<string, unknown>[] = [];
  let lastYear = start;
  while (stateCalendar(state).year < start + years) {
    for (const { command } of lordBotCommands(state)) { const next = gameReducer(state, command); if (next !== state) state = next; }
    state = advanceTick(state);
    const year = stateCalendar(state).year;
    if (year === lastYear) continue;
    lastYear = year;
    const walk = state.agency?.lastWalk;
    rows.push({ year, population: state.population, era: state.era, houses: state.houses.length, levels: state.houses.reduce((acc: Record<number, number>, house) => ({ ...acc, [house.level]: (acc[house.level] ?? 0) + 1 }), {}),
      unmet: evaluateEraRequirements(state).filter(requirement => !requirement.met).map(requirement => `${requirement.key}:${requirement.current}/${requirement.target}`),
      needs: (walk?.needs ?? []).map(need => `${need.planner}:${need.action.kind}${need.action.kind === "place_building" ? `:${need.action.building}` : ""}`),
      proposals: (walk?.proposals ?? []).map(proposal => `${proposal.what}:${proposal.score}${proposal.refusedBy === undefined ? "" : `:refused:${proposal.refusedBy}`}`).slice(0, 12),
      refused: (state.agency?.refusedNeeds ?? []).map(entry => `${entry.what}:${entry.builder}:${entry.since}`),
      sites: state.constructionSites.map(site => "kind" in site ? `${site.kind}:${site.stall}` : `wall:${site.stall}`).slice(0, 10),
      kinds: Object.fromEntries(["quarry", "masonry", "church", "chapel", "market", "storehouse"].map(kind => [kind, state.buildings.filter(building => building.kind === kind).length])) });
  }
  return { seed, years, rows };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [seed = "1", years = "70"] = process.argv.slice(2);
  process.stdout.write(`${JSON.stringify(growWhyProbe(Number(seed), Number(years)))}\n`);
}
