/**
 * LOT-FIX (the user's ruling 2026-10-22): when does a field cover an interior house site the town still needs —
 * diagnosis only. The lord slice played by the lord bot; whenever the arable zone grows (a town project or a bot
 * action), the cells it took that were free interior house sites (`interiorHouseSites`, not under another zone) on the
 * state before, while lots are still wanted (`housingLotsStillNeeded`, the lord policy's 24). With an output folder, the
 * state just before the first such field is saved there (a natural save for the fixture test).
 * Usage: npx tsx scripts/fieldOverHouseProbe.ts <seed> <years> [outDir] > out.json
 */
import { mkdirSync, writeFileSync } from "node:fs";

import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { housingLotsStillNeeded, interiorHouseSites } from "../src/engine/autoplayInteriorPlots";
import type { GameState } from "../src/engine/engine.types";
import { lordBotCommands } from "../src/engine/lordBot";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { LORD_MODE_POLICY } from "../src/engine/townAgency";
import { encodeSave } from "../src/save/saveCodec";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";
import { zonesOf } from "../src/zones/zoneEdits";

const seed = Number(process.argv[2] ?? 26);
const years = Number(process.argv[3] ?? 20);
const outDir = process.argv[4];
const arable = (state: GameState) => new Set(zonesOf(state).filter(zone => zone.kind === "arable").flatMap(zone => zone.membership));
const freeInteriorSites = (state: GameState) => {
  const zoned = new Set(zonesOf(state).flatMap(zone => zone.membership));
  return interiorHouseSites(state).map(site => site.ty * state.width + site.tx).filter(index => !zoned.has(index));
};

let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed }) as GameState;
const start = stateCalendar(state).year;
const events: unknown[] = [];
let saved = false;
const note = (before: GameState, after: GameState, by: string) => {
  if (before.palisade === null) return;
  const was = arable(before);
  const added = [...arable(after)].filter(index => !was.has(index));
  if (added.length === 0) return;
  const needed = housingLotsStillNeeded(before, LORD_MODE_POLICY.maxHousingLots);
  if (needed === 0) return;
  const free = new Set(freeInteriorSites(before));
  const covered = added.filter(index => free.has(index));
  if (covered.length === 0) return;
  const calendar = stateCalendar(after);
  events.push({ tick: after.tick, year: calendar.year, season: Math.floor((after.tick % 4_000) / 1_000), by, lotsNeeded: needed,
    freeInteriorSites: free.size, covered: covered.length, added: added.length, houses: before.houses.length });
  if (outDir !== undefined && !saved) {
    mkdirSync(outDir, { recursive: true });
    const now = "2026-10-22T00:00:00.000Z";
    writeFileSync(`${outDir}/seed${seed}-field-over-house-${before.tick}.save.json`, encodeSave({ state: before, createdAt: now, savedAt: now }).bytes);
    saved = true;
  }
};
while (stateCalendar(state).year < start + years) {
  for (const { command } of lordBotCommands(state)) {
    const before = state;
    const next = gameReducer(state, command);
    if (next !== state) { state = next; note(before, state, `command:${command.type}`); }
  }
  const before = state;
  state = advanceTick(state);
  note(before, state, "tick");
}
console.log(JSON.stringify({ seed, years, events }, null, 1));
