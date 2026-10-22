/**
 * HOUSE-STUCK (the user's ruling 2026-10-22/23): a house left below level 4 while it has everything a level-4 house
 * needs — diagnosis only. The lord slice played by the lord bot; at each season's close, every house's requirement row
 * (`houseRequirementRows`: water, bread, market, church, the wall's protection) with its level, built level and
 * condition. A house counts as stuck from its fourth close in a row below level 4 with water, bread, a market and a
 * church served, while half the town's houses or more stand at level 4. Prints each stuck run; with an output folder,
 * saves the state at the first stuck run's fourth close (a natural save for the next step).
 * Usage: npx tsx scripts/houseStuckProbe.ts <seed> <years> [outDir] > out.json
 */
import { mkdirSync, writeFileSync } from "node:fs";

import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import type { GameState } from "../src/engine/engine.types";
import { lordBotCommands } from "../src/engine/lordBot";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { houseBuiltLevel, houseCondition } from "../src/population/houseCondition";
import { encodeSave } from "../src/save/saveCodec";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";
import { houseRequirementRows } from "./autoplayStallProbe";

const seed = Number(process.argv[2] ?? 35);
const years = Number(process.argv[3] ?? 30);
const outDir = process.argv[4];
const STUCK_CLOSES = 4;

let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed }) as GameState;
const start = stateCalendar(state).year;
const streak = new Map<string, number>();
const runs = new Map<string, { id: string; tx: number | undefined; ty: number | undefined; from: string; to: string; closes: number; first: unknown; last: unknown }>();
const finished: unknown[] = [];
let saved = false;
const when = (s: GameState) => { const c = stateCalendar(s); return `${c.year}-s${c.season}`; };
while (stateCalendar(state).year < start + years) {
  for (const { command } of lordBotCommands(state)) { const next = gameReducer(state, command); if (next !== state) state = next; }
  state = advanceTick(state);
  if (state.tick % 1_000 !== 0) continue;
  const rows = houseRequirementRows(state);
  const levelFour = rows.filter(row => row.level >= 4).length;
  const townAtFour = rows.length > 0 && levelFour * 2 >= rows.length;
  for (const row of rows) {
    const house = state.houses.find(entry => entry.buildingId === row.id)!;
    const ready = row.level < 4 && row.water && row.bread && row.market === "served" && row.church === "served" && townAtFour;
    const detail = { level: row.level, built: houseBuiltLevel(house), condition: houseCondition(house), residents: row.residents,
      protection: row.protection, granary: row.granary, emptyFoodTicks: row.emptyFoodTicks };
    const count = ready ? (streak.get(row.id) ?? 0) + 1 : 0;
    streak.set(row.id, count);
    const open = runs.get(row.id);
    if (count >= STUCK_CLOSES) {
      if (open === undefined) runs.set(row.id, { id: row.id, tx: row.tx, ty: row.ty, from: when(state), to: when(state), closes: count, first: detail, last: detail });
      else { open.to = when(state); open.closes = count; open.last = detail; }
      if (count === STUCK_CLOSES && outDir !== undefined && !saved) {
        mkdirSync(outDir, { recursive: true });
        const now = "2026-10-23T00:00:00.000Z";
        writeFileSync(`${outDir}/seed${seed}-house-stuck-${row.tx},${row.ty}-${state.tick}.save.json`, encodeSave({ state, createdAt: now, savedAt: now }).bytes);
        saved = true;
      }
    } else if (open !== undefined) { finished.push({ ...open, ended: when(state), endedAt: detail }); runs.delete(row.id); }
  }
}
console.log(JSON.stringify({ seed, years, stuck: [...finished, ...[...runs.values()].map(run => ({ ...run, ended: null }))] }));
