// SMOOTH-1 scene saves: one guardrail bot run of a seed (the bot's answers, no state edited) from the growth opening
// through chapter 5, written as save files (encodeSave bytes, the format the game's IndexedDB slots hold) so the
// hitch audit loads them the way a player does — 이어하기 on a production build. Beside them scenes.json (tick, year,
// chapter, population of each).
//   ch2-1340     the first tick of chapter 2 or later in 1340
//   ch3-plague   400 ticks before the first pestilence arrives (it arrives 20 s into a 1x run)
//   ch4-1380     the first tick of chapter 4 or later in 1380
//   ch5-1440     the first tick of chapter 5 in 1440 (or the run's last chapter-5 state)
//   pre-chapter3 400 ticks before chapter 2 turns to chapter 3 (the chapter change inside the run)
//   pre-petition 300 ticks before the first petition of chapter 2 opens (its modal inside the run)
//   tsx scripts/perf/hitchStates.ts <out-dir> [seed=2] [maxTicks=600000]
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GameState } from "../../src/engine/engine.types";
import { openPetitions } from "../../src/engine/politics";
import { stateCalendar } from "../../src/engine/scenarioState";
import { encodeSave } from "../../src/save/saveCodec";
import { runPhase19NaturalGrowth } from "../phase19NaturalGrowth";

const [out, seedArg, maxArg] = process.argv.slice(2);
if (out === undefined) throw new Error("Usage: hitchStates.ts <out-dir> [seed] [maxTicks]");
const seed = Number(seedArg ?? 2);
const maxTicks = Number(maxArg ?? 600_000);
const FIXED_TIME = "2026-09-29T00:00:00.000Z";
mkdirSync(out, { recursive: true });

const chapter = (state: GameState) => state.politics?.chapter.number ?? 1;
const year = (state: GameState) => stateCalendar(state).year;
const scenes: Record<string, Record<string, unknown>> = {};
const ring: GameState[] = [];   // one state every 100 ticks, the last 10 (1,000 ticks back)
const back = (ticks: number) => ring[Math.max(0, ring.length - 1 - Math.round(ticks / 100))];
let lastChapter5: GameState | null = null;
let previous: GameState | null = null;

function write(name: string, state: GameState | undefined, why: string) {
  if (state === undefined || name in scenes) return;
  const encoded = encodeSave({ state, createdAt: FIXED_TIME, savedAt: FIXED_TIME, gameVersion: "0.1.0+smooth1" });
  writeFileSync(join(out!, `${name}.save.json`), encoded.bytes);
  scenes[name] = { tick: state.tick, year: year(state), season: stateCalendar(state).season, chapter: chapter(state),
    population: state.population, buildings: state.buildings.length, bytes: encoded.bytes.length, why };
  console.log(name, JSON.stringify(scenes[name]));
}

class Done extends Error {}
try {
  runPhase19NaturalGrowth({ targetLots: 24, maxTicks, seed, additionalAcceptance: state => year(state) >= 1441, onTick: state => {
    if (state.tick % 100 === 0) { ring.push(state); if (ring.length > 10) ring.shift(); }
    if (chapter(state) >= 2 && year(state) >= 1340) write("ch2-1340", state, "first tick of chapter 2+ in 1340");
    if (state.plague?.first !== undefined && previous?.plague?.first === undefined) write("ch3-plague", back(400), "400 ticks before the first pestilence");
    if (chapter(state) >= 4 && year(state) >= 1380) write("ch4-1380", state, "first tick of chapter 4+ in 1380");
    if (chapter(state) >= 5) lastChapter5 = state;
    if (chapter(state) >= 5 && year(state) >= 1440) write("ch5-1440", state, "first tick of chapter 5 in 1440");
    if (previous !== null && chapter(previous) === 2 && chapter(state) === 3) write("pre-chapter3", back(400), "400 ticks before chapter 2 turns to 3");
    if (previous !== null && chapter(state) === 2 && openPetitions(state).length > openPetitions(previous).length) write("pre-petition", back(300), "300 ticks before chapter 2's first petition");
    previous = state;
    if (Object.keys(scenes).length === 6) throw new Done();
  } });
} catch (error) {
  if (!(error instanceof Done)) throw error;
}
if (!("ch5-1440" in scenes) && lastChapter5 !== null) write("ch5-1440", lastChapter5, "the run's last chapter-5 state (1440 not reached)");
writeFileSync(join(out, "scenes.json"), `${JSON.stringify({ seed, maxTicks, scenes }, null, 2)}\n`);
console.log(`scenes: ${Object.keys(scenes).join(", ")}`);
