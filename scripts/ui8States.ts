// UI-8 gate states (current-format bare states, the scene injection admits them): seed 2, the guardrail bot through
// chapter 3 (F3-A) — the first tick of each chapter 3 ledger line (the rumour, the arrival, the priest's death, the new
// graves, the empty streets, the abandoned fields, the ordinance, the resettlement, the second pestilence and its end),
// the first plague death day, each of the four decisions while it is still open (the tick it arrives, before the bot
// answers), and chapter 3's end. Beside them moments-plague.json (what each is). Deterministic (the bot and the seed).
//   tsx scripts/ui8States.ts <seed> <maxTicks> <out-dir>
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PLAGUE_PETITION_IDS } from "../src/content/plagueConfig";
import type { GameState } from "../src/engine/engine.types";
import { plagueVacantPlots } from "../src/engine/plague";
import { chapterEnd } from "../src/engine/politics";
import { stateCalendar } from "../src/engine/scenarioState";
import { runPhase19NaturalGrowth } from "./phase19NaturalGrowth";

const [seedArg, maxArg, out] = process.argv.slice(2);
mkdirSync(out!, { recursive: true });
const seed = Number(seedArg);
const found = new Map<string, Record<string, unknown>>();
const save = (name: string, state: GameState, about: Record<string, unknown> = {}) => {
  if (found.has(name)) return;
  found.set(name, { tick: state.tick, year: stateCalendar(state).year, ...about });
  writeFileSync(join(out!, `${name}.json`), JSON.stringify(state));
  process.stderr.write(`${name} at tick ${state.tick} (${stateCalendar(state).year})\n`);
};
const LINES = ["plague.rumour", "plague.arrived", "plague.priest_died", "plague.new_graves", "plague.empty_streets", "plague.abandoned_fields",
  "plague.ordinance", "plague.resettlement", "plague.second", "plague.second_ended"];
const wanted = [...LINES, "first-deaths", ...PLAGUE_PETITION_IDS, "chapter3-end"];
let lastHistory: GameState["history"] | undefined;
class Stop extends Error {}
try {
  runPhase19NaturalGrowth({ targetLots: 24, maxTicks: Number(maxArg), seed, onTick: state => {
    // The ledger's new lines (it trims its old ones, so by the tick, not by the count).
    if (state.history !== lastHistory) {
      for (const record of state.history?.records ?? []) {
        if (record.tick >= state.tick - 1 && LINES.includes(record.template)) save(record.template, state, { params: record.params ?? {} });
      }
      lastHistory = state.history;
    }
    if ((state.plague?.first?.dead ?? 0) > 0) save("first-deaths", state, { dead: state.plague!.first!.dead, vacant: plagueVacantPlots(state).length });
    for (const petition of state.politics?.petitions ?? []) {
      if (petition.response === undefined && (PLAGUE_PETITION_IDS as readonly string[]).includes(petition.defId)) save(petition.defId, state, { petitionId: petition.id });
    }
    if (chapterEnd(state, 3) !== null) save("chapter3-end", state, { end: chapterEnd(state, 3) });
    if (wanted.every(name => found.has(name))) throw new Stop();
  } });
} catch (error) {
  if (!(error instanceof Stop)) throw error;
}
writeFileSync(join(out!, "moments-plague.json"), JSON.stringify(Object.fromEntries(found), null, 1) + "\n");
const missing = wanted.filter(name => !found.has(name));
console.log(JSON.stringify({ seed, found: Object.fromEntries([...found].map(([name, about]) => [name, about.year])), missing }));
process.exitCode = missing.length === 0 ? 0 : 1;
