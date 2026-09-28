// C5 gate (spec docs/design/cloth-chain.md CL-11): the bot from a seed's growth opening through chapters 1–3 into chapter
// 4, and its cloth chain — when each of the chain's buildings stood, the pasture, the first fleece, yarn, cloth at each
// stage, the first finished cloth sold (the gate), and the chain's first year after it. Stops a year after the first
// sale (or at `maxTicks`).
//   tsx scripts/clothChainRun.ts <seed> <maxTicks> > seed.json
import { CHAPTER_THREE } from "../src/content/chapterConfig";
import type { GameState } from "../src/engine/engine.types";
import { townCloth } from "../src/engine/cloth";
import { chapterEnd } from "../src/engine/politics";
import { stateCalendar } from "../src/engine/scenarioState";
import { treasuryBalance } from "../src/ledger/ledger";
import { runPhase19NaturalGrowth } from "./phase19NaturalGrowth";

const [seedArg, maxArg] = process.argv.slice(2);
const seed = Number(seedArg);
const maxTicks = Number(maxArg ?? 320_000);
const YEAR = 4000;
const when = (state: GameState) => ({ tick: state.tick, year: stateCalendar(state).year });
const firsts: Record<string, ReturnType<typeof when>> = {};
const note = (key: string, state: GameState, now: boolean) => { if (now && firsts[key] === undefined) firsts[key] = when(state); };
let chapter3End: ReturnType<typeof when> | null = null;
let sold = 0, ulnage = 0, fullingToll = 0, seen = 0;
let firstSale: number | null = null;
let last: GameState | null = null;

class Stop extends Error {}
try {
  runPhase19NaturalGrowth({ targetLots: 24, maxTicks, seed, onTick: state => {
    last = state;
    if (chapterEnd(state, CHAPTER_THREE.chapter) !== null) chapter3End ??= when(state);
    if (chapter3End === null) return;
    const has = (resource: string) => state.buildings.some(building => (building.inventory[resource as "fleece"] ?? 0) > 0);
    for (const kind of ["pastoral_farm", "weaver_house", "fulling_mill", "dyehouse", "tenter_yard"] as const) note(kind, state, state.buildings.some(building => building.kind === kind));
    note("pasture", state, (state.zones ?? []).some(zone => zone.kind === "pasture" && zone.membership.length > 0));
    for (const good of ["fleece", "yarn", "raw_cloth", "fulled_cloth", "dyes", "dyed_cloth", "finished_cloth"]) note(good, state, has(good));
    const entries = state.ledger?.entries ?? [];
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index]!;
      if (Number(entry.id.slice(7)) <= seen) break;
      if (entry.category === "ulnage") { sold += 1; ulnage += entry.amount; firstSale ??= state.tick; }
      if (entry.category === "fulling_toll") fullingToll += entry.amount;
    }
    seen = (state.ledger?.nextEntryOrdinal ?? 1) - 1;
    if (firstSale !== null && state.tick >= firstSale + YEAR) throw new Stop();
  // A stable town before its first cloth goes on (the growth run would stop at its stability).
  }, additionalAcceptance: () => firstSale !== null });
} catch (error) {
  if (!(error instanceof Stop)) throw error;
}
const final = last as GameState | null;
const ended = chapter3End as ReturnType<typeof when> | null;
process.stdout.write(`${JSON.stringify({ seed, maxTicks, chapter3End: ended, firstSale: firstSale === null ? null : { tick: firstSale, year: 1300 + Math.floor(firstSale / YEAR),
  afterChapter3: ended === null ? null : firstSale - ended.tick }, firsts,
  firstYear: { clothsSold: sold, ulnage, fullingToll }, cloth: final === null ? null : townCloth(final),
  final: final === null ? null : { ...when(final), chapter: final.politics?.chapter.number ?? 1, population: final.population, treasury: treasuryBalance(final),
    labour: final.labour ?? null, outcome: final.settlement?.outcome ?? null } }, null, 1)}\n`);
