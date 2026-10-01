// LAND-UI water evidence states: the riverside and the fen in summer, each with a fulling mill on its first legal
// site nearest the town (placement's own checks, the ring of flowing water included), stood in as built; and each
// scene's camera tile (a river cell, a mere's shore, the mill). Bare current-format states and a scenes.json.
//   npx tsx scripts/landuiWaterStates.ts <out-dir>
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Building } from "../src/content/buildingConfig";
import { DEFAULT_SCENARIO_ID } from "../src/content/scenario/coreScenarios";
import { FEN_ARCHETYPE_ID, RIVERSIDE_ARCHETYPE_ID } from "../src/content/scenario/archetypes";
import type { GameState } from "../src/engine/engine.types";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { newGameState } from "../src/state/newGame";
import { canPlaceBuildingBeforeRoad, PlacementFailure } from "../src/world/placement";

const [out] = process.argv.slice(2);
mkdirSync(out!, { recursive: true });

function summer(archetypeId: string): GameState {
  let state = newGameState({ scenarioId: DEFAULT_SCENARIO_ID, archetypeId, seed: 1 });
  if (state === null) throw new Error(archetypeId);
  while (stateCalendar(state).season !== 1) state = advanceTick(state);
  for (let step = 0; step < 200; step += 1) state = advanceTick(state);
  return state;
}

const town = (state: GameState) => ({ tx: state.buildings.reduce((sum, b) => sum + b.tx, 0) / state.buildings.length, ty: state.buildings.reduce((sum, b) => sum + b.ty, 0) / state.buildings.length });
const nearest = (state: GameState, ok: (index: number) => boolean): [number, number] => {
  const centre = town(state); let best = -1; let distance = Infinity;
  state.tiles.forEach((tile, index) => { const d = Math.hypot(tile.tx - centre.tx, tile.ty - centre.ty); if (ok(index) && d < distance) { best = index; distance = d; } });
  return [best % state.width, Math.floor(best / state.width)];
};

function withMill(state: GameState): { readonly state: GameState; readonly site: [number, number] } {
  const late = { ...state, era: "stone_town" as const };
  const sites: [number, number][] = [];
  for (let ty = 0; ty < state.height; ty += 1) for (let tx = 0; tx < state.width; tx += 1) {
    const result = canPlaceBuildingBeforeRoad(late, "fulling_mill", tx, ty);
    if (result.ok || result.reason === PlacementFailure.insufficient_materials) sites.push([tx, ty]);
  }
  const centre = town(state);
  sites.sort((a, b) => Math.hypot(a[0] - centre.tx, a[1] - centre.ty) - Math.hypot(b[0] - centre.tx, b[1] - centre.ty));
  const [tx, ty] = sites[0]!;
  const id = "landui-water-fulling-mill";
  const mill: Building = { id, kind: "fulling_mill", tx, ty, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
  return { site: [tx, ty], state: { ...state, buildings: [...state.buildings, mill],
    tiles: state.tiles.map(tile => tile.tx >= tx && tile.tx < tx + 2 && tile.ty >= ty && tile.ty < ty + 2 ? { ...tile, buildingId: id } : tile) } };
}

const scenes: Record<string, { readonly tile: [number, number]; readonly zoom: number }> = {};
for (const [name, id] of [["riverside", RIVERSIDE_ARCHETYPE_ID], ["fen", FEN_ARCHETYPE_ID]] as const) {
  const state = summer(id);
  const river = new Set(state.river?.cells ?? []);
  const water = (index: number) => state.tiles[index]?.terrain === "water";
  writeFileSync(join(out!, `${name}-summer.json`), JSON.stringify(state));
  scenes[`${name}-river`] = { tile: nearest(state, index => water(index) && river.has(index)), zoom: 1.3 };
  if (name === "fen") {
    // A mere's shore: still water with land beside it.
    scenes["fen-mere"] = { tile: nearest(state, index => water(index) && !river.has(index) && [-1, 1, -state.width, state.width].some(step => state.tiles[index + step]?.terrain === "grass")), zoom: 1.3 };
  }
  const milled = withMill(state);
  writeFileSync(join(out!, `${name}-mill-summer.json`), JSON.stringify(milled.state));
  scenes[`${name}-mill`] = { tile: [milled.site[0] + 1, milled.site[1] + 1], zoom: 1.8 };
  console.log(JSON.stringify({ name, tick: state.tick, season: stateCalendar(state).season, mill: milled.site }));
}
writeFileSync(join(out!, "scenes.json"), JSON.stringify(scenes, null, 1));
console.log(JSON.stringify(scenes));
