// F4-A gate (spec docs/design/chapter-four-reorganisation.md RG-11): runs the bot from a seed's growth opening through
// chapters 1–3 into chapter 4 and records the reorganisation — its steps, the four answers, the influence and the
// relations year by year, the rumour of 1381, the charter, chapter 4's end and chapter 5's start — and the treasury's
// income by category through chapter 4 (all of it and its last four years: is cloth the chief income?). Stops at
// chapter 5 (or `maxTicks`).
//   tsx scripts/chapterFourRun.ts <seed> <maxTicks> > seed.json
import { CHAPTER_FOUR, CHAPTER_THREE } from "../src/content/chapterConfig";
import type { GameState } from "../src/engine/engine.types";
import { chapterEnd } from "../src/engine/politics";
import { reorganisationForecast, revoltPressure } from "../src/engine/reorganisation";
import { stateCalendar } from "../src/engine/scenarioState";
import { treasuryBalance } from "../src/ledger/ledger";
import { runPhase19NaturalGrowth } from "./phase19NaturalGrowth";

const [seedArg, maxArg] = process.argv.slice(2);
const seed = Number(seedArg);
const maxTicks = Number(maxArg ?? 420_000);
const YEAR = 4000;
const CLOTH = new Set(["ulnage", "cloth_toll", "fulling_toll"]);

const when = (state: GameState) => ({ tick: state.tick, year: stateCalendar(state).year, population: state.population, treasury: treasuryBalance(state),
  lived: state.houses.filter(house => house.residents > 0).length, l4: state.houses.filter(house => house.level >= 4 && house.residents > 0).length });
let chapter3End: ReturnType<typeof when> | null = null;
let chapter4End: ReturnType<typeof when> | null = null;
const yearly: (ReturnType<typeof when> & { influence: Readonly<Record<string, number>>; relations: Record<string, number>; clothSold: number })[] = [];
/** Income by category through chapter 4, and by year (positive cash postings; upkeep and other costs apart). */
const income = new Map<string, number>();
const byYear = new Map<number, Map<string, number>>();
const costs = new Map<string, number>();
let seen = 0;
let last: GameState | null = null;

class Stop extends Error {}
try {
  runPhase19NaturalGrowth({ targetLots: 24, maxTicks, seed, onTick: state => {
    last = state;
    if (chapterEnd(state, CHAPTER_THREE.chapter) !== null) chapter3End ??= when(state);
    const inChapterFour = state.politics?.chapter.number === CHAPTER_FOUR.chapter;
    const entries = state.ledger?.entries ?? [];
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index]!;
      if (Number(entry.id.slice(7)) <= seen) break;
      if (!inChapterFour || entry.account !== "cash") continue;
      const year = stateCalendar(state).year;
      if (entry.amount > 0) {
        income.set(entry.category, (income.get(entry.category) ?? 0) + entry.amount);
        const row = byYear.get(year) ?? new Map<string, number>();
        row.set(entry.category, (row.get(entry.category) ?? 0) + entry.amount);
        byYear.set(year, row);
      } else costs.set(entry.category, (costs.get(entry.category) ?? 0) + entry.amount);
    }
    seen = (state.ledger?.nextEntryOrdinal ?? 1) - 1;
    const r = state.reorganisation;
    if (inChapterFour && r !== undefined && state.tick % YEAR === 0) {
      yearly.push({ ...when(state), influence: r.influence, clothSold: r.clothSold,
        relations: Object.fromEntries((state.factions?.factions ?? []).map(faction => [faction.id, faction.relation])) });
    }
    if (chapterEnd(state, CHAPTER_FOUR.chapter) !== null) { chapter4End ??= when(state); throw new Stop(); }
  // The growth run would stop at the town's stability: chapter 4 goes on to its end.
  }, additionalAcceptance: state => chapterEnd(state, CHAPTER_FOUR.chapter) !== null });
} catch (error) {
  if (!(error instanceof Stop)) throw error;
}
const final = last as GameState | null;
const end = final === null ? null : chapterEnd(final, CHAPTER_FOUR.chapter);
const r = final?.reorganisation ?? null;
const clothOf = (row: ReadonlyMap<string, number>) => [...row].filter(([category]) => CLOTH.has(category)).reduce((sum, [, amount]) => sum + amount, 0);
const table = (row: ReadonlyMap<string, number>) => {
  const cloth = clothOf(row);
  const others = [...row].filter(([category]) => !CLOTH.has(category)).sort((a, b) => b[1] - a[1]);
  const total = [...row.values()].reduce((sum, amount) => sum + amount, 0);
  return { cloth, total, clothPermille: total === 0 ? 0 : Math.round(cloth * 1000 / total), largestOther: others[0] ?? null, clothChief: others.every(([, amount]) => cloth > amount),
    categories: Object.fromEntries([...row].sort((a, b) => b[1] - a[1])) };
};
const endYear = end === null ? null : end.chronicle.toYear;
const lastFour = new Map<string, number>();
for (const [year, row] of byYear) if (endYear !== null && year >= endYear - 4 && year < endYear) for (const [category, amount] of row) lastFour.set(category, (lastFour.get(category) ?? 0) + amount);
process.stdout.write(`${JSON.stringify({ seed, maxTicks, chapter3End, chapter4End,
  reorganisation: r === null ? null : { startTick: r.startTick, steps: final === null ? [] : reorganisationForecast(final), answers: r.answers, influence: r.influence,
    guild: r.guild ?? null, pollTax: r.pollTax, collections: r.collections, rebellion: r.rebellion ?? null, pressure: final === null ? null : revoltPressure(final),
    wageLeavers: r.wageLeavers, weaverLeavers: r.weaverLeavers, clothSold: r.clothSold, clothIncome: r.clothIncome, chapterFiveStart: r.chapterFiveStart ?? null },
  income: { chapter: table(income), lastFourYears: { fromYear: endYear === null ? null : endYear - 4, ...table(lastFour) }, costs: Object.fromEntries(costs) },
  byYear: Object.fromEntries([...byYear].map(([year, row]) => [year, Object.fromEntries(row)])), yearly,
  chapterEnd: end === null ? null : { tick: end.tick, year: end.chronicle.toYear, reorganisation: end.chronicle.stats.reorganisation ?? null },
  final: final === null ? null : { ...when(final), era: final.era, outcome: final.settlement?.outcome ?? null, chapter: final.politics?.chapter.number ?? 1,
    rights: final.politics?.rights.map(right => `${right.id}:${right.holder}`) ?? [] } }, null, 1)}\n`);
