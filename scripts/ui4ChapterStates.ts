// UI-4 gate 1 (world before UI): the seed 2 chapter 1 run (the bot, as F0-C1/F0-C2 evidence), saving the game state at
// the first moment of each story beat the screen must show — a house catching fire, the fire out (a burnt house), the
// wet summer of the dearth rehearsal, the Great Famine arriving (before the answer), the first petition waiting, a
// household leaving (S12), and the end of chapter 1. The browser captures (scripts/ui4Captures.mjs) open these states.
//   tsx scripts/ui4ChapterStates.ts <seed> <maxTicks> <out-dir>
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GameState } from "../src/engine/engine.types";
import { weatherAt } from "../src/engine/eventSchedule";
import { chapterEnd, famineStatus, openPetitions } from "../src/engine/politics";
import { runPhase19NaturalGrowth } from "./phase19NaturalGrowth";

const [seedArg, maxArg, out] = process.argv.slice(2);
mkdirSync(out!, { recursive: true });
const found = new Map<string, number>();
const save = (name: string, state: GameState) => {
  if (found.has(name)) return;
  found.set(name, state.tick);
  writeFileSync(join(out!, `${name}.json`), JSON.stringify(state));
  process.stderr.write(`${name} at tick ${state.tick}\n`);
};
let firstFireTick: number | null = null;
runPhase19NaturalGrowth({ targetLots: 24, maxTicks: Number(maxArg ?? 90_000), seed: Number(seedArg), onTick: state => {
  const burning = state.events?.burning ?? [];
  if (burning.length > 0 && firstFireTick === null) { firstFireTick = state.tick; save("fire-ignited", state); }
  if (firstFireTick !== null && state.tick === firstFireTick + 40 && burning.length > 0) save("fire-burning", state);
  if (!found.has("fire-out") && state.houses.some(house => house.burntTick !== undefined) && burning.length === 0) save("fire-out", state);
  const rehearsal = state.events?.records.find(record => record.defId === "dearth_rehearsal");
  if (rehearsal !== undefined && state.tick >= rehearsal.arrivalTick && weatherAt(state).kind === "wet" && state.tick % 50 === 0) save("dearth-wet-summer", state);
  const famine = famineStatus(state);
  if (famine !== null && famine.stage === "arrival" && famine.response === null) save("famine-arrival", state);
  if (openPetitions(state).length > 0) save("petition-open", state);
  if (state.houses.some(house => house.leavingSinceTick !== undefined && house.abandonedTick === undefined)) save("household-leaving", state);
  if (chapterEnd(state) !== null) save("chapter-end", state);
} });
writeFileSync(join(out!, "moments.json"), JSON.stringify(Object.fromEntries(found), null, 1) + "\n");
console.log(JSON.stringify(Object.fromEntries(found)));
