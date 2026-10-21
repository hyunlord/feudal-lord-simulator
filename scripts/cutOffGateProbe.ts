/**
 * STONE-1a (the user's ruling 2026-10-21): when and why the cut-off gate rule opens a gate — diagnosis only. The lord
 * slice played by the lord bot; at each season's close: the wall's segments done of all, its extra gates, the cut-off
 * road components (`cutOffComponents`) with their tiles and the outside buildings on them, and the gate it would open.
 * Usage: npx tsx scripts/cutOffGateProbe.ts <seed> <years> > out.json
 */
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { cutOffComponents, cutOffGateChoices } from "../src/engine/cutOffGates";
import type { GameState } from "../src/engine/engine.types";
import { lordBotCommands } from "../src/engine/lordBot";
import { buildingRoadAccessTiles } from "../src/engine/routing";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { palisadeProtectionForBuilding } from "../src/geometry/palisadeProtection";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";

const seed = Number(process.argv[2] ?? 1);
const years = Number(process.argv[3] ?? 14);
let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed }) as GameState;
const start = stateCalendar(state).year;
const rows: unknown[] = [];
let lastGates = 0;
while (stateCalendar(state).year < start + years) {
  for (const { command } of lordBotCommands(state)) { const next = gameReducer(state, command); if (next !== state) state = next; }
  const before = state;
  state = advanceTick(state);
  if (state.tick % 1_000 !== 0 || state.palisade === null) continue;
  const gates = state.palisade.additionalGates?.length ?? 0;
  // The season's close as the rule saw it: the state before this tick's step opened a gate.
  const seen = gates > lastGates ? before : state;
  const components = cutOffComponents(seen);
  const wall = seen.palisade;
  rows.push({
    year: stateCalendar(state).year, season: Math.floor((state.tick % 4_000) / 1_000), era: state.era, opened: gates > lastGates,
    segments: wall === null ? null : `${wall.segments.filter(s => s.completed).length}/${wall.segments.length}`, gates, gateList: state.palisade.additionalGates ?? [],
    components: components.map(tiles => {
      const keys = new Set(tiles.map(t => `${t.tx},${t.ty}`));
      return { tiles: tiles.length, buildings: seen.buildings.filter(b => wall !== null && palisadeProtectionForBuilding(b, wall) === "outside"
        && buildingRoadAccessTiles(seen, b).some(t => keys.has(`${t.tx},${t.ty}`))).map(b => `${b.kind}@${b.tx},${b.ty}`) };
    }),
    wouldOpen: cutOffGateChoices(seen, 3),
  });
  lastGates = gates;
}
console.log(JSON.stringify({ seed, years, rows: rows.filter((row, index) => (row as { opened: boolean }).opened || (row as { components: unknown[] }).components.length > 0 || index === rows.length - 1) }, null, 1));
