// LM-E2 (spec docs/design/estates.md ES-9): a chapter's town fixture — the guardrail's growth run of a seed (the bot and
// its answers) stopped at the first tick of chapter `n`, saved as `fixtures/saves/v<SAVE_SCHEMA_VERSION>/chapter-<n>-town`
// (its path cache emptied) and added to that manifest. Chapters 4 and 5 keep their F4-A/F5-A names.
//   tsx scripts/chapterTownFixture.ts <chapter 2|3> [seed]
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import type { GameState } from "../src/engine/engine.types";
import { stateCalendar } from "../src/engine/scenarioState";
import { encodeSave } from "../src/save/saveCodec";
import { SAVE_SCHEMA_VERSION } from "../src/save/saveTypes";
import { runPhase19NaturalGrowth } from "./phase19NaturalGrowth";

const NAMES: Readonly<Record<number, string>> = { 2: "chapter-two-town", 3: "chapter-three-town" };
const chapter = Number(process.argv[2]);
const seed = Number(process.argv[3] ?? 1);
const id = NAMES[chapter];
if (id === undefined) throw new Error("usage: chapterTownFixture.ts <2|3> [seed]");
const FIXED_TIME = "2026-09-24T00:00:00.000Z";
class Stop extends Error {}
let found: GameState | null = null;
try {
  runPhase19NaturalGrowth({ targetLots: 24, maxTicks: 480_000, seed, onTick: state => {
    if ((state.politics?.chapter.number ?? 1) >= chapter) { found = state; throw new Stop(); }
  }, additionalAcceptance: state => (state.politics?.chapter.number ?? 1) >= chapter });
} catch (error) {
  if (!(error instanceof Stop)) throw error;
}
const town = found as GameState | null;
if (town === null) throw new Error(`seed ${seed} did not reach chapter ${chapter}`);
const state: GameState = { ...town, pathCache: {} };
const encoded = encodeSave({ state, createdAt: FIXED_TIME, savedAt: FIXED_TIME, gameVersion: "0.1.0+fixture" });
const dir = `fixtures/saves/v${SAVE_SCHEMA_VERSION}`;
writeFileSync(`${dir}/${id}.save.json`, encoded.bytes);
const manifestPath = `${dir}/manifest.json`;
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { fixtures: { id: string }[] };
const entry = { id, description: `a town at chapter ${chapter}'s first tick: the guardrail's growth run of seed ${seed} (the bot and its answers); its path cache emptied`,
  file: `${id}.save.json`, bytes: encoded.bytes.byteLength, sha256: createHash("sha256").update(encoded.bytes).digest("hex"), tick: state.tick,
  year: stateCalendar(state).year, population: state.population, era: state.era, buildings: state.buildings.length, houses: state.houses.length };
manifest.fixtures = [...manifest.fixtures.filter(fixture => fixture.id !== entry.id), entry];
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(entry)}\n`);
