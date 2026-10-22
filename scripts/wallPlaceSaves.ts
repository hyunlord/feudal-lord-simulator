/**
 * LOT-GAP (the user's ruling 2026-10-23): saves around the charter wall's laying, to tell whether the town's citywide
 * service plan was possible just before the wall — the lord slice played by the lord bot (as growBlockProbe), saving
 * the first tick of every season in the years asked, and the state just before the wall first appears (the palisade or a
 * wall construction site). Prints, for each save, whether the citywide plan (`searchBudgetedServicePlan`) exists.
 * Usage: npx tsx scripts/wallPlaceSaves.ts <seed> <outDir> <years, e.g. 1308,1309>
 */
import { mkdirSync, writeFileSync } from "node:fs";

import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { searchBudgetedServicePlan } from "../src/engine/autoplayServiceBudget";
import type { GameState } from "../src/engine/engine.types";
import { lordBotCommands } from "../src/engine/lordBot";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { encodeSave } from "../src/save/saveCodec";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";

const seed = Number(process.argv[2] ?? 39);
const outDir = process.argv[3] ?? "output/wallplace";
const years = new Set((process.argv[4] ?? "1308,1309").split(",").map(Number));
const last = Math.max(...years);
const hasWall = (state: GameState) => state.palisade !== null
  || state.constructionSites.some(site => site.kind === "palisade_segment" || site.kind === "stone_wall_segment");
mkdirSync(outDir, { recursive: true });
const save = (state: GameState, name: string) => {
  const now = "2026-10-23T00:00:00.000Z";
  writeFileSync(`${outDir}/seed${seed}-${name}.save.json`, encodeSave({ state, createdAt: now, savedAt: now }).bytes);
  const calendar = stateCalendar(state);
  console.log(JSON.stringify({ name, tick: state.tick, year: calendar.year, season: calendar.season, wall: hasWall(state), houses: state.houses.length,
    markets: state.buildings.filter(building => building.kind === "market").length, plan: searchBudgetedServicePlan(state).witness !== null }));
};

let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed }) as GameState;
let walled = hasWall(state);
while (stateCalendar(state).year <= last) {
  let before = state;
  for (const { command } of lordBotCommands(state)) { const next = gameReducer(state, command); if (next !== state) state = next; }
  if (!walled && hasWall(state)) { walled = true; save(before, `before-wall-${before.tick}`); save(state, `wall-${state.tick}`); }
  before = state;
  state = advanceTick(state);
  if (!walled && hasWall(state)) { walled = true; save(before, `before-wall-${before.tick}`); save(state, `wall-${state.tick}`); }
  if (state.tick % 1_000 === 0 && years.has(stateCalendar(state).year)) save(state, `${stateCalendar(state).year}-s${stateCalendar(state).season}`);
}
