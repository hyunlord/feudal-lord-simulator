// UI-6 gate states (current-format bare states, the scene injection admits them):
//  - war (seed 2, the guardrail bot through chapter 2): the messenger's season, each of the war's five demands while
//    it is still open (the tick it arrives, before the bot answers), the beacon lit, the tick before and after the
//    raid, and chapter 2's end;
//  - house (FAIL-3's naive run, seed 3 `--naive-upkeep --famine-response=speculation`): the 3rd rung (a right lost)
//    and the 4th (the house changed).
// Beside them moments.json (what each is). Deterministic (the bot and the seed).
//   tsx scripts/ui6States.ts <war|house> <seed> <maxTicks> <out-dir>
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { WAR_PETITION_IDS } from "../src/content/warConfig";
import type { GameState } from "../src/engine/engine.types";
import { lordshipOf } from "../src/engine/lordshipState";
import { chapterEnd } from "../src/engine/politics";
import { stateCalendar } from "../src/engine/scenarioState";
import { beaconLit } from "../src/engine/war";
import { runPhase19NaturalGrowth } from "./phase19NaturalGrowth";

const [mode, seedArg, maxArg, out] = process.argv.slice(2);
if (mode !== "war" && mode !== "house") throw new Error("mode: war | house");
mkdirSync(out!, { recursive: true });
const seed = Number(seedArg);
const found = new Map<string, Record<string, unknown>>();
const save = (name: string, state: GameState, about: Record<string, unknown> = {}) => {
  if (found.has(name)) return;
  found.set(name, { tick: state.tick, year: stateCalendar(state).year, ...about });
  writeFileSync(join(out!, `${name}.json`), JSON.stringify(state));
  process.stderr.write(`${name} at tick ${state.tick} (${stateCalendar(state).year})\n`);
};
const wanted = mode === "war" ? ["messenger", ...WAR_PETITION_IDS, "beacon", "before-raid", "raid", "chapter2-end"] : ["decline", "house-change"];
let previous: GameState | null = null;
class Stop extends Error {}
try {
  runPhase19NaturalGrowth({ targetLots: 24, maxTicks: Number(maxArg), seed,
    ...(mode === "house" ? { naiveUpkeep: true, famineResponse: "speculation" as const } : {}), onTick: state => {
      if (mode === "war") {
        if (state.war !== undefined && previous?.war === undefined) save("messenger", state);
        for (const petition of state.politics?.petitions ?? []) {
          if (petition.response === undefined && (WAR_PETITION_IDS as readonly string[]).includes(petition.defId)) save(petition.defId, state, { petitionId: petition.id });
        }
        if (beaconLit(state)) save("beacon", state);
        if (state.war?.raid !== undefined && previous !== null && previous.war?.raid === undefined) { save("before-raid", previous); save("raid", state, { raid: state.war.raid }); }
        if (chapterEnd(state, 2) !== null) save("chapter2-end", state, { end: chapterEnd(state, 2) });
      } else {
        const now = lordshipOf(state); const was = previous === null ? null : lordshipOf(previous);
        if (now.decline !== null && (was === null || was.decline === null)) save("decline", state, { decline: now.decline });
        if (was !== null && now.house.order > was.house.order) save("house-change", state, { withdrew: was.house.name, arrived: now.house.name });
      }
      previous = state;
      if (wanted.every(name => found.has(name))) throw new Stop();
    } });
} catch (error) {
  if (!(error instanceof Stop)) throw error;
}
writeFileSync(join(out!, `moments-${mode}.json`), JSON.stringify(Object.fromEntries(found), null, 1) + "\n");
const missing = wanted.filter(name => !found.has(name));
console.log(JSON.stringify({ mode, seed, found: Object.fromEntries([...found].map(([name, about]) => [name, about.year])), missing }));
process.exitCode = missing.length === 0 ? 0 : 1;
