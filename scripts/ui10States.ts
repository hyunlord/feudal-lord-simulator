// UI-10 gate states (current-format bare states, the scene injection admits them): seed 2, the guardrail bot through
// chapters 1–4 into chapter 5 (F5-A + FIX-9) and on to the last market day of 1450 — chapter 4's end, chapter 5's
// opening, the first tick of each chapter 5 step's ledger line (legacy.*: the mayor's demand, the Crown's envoy, the
// succession, the town's seal, the charter sealed or refused, the family gone or staying, the legacy sealed, the last
// market day), the interlude's events 1391–1399 (the Staple, the guild's quarrel or the market's fire, the parish's
// nave, the deposition), each of the six chapter 5 petitions while it is still open (the four decisions, the interlude's
// two), the tick after the family's leaving (the empty manor), chapter 5's end and, a few ticks on, the campaign won.
// Beside them moments-legacy.json (what each is). Deterministic (the bot and the seed; its standard answers, LG-10).
//   tsx scripts/ui10States.ts <seed> <maxTicks> <out-dir>
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CHAPTER_FIVE } from "../src/content/chapterConfig";
import { LEGACY_INTERLUDE_IDS, LEGACY_PETITION_IDS } from "../src/content/legacyConfig";
import type { GameState } from "../src/engine/engine.types";
import { chapterEnd } from "../src/engine/politics";
import { stateCalendar } from "../src/engine/scenarioState";
import { runPhase19NaturalGrowth } from "./phase19NaturalGrowth";

const [seedArg, maxArg, out] = process.argv.slice(2);
mkdirSync(out!, { recursive: true });
const seed = Number(seedArg);
const started = Date.now();
const found = new Map<string, Record<string, unknown>>();
const save = (name: string, state: GameState, about: Record<string, unknown> = {}) => {
  if (found.has(name)) return;
  found.set(name, { tick: state.tick, year: stateCalendar(state).year, ...about });
  writeFileSync(join(out!, `${name}.json`), JSON.stringify(state));
  writeFileSync(join(out!, "moments-legacy.json"), JSON.stringify(Object.fromEntries(found), null, 1) + "\n");
  process.stderr.write(`${name} at tick ${state.tick} (${stateCalendar(state).year}) +${Math.round((Date.now() - started) / 1000)} s\n`);
};
// Each ledger line by the step it is (the charter's and the family's lines are named by their answer).
const STEP_LINES: Readonly<Record<string, string>> = {
  "legacy.mayor_demand": "mayor_demand", "legacy.royal_tax_envoy": "royal_tax_envoy", "legacy.succession": "succession", "legacy.city_seal": "city_seal",
  "legacy.charter_sealed": "charter_sealing", "legacy.charter_refused": "charter_sealing", "legacy.family_departed": "family_departure",
  "legacy.family_stayed": "family_departure", "legacy.legacy_record": "legacy_record", "legacy.last_market": "last_market",
};
const INTERLUDE_LINES = new Set(LEGACY_INTERLUDE_IDS.map(id => `legacy.${id}`));
const OTHER_LINES = new Set(["legacy.heir_seated", "legacy.nave_rebuilt"]);
const wanted = ["chapter4-end", "chapter5-open", ...new Set(Object.values(STEP_LINES))].map(name => name.startsWith("chapter") ? name : `legacy.${name}`)
  .concat(["interlude.staple", "interlude.guild_dispute|interlude.market_fire", "interlude.church_rebuilding", "interlude.deposition"],
    LEGACY_PETITION_IDS, ["empty-manor", "chapter5-end", "campaign-victory"]);
const last: { history: GameState["history"] | undefined; seen: Set<string> } = { history: undefined, seen: new Set() };
function watch(state: GameState) {
  if (state.history === last.history) return;
  for (const record of state.history?.records ?? []) {
    if (last.seen.has(record.id)) continue;
    last.seen.add(record.id);
    const step = STEP_LINES[record.template];
    if (step !== undefined) save(`legacy.${step}`, state, { template: record.template, params: record.params ?? {} });
    else if (INTERLUDE_LINES.has(record.template)) save(`interlude.${record.template.slice("legacy.".length)}`, state, { template: record.template, params: record.params ?? {} });
    else if (OTHER_LINES.has(record.template)) save(record.template, state, { params: record.params ?? {} });
  }
  last.history = state.history;
}
class Stop extends Error {}
let endTick: number | null = null;
try {
  runPhase19NaturalGrowth({ targetLots: 24, maxTicks: Number(maxArg), seed, onTick: state => {
    if (chapterEnd(state, 4) !== null) save("chapter4-end", state, { end: chapterEnd(state, 4) });
    if (state.legacy !== undefined) save("chapter5-open", state, { startTick: state.legacy.startTick });
    watch(state);
    for (const petition of state.politics?.petitions ?? []) {
      if (petition.response === undefined && (LEGACY_PETITION_IDS as readonly string[]).includes(petition.defId)) {
        save(petition.defId, state, { petitionId: petition.id, options: petition.options ?? null,
          ...(petition.defId === "heir_choice" ? { candidates: state.legacy?.candidates.length ?? 0 } : {}) });
      }
    }
    const departed = state.legacy?.steps.family_departure;
    if (departed !== undefined && state.tick > departed) save("empty-manor", state, { family: state.legacy?.family ?? null, departedTick: departed });
    if (state.tick % 40_000 === 0) process.stderr.write(`… tick ${state.tick} (${stateCalendar(state).year}) chapter ${state.politics?.chapter.number ?? 1} +${Math.round((Date.now() - started) / 1000)} s\n`);
    const end = chapterEnd(state, CHAPTER_FIVE.chapter);
    if (end !== null) {
      endTick ??= state.tick;
      save("chapter5-end", state, { end, outcome: state.settlement?.outcome ?? null, ending: state.legacy?.ending?.id ?? null });
      // The campaign's end screen (FL-9): a few ticks on, the settlement's outcome `victory`.
      if (state.tick >= endTick + 8 && state.settlement?.outcome === "victory") {
        save("campaign-victory", state, { outcome: state.settlement.outcome, ending: state.legacy?.ending?.id ?? null });
        throw new Stop();
      }
    }
  // The growth run would stop at the town's stability: chapter 5 goes on to its end (as scripts/chapterFiveRun.ts).
  }, additionalAcceptance: () => found.has("campaign-victory") });
} catch (error) {
  if (!(error instanceof Stop)) throw error;
}

const missing = wanted.filter(name => !name.split("|").some(option => found.has(option)));
console.log(JSON.stringify({ seed, seconds: Math.round((Date.now() - started) / 1000), found: Object.fromEntries([...found].map(([name, about]) => [name, about.year])), missing }));
process.exitCode = missing.length === 0 ? 0 : 1;
