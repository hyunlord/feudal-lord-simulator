// F3-A gate (spec docs/design/chapter-three-plague.md PL-11): runs the bot from a seed's growth opening through chapters
// 1–3 and records the Black Death — the people it found and took (the share, whole households, the lord's household),
// the labour before and after, the answers, the wages, the empty plots and their resettlement, the second pestilence,
// chapter 3's end. Stops at chapter 4 (or `maxTicks`).
//   tsx scripts/chapterThreeRun.ts <seed> <maxTicks> > seed.json
import { CHAPTER_THREE } from "../src/content/chapterConfig";
import type { GameState } from "../src/engine/engine.types";
import { lordshipOf } from "../src/engine/lordshipState";
import { labourPool } from "../src/engine/persons";
import { plagueVacantPlots } from "../src/engine/plague";
import { chapterEnd } from "../src/engine/politics";
import { stateCalendar } from "../src/engine/scenarioState";
import { treasuryBalance } from "../src/ledger/ledger";
import { runPhase19NaturalGrowth } from "./phase19NaturalGrowth";

const [seedArg, maxArg] = process.argv.slice(2);
const seed = Number(seedArg);
const maxTicks = Number(maxArg ?? 280_000);

const when = (state: GameState) => ({ tick: state.tick, year: stateCalendar(state).year, population: state.population, labour: labourPool(state),
  treasury: treasuryBalance(state), lived: state.houses.filter(house => house.residents > 0).length, houses: state.houses.length,
  l4: state.houses.filter(house => house.level >= 4 && house.residents > 0).length });
let chapter3: ReturnType<typeof when> | null = null;
let arrival: ReturnType<typeof when> | null = null;
let arrivalEnd: ReturnType<typeof when> | null = null;
let lowest: ReturnType<typeof when> | null = null;
let houseOrder = 1;
const houseChanges: { tick: number; year: number }[] = [];
const declines: { tick: number; cause: string }[] = [];
const yearly: ReturnType<typeof when>[] = [];
const ledger = new Map<string, number>();
let seen = 0;
let last: GameState | null = null;

class Stop extends Error {}
try {
  runPhase19NaturalGrowth({ targetLots: 24, maxTicks, seed, onTick: state => {
    last = state;
    if ((state.politics?.chapter.number ?? 1) >= CHAPTER_THREE.chapter) chapter3 ??= when(state);
    const first = state.plague?.first;
    if (first !== undefined) arrival ??= { ...when(state), population: first.populationAtArrival };
    if (first?.endTick !== undefined) arrivalEnd ??= when(state);
    if (arrival !== null && (lowest === null || state.population < lowest.population)) lowest = when(state);
    const order = lordshipOf(state).house.order;
    if (order > houseOrder) { houseOrder = order; houseChanges.push({ tick: state.tick, year: stateCalendar(state).year }); }
    const decline = state.lordship?.decline;
    if (decline != null && declines.at(-1)?.tick !== decline.since) declines.push({ tick: decline.since, cause: decline.cause });
    if (chapter3 !== null && state.tick % 4000 === 0) yearly.push(when(state));
    // The ledger's chapter-3 lines as they are posted (entries fold into roll-ups after six periods).
    const entries = state.ledger?.entries ?? [];
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index]!;
      const ordinal = Number(entry.id.slice(7));
      if (ordinal <= seen) break;
      if (["wages", "statute_fine", "church_fee", "entry_fine"].includes(entry.category)) ledger.set(entry.category, (ledger.get(entry.category) ?? 0) + entry.amount);
    }
    seen = (state.ledger?.nextEntryOrdinal ?? 1) - 1;
    if (chapterEnd(state, CHAPTER_THREE.chapter) !== null) throw new Stop();
  } });
} catch (error) {
  if (!(error instanceof Stop)) throw error;
}
const final = last as GameState | null;
const end = final === null ? null : chapterEnd(final, CHAPTER_THREE.chapter);
const plague = final?.plague ?? null;
const first = plague?.first;
process.stdout.write(`${JSON.stringify({ seed, maxTicks, chapter3, arrival, arrivalEnd, lowest,
  plague: plague === null ? null : { eraTick: plague.eraTick, rumourTick: plague.rumourTick ?? null, first: first ?? null, second: plague.second ?? null,
    deathRate: first === undefined || first.populationAtArrival === 0 ? null : first.dead / first.populationAtArrival,
    answers: plague.answers, curacy: plague.curacy ?? null, ordinanceTick: plague.ordinanceTick ?? null, statuteFine: plague.statuteFine ?? 0,
    resettled: plague.resettled, recovered: plague.recovered, fled: plague.fled, vacantNow: final === null ? 0 : plagueVacantPlots(final).length, endedTick: plague.endedTick ?? null },
  ledger: Object.fromEntries(ledger), houseChanges, declines, yearly,
  chapterEnd: end === null ? null : { tick: end.tick, year: end.chronicle.toYear, plague: end.chronicle.stats.plague ?? null, populationEnd: end.chronicle.stats.populationEnd },
  final: final === null ? null : { ...when(final), era: final.era, outcome: final.settlement?.outcome ?? null, chapter: final.politics?.chapter.number ?? 1 } }, null, 1)}\n`);
