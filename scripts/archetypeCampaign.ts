// ARCH-1b comparison (spec docs/design/map-archetypes.md MA-12): the guardrail's growth bot on one land and seed, run
// through the whole campaign — to chapter 5's end (the last market day of 1450) or the calendar's 1451 — and what the
// land left: the ending, the people and the treasury, each chapter's end, the coastal raid's losses, the pestilence's dead.
//   tsx scripts/archetypeCampaign.ts <archetypeId> <seed> [lastYear=1450] > run.json
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CHAPTER_FIVE } from "../src/content/chapterConfig";
import { stateArchetype } from "../src/engine/archetype";
import type { GameState } from "../src/engine/engine.types";
import { legacyEnding, legacyScores } from "../src/engine/legacy";
import { chapterEnd } from "../src/engine/politics";
import { stateCalendar } from "../src/engine/scenarioState";
import { treasuryBalance } from "../src/ledger/ledger";
import { runPhase19NaturalGrowth } from "./phase19NaturalGrowth";

const YEAR = 4000;
const oldest = (people: readonly { readonly alive: boolean; readonly birthYear: number }[], year: number) =>
  people.reduce((top, person) => person.alive ? Math.max(top, year - person.birthYear) : top, 0);
const LAST_YEAR = 1450;

export function archetypeCampaign(archetypeId: string, seed: number, lastYear = LAST_YEAR) {
  let last: GameState | null = null;
  let peak = 0;
  const decades: { year: number; population: number; treasury: number; chapter: number; l4: number; oldest: number; oldestOutside: number }[] = [];
  // BOT-4: each year's lowest L4 count and population at its four season starts (the late-wobble gate reads 1370–1450).
  const years: { year: number; l4Min: number; populationMin: number }[] = [];
  class Stop extends Error {}
  let report: ReturnType<typeof runPhase19NaturalGrowth> | null = null;
  const started = performance.now();
  try {
    report = runPhase19NaturalGrowth({ targetLots: 24, maxTicks: (lastYear - 1300 + 1) * YEAR, seed, archetypeId, onTick: state => {
      last = state;
      peak = Math.max(peak, state.population);
      if (state.tick % (10 * YEAR) === 0) decades.push({ year: stateCalendar(state).year, population: state.population,
        treasury: treasuryBalance(state), chapter: state.politics?.chapter.number ?? 1,
        l4: state.houses.filter(house => house.level >= 4 && house.residents > 0).length,
        // FIX-11 (item 2): the oldest living person in town (and in the town's outside factions) that decade.
        oldest: oldest(state.persons?.people ?? [], stateCalendar(state).year), oldestOutside: oldest(state.factions?.people ?? [], stateCalendar(state).year) });
      if (state.tick % (YEAR / 4) === 0) {
        const year = stateCalendar(state).year;
        const l4 = state.houses.filter(house => house.level >= 4 && house.residents > 0).length;
        const entry = years.at(-1);
        if (entry?.year === year) { entry.l4Min = Math.min(entry.l4Min, l4); entry.populationMin = Math.min(entry.populationMin, state.population); }
        else years.push({ year, l4Min: l4, populationMin: state.population });
      }
      if (chapterEnd(state, CHAPTER_FIVE.chapter) !== null || stateCalendar(state).year > lastYear) throw new Stop();
      // The growth run stops at the town's stability unless this holds (as `longRun.ts`): on to the campaign's end.
    }, additionalAcceptance: state => stateCalendar(state).year > lastYear });
  } catch (error) {
    if (!(error instanceof Stop)) throw error;
  }
  const final = last as GameState | null;
  if (final === null) throw new Error("no tick ran");
  const year = (tick: number) => stateCalendar({ ...final, tick }).year;
  const raid = final.war?.raid;
  const plague = final.plague;
  const ending = legacyEnding(final);
  return {
    archetypeId, seed, coastal: stateArchetype(final)?.coastal === true,
    campaignEnded: chapterEnd(final, CHAPTER_FIVE.chapter) !== null, ending: ending?.id ?? null, scores: final.legacy === undefined ? null : legacyScores(final),
    chapterEnds: (final.politics?.chapterEnds ?? []).map(end => ({ chapter: end.chapter, year: year(end.tick) })),
    final: { year: stateCalendar(final).year, chapter: final.politics?.chapter.number ?? 1, population: final.population, peakPopulation: peak,
      treasury: treasuryBalance(final), abandoned: final.settlement?.outcome === "abandoned",
      l4: final.houses.filter(house => house.level >= 4 && house.residents > 0).length },
    raid: raid === undefined ? null : { year: year(raid.tick), defencePermille: raid.defencePermille, ...raid.losses },
    plague: plague?.first === undefined ? null : { populationAtArrival: plague.first.populationAtArrival, deathPermille: plague.first.deathPermille,
      dead: plague.first.dead, second: plague.second === undefined ? null : { deathPermille: plague.second.deathPermille, dead: plague.second.dead } },
    // FIX-11: the lord's houses, wardships and every seated lord of chapter 5 (items 1 and 5).
    lordHouses: final.lordship?.house.order ?? 1,
    records: Object.fromEntries(["lord.wardship_begun", "lord.wardship_ended", "legacy.heir_seated", "legacy.succession"].map(template =>
      [template, (final.history?.records ?? []).filter(record => record.template === template).map(record => ({ year: year(record.tick), ...record.params }))])),
    oldestEver: Math.max(0, ...[...(final.persons?.past ?? []), ...(final.factions?.people ?? [])].filter(person => !person.alive && person.deathYear !== undefined)
      .map(person => person.deathYear! - person.birthYear)),
    failures: report?.failures ?? [], decades, years, elapsedSeconds: Math.round((performance.now() - started) / 100) / 10,
  };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${JSON.stringify(archetypeCampaign(process.argv[2]!, Number(process.argv[3] ?? 1), Number(process.argv[4] ?? LAST_YEAR)), null, 1)}\n`);
}
