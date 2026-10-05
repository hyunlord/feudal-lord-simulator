// City-growth diagnosis (the user's request 2026-10-05, before LM-E9c): the lord's slice played by the lord-mode bot,
// and at each year's end the town's size — population, households (houses lived in), houses by level, the buildings,
// the wall's ring (tiles inside it, houses inside and outside it, free grass inside and outside), and the town agency's
// last walk (its housing needs and the proposals it made). Diagnosis only: nothing in the game changes.
//   tsx scripts/cityGrowthProbe.ts <seed> <years> <out.json>   (the file is rewritten every ten years)
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import type { GameState } from "../src/engine/engine.types";
import { lordBotCommands } from "../src/engine/lordBot";
import { stateCalendar } from "../src/engine/scenarioState";
import { treasuryBalance } from "../src/ledger/ledger";
import { advanceTick } from "../src/engine/tick";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";
import { pointInPolygon } from "../src/world/boundary/buildingGrounds";
import { houseRequirementRows } from "./autoplayStallProbe";

function yearRow(state: GameState) {
  const ring = state.palisade?.polygon.map(point => ({ x: point.x, y: point.y })) ?? null;
  const inside = (tx: number, ty: number) => ring !== null && pointInPolygon({ x: tx + 0.5, y: ty + 0.5 }, ring);
  const houseBuildings = state.buildings.filter(building => building.kind === "house");
  const lived = state.houses.filter(house => house.residents > 0 && house.abandonedTick === undefined);
  const levels: Record<number, number> = {};
  for (const house of state.houses) levels[house.level] = (levels[house.level] ?? 0) + 1;
  let insideTiles = 0; let freeInside = 0; let freeOutside = 0;
  for (const tile of state.tiles) {
    const within = inside(tile.tx, tile.ty);
    if (within) insideTiles += 1;
    const free = tile.terrain === "grass" && tile.buildingId === null && !tile.hasRoad;
    if (free && within) freeInside += 1; else if (free) freeOutside += 1;
  }
  const kinds: Record<string, number> = {};
  for (const building of state.buildings) kinds[building.kind] = (kinds[building.kind] ?? 0) + 1;
  const walk = state.agency?.lastWalk;
  return {
    year: stateCalendar(state).year, tick: state.tick, population: state.population,
    persons: state.persons?.people.length ?? 0, households: lived.length, houses: houseBuildings.length, residents: lived.reduce((sum, house) => sum + house.residents, 0),
    levels, housesInside: houseBuildings.filter(building => inside(building.tx, building.ty)).length, wallTiles: insideTiles, freeInside, freeOutside,
    wall: state.palisade === null ? "none" : `${state.palisade.segments.filter(segment => segment.completed).length}/${state.palisade.segments.length}`,
    buildings: state.buildings.length, kinds, idleWorkers: state.idleWorkers,
    needs: walk?.needs.map(need => `${need.planner}:${need.action.kind}`) ?? [], proposals: walk?.proposals.length ?? 0,
    // Why a town shrinks: households short of food, preparing to leave, gone (the house empty), and the town's stock.
    foodShort: state.houses.filter(house => house.foodShortSinceTick !== undefined).length,
    leaving: state.houses.filter(house => house.leavingSinceTick !== undefined && house.abandonedTick === undefined).length,
    abandoned: state.houses.filter(house => house.abandonedTick !== undefined).length,
    stock: Object.fromEntries(["wheat", "flour", "bread", "timber", "stone"].map(item => [item,
      state.buildings.reduce((sum, building) => sum + ((building.inventory as Record<string, number | undefined>)[item] ?? 0), 0)])),
    treasury: treasuryBalance(state),
    // What the houses lack (a house below its level's requirement falls a level after the grace): by requirement.
    lacking: (() => {
      const rows = houseRequirementRows(state).filter(row => row.residents > 0);
      return { water: rows.filter(row => !row.water).length, bread: rows.filter(row => !row.bread).length,
        granary: rows.filter(row => row.granary === false || row.granary === undefined).length,
        market: rows.filter(row => row.market !== "served").length, church: rows.filter(row => row.church !== "served").length,
        outside: rows.filter(row => row.protection === "outside").length, unmetTicks: state.houses.filter(house => house.unmetRequirementTicks > 0).length };
    })(),
  };
}

export function cityGrowthProbe(seed: number, years: number, out?: string) {
  let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed }) as GameState;
  const startYear = stateCalendar(state).year;
  const rows: ReturnType<typeof yearRow>[] = [yearRow(state)];
  let year = startYear;
  while (stateCalendar(state).year < startYear + years) {
    for (const { command } of lordBotCommands(state)) {
      const next = gameReducer(state, command);
      if (next !== state) state = next;
    }
    state = advanceTick(state);
    if (stateCalendar(state).year !== year) {
      year = stateCalendar(state).year;
      rows.push(yearRow(state));
      if (out !== undefined && year % 10 === 0) writeFileSync(out, JSON.stringify({ seed, years, rows }));
    }
  }
  const result = { seed, years, rows };
  if (out !== undefined) writeFileSync(out, JSON.stringify(result));
  return result;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [seed, years, out] = process.argv.slice(2);
  const result = cityGrowthProbe(Number(seed ?? 1), Number(years ?? 125), out);
  if (out === undefined) process.stdout.write(`${JSON.stringify(result.rows.at(-1))}\n`);
}
