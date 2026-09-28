// F5-A (spec docs/design/chapter-five-legacy.md LG-1): the chapter-5 town fixture — the guardrail's growth run of seed 1
// (the bot, chapters 1–4 with the bot's answers) stopped at the first tick of chapter 5, saved as
// `fixtures/saves/v<SAVE_SCHEMA_VERSION>/chapter-five-town.save.json` (its path cache emptied) and added to that manifest.
//   tsx scripts/chapterFiveFixture.ts [seed]
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { CHAPTER_FIVE } from "../src/content/chapterConfig";
import type { GameState } from "../src/engine/engine.types";
import { stateCalendar } from "../src/engine/scenarioState";
import { encodeSave } from "../src/save/saveCodec";
import { SAVE_SCHEMA_VERSION } from "../src/save/saveTypes";
import { runPhase19NaturalGrowth } from "./phase19NaturalGrowth";

const seed = Number(process.argv[2] ?? 1);
const FIXED_TIME = "2026-09-24T00:00:00.000Z";
class Stop extends Error {}
let found: GameState | null = null;
try {
  runPhase19NaturalGrowth({ targetLots: 24, maxTicks: 480_000, seed, onTick: state => {
    if ((state.politics?.chapter.number ?? 1) >= CHAPTER_FIVE.chapter) { found = state; throw new Stop(); }
  }, additionalAcceptance: state => (state.politics?.chapter.number ?? 1) >= CHAPTER_FIVE.chapter });
} catch (error) {
  if (!(error instanceof Stop)) throw error;
}
const town = found as GameState | null;
if (town === null) throw new Error(`seed ${seed} did not reach chapter 5`);
// The path cache is a cache (rebuilt as routes are asked): the fixture keeps the town, not its memo.
const state: GameState = { ...town, pathCache: {} };
const encoded = encodeSave({ state, createdAt: FIXED_TIME, savedAt: FIXED_TIME, gameVersion: "0.1.0+fixture" });
const dir = `fixtures/saves/v${SAVE_SCHEMA_VERSION}`;
writeFileSync(`${dir}/chapter-five-town.save.json`, encoded.bytes);
const manifestPath = `${dir}/manifest.json`;
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { fixtures: { id: string }[] };
const entry = { id: "chapter-five-town", description: `a town that came through chapters 1-4: the guardrail's growth run of seed ${seed} (the bot and its answers) at chapter 5's first tick; its path cache emptied`,
  file: "chapter-five-town.save.json", bytes: encoded.bytes.byteLength, sha256: createHash("sha256").update(encoded.bytes).digest("hex"), tick: state.tick,
  year: stateCalendar(state).year, population: state.population, era: state.era, buildings: state.buildings.length, houses: state.houses.length };
manifest.fixtures = [...manifest.fixtures.filter(fixture => fixture.id !== entry.id), entry];
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(entry)}\n`);
