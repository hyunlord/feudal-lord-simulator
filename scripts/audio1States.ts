// AUDIO-1 gate ② states: the seed 2 chapter 1 run (the bot answers the Great Famine with relief), saving the moments the
// sound captures open — a house burning (fire), three seconds before a season's end in a working town (the season's
// change: its stinger and the ambience crossfade) and the wet summer of the dearth rehearsal (its rain). The market day comes from the seed 1 determinism town (two markets;
// the seed 2 chapter builds none under MARKET-1's rules): run on tick by tick until six marketgoers crowd a market.
//   tsx scripts/audio1States.ts <seed> <maxTicks> <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GameState } from "../src/engine/engine.types";
import { wetSummer } from "../src/render/wetSummer";
import { advanceTick } from "../src/engine/tick";
import { residentWalkers } from "../src/ui/residentTrips";
import { runPhase19NaturalGrowth } from "./phase19NaturalGrowth";

const [seedArg, maxArg, out] = process.argv.slice(2);
mkdirSync(out!, { recursive: true });
const SEASON = 1_000;
const found = new Map<string, number>();
const save = (name: string, state: GameState) => {
  if (found.has(name)) return;
  found.set(name, state.tick);
  writeFileSync(join(out!, `${name}.json`), JSON.stringify(state));
  process.stderr.write(`${name} at tick ${state.tick}\n`);
};
let ignited: number | null = null;
runPhase19NaturalGrowth({ targetLots: 24, maxTicks: Number(maxArg ?? 120_000), seed: Number(seedArg), famineResponse: "relief", onTick: state => {
  const burning = state.events?.burning ?? [];
  if (burning.length > 0 && ignited === null) ignited = state.tick;
  if (ignited !== null && state.tick === ignited + 40 && burning.length > 0) save("fire", state);
  // A working town (a mill and a sawmill) three seconds (60 ticks at 1x) before a season ends.
  if (state.tick > 20_000 && state.tick % SEASON === SEASON - 60 && state.buildings.some(building => building.kind === "sawmill")
    && state.buildings.some(building => building.kind === "mill")) save("season-end", state);
  // The dearth rehearsal's wet summer (its rain), a season in.
  if (wetSummer(state) && state.tick % SEASON === 300) save("wet-summer", state);
}, additionalAcceptance: () => ["fire", "season-end", "wet-summer"].every(name => found.has(name)) });
const crowded = (state: GameState) => {
  const goers = residentWalkers(state).filter(walker => walker.resident.purpose === "market");
  return state.buildings.filter(building => building.kind === "market")
    .some(market => goers.filter(walker => Math.hypot(walker.position.tx - market.tx, walker.position.ty - market.ty) <= 6).length >= 6);
};
let town = JSON.parse(readFileSync("fixtures/determinism/seed1/final-state.json", "utf8")) as GameState;
for (let step = 0; step < 4_000 && !crowded(town); step += 1) town = advanceTick(town);
if (crowded(town)) save("market-day", town);
writeFileSync(join(out!, "moments.json"), JSON.stringify(Object.fromEntries(found), null, 1) + "\n");
console.log(JSON.stringify(Object.fromEntries(found)));
if (!["fire", "season-end", "wet-summer", "market-day"].every(name => found.has(name))) process.exit(1);
