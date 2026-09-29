// UI-9 gate states (current-format bare states, the scene injection admits them): seed 2, the guardrail bot through
// chapters 1–3 into chapter 4 (F4-A) — chapter 3's end (chapter 4's opening), the first tick of each chapter 4 ledger
// line (reorg.*: the wages war, the textile street, the alehouses, the petitions' surge, the guild, the earl's warning,
// the poll tax, the rumour of 1381, the autonomy request, the charter …), each of the four decisions while it is still
// open, and chapter 4's end. The bot answers the tax the standard way (the community collects), so its rumour passes
// quietly (`rumour-quiet`); from the tax petition's state a second run answers "direct collection" (refuse) and the
// bot does the rest, to the rumour with the collectors chased (`rumour-chased`) and the request that follows at once.
// Beside them moments-reorg.json (what each is). Deterministic (the bot, the seed and the one answer).
//   tsx scripts/ui9States.ts <seed> <maxTicks> <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { REORGANISATION_PETITION_IDS, TAX_COLLECTION_PETITION_ID } from "../src/content/reorganisationConfig";
import type { GameState } from "../src/engine/engine.types";
import { openPetitions, chapterEnd } from "../src/engine/politics";
import { revoltPressure } from "../src/engine/reorganisation";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { gameReducer } from "../src/state/gameStore";
import { createAutoplayTraceDriver } from "./economyHarnessAutoplay";
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
const LINES = ["reorg.wage_competition", "reorg.textile_street", "reorg.alehouse_boom", "reorg.petitions_surge", "reorg.guild_founded", "reorg.overlord_warning",
  "reorg.poll_tax", "reorg.rebellion_rumour", "reorg.autonomy_request", "reorg.charter"];
const wanted = ["chapter3-end", ...LINES, ...REORGANISATION_PETITION_IDS, "chapter4-end"];
// Each ledger line once, by its id (the guild's line is written with the answer, a tick behind the scan).
function watch(state: GameState, last: { history: GameState["history"] | undefined; seen?: Set<string> }, prefix = "") {
  if (state.history !== last.history) {
    last.seen ??= new Set((last.history?.records ?? []).map(record => record.id));
    for (const record of state.history?.records ?? []) {
      if (last.seen.has(record.id)) continue;
      last.seen.add(record.id);
      if (LINES.includes(record.template)) {
        save(`${prefix}${record.template}`, state, { params: record.params ?? {} });
        if (record.template === "reorg.rebellion_rumour") save(`${prefix === "" ? "rumour-" : prefix}${String(record.params?.outcome ?? "quiet")}`, state,
          { pressure: revoltPressure(state), params: record.params ?? {} });
      }
    }
    last.history = state.history;
  }
}
const standard: { history: GameState["history"] | undefined; seen?: Set<string> } = { history: undefined, seen: new Set() };
class Stop extends Error {}
try {
  runPhase19NaturalGrowth({ targetLots: 24, maxTicks: Number(maxArg), seed, onTick: state => {
    if (chapterEnd(state, 3) !== null) save("chapter3-end", state, { end: chapterEnd(state, 3) });
    watch(state, standard);
    for (const petition of state.politics?.petitions ?? []) {
      if (petition.response === undefined && (REORGANISATION_PETITION_IDS as readonly string[]).includes(petition.defId)) save(petition.defId, state, { petitionId: petition.id });
    }
    if (chapterEnd(state, 4) !== null) { save("chapter4-end", state, { end: chapterEnd(state, 4) }); throw new Stop(); }
  // The growth run would stop at the town's stability: chapter 4 goes on to its end (as scripts/chapterFourRun.ts).
  }, additionalAcceptance: state => chapterEnd(state, 4) !== null });
} catch (error) {
  if (!(error instanceof Stop)) throw error;
}

// The other rumour: from the tax petition's state, direct collection (the one answer), the bot for the rest.
if (found.has(TAX_COLLECTION_PETITION_ID)) {
  let state = JSON.parse(readFileSync(join(out!, `${TAX_COLLECTION_PETITION_ID}.json`), "utf8")) as GameState;
  const driver = createAutoplayTraceDriver();
  const direct: { history: GameState["history"] | undefined; seen?: Set<string> } = { history: state.history };
  for (let step = 0; step < 60_000 && !found.has("direct.reorg.autonomy_request"); step += 1) {
    for (const petition of openPetitions(state)) {
      if (petition.defId === TAX_COLLECTION_PETITION_ID) state = gameReducer(state, { type: "petition_response", petitionId: petition.id, response: "refuse" });
    }
    state = advanceTick(driver.apply(state));
    watch(state, direct, "direct.");
  }
  if (found.has("direct.chased")) { found.set("rumour-chased", found.get("direct.chased")!); writeFileSync(join(out!, "rumour-chased.json"), readFileSync(join(out!, "direct.chased.json"))); }
}
wanted.push("rumour-quiet", "rumour-chased");
writeFileSync(join(out!, "moments-reorg.json"), JSON.stringify(Object.fromEntries(found), null, 1) + "\n");
const missing = wanted.filter(name => !found.has(name));
console.log(JSON.stringify({ seed, found: Object.fromEntries([...found].map(([name, about]) => [name, about.year])), missing }));
process.exitCode = missing.length === 0 ? 0 : 1;
