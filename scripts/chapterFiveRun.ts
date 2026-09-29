// F5-A gate (spec docs/design/chapter-five-legacy.md LG-10): runs the bot from a seed's growth opening through chapters
// 1–4 into chapter 5 and on to the last market day of 1450 — the chapters' end ticks, chapter 5's steps, the four
// answers, the heir, the mayor, the scores and the ending, the chronicle book's size, and the town each year (lived and
// L4 houses, the granaries' bread and malt). Stops at chapter 5's end (or `maxTicks`).
//   tsx scripts/chapterFiveRun.ts <seed> [maxTicks] > seed.json
import { CHAPTER_FIVE } from "../src/content/chapterConfig";
import { campaignChronicle, campaignChronicleText } from "../src/engine/campaignChronicle";
import type { GameState } from "../src/engine/engine.types";
import { heirCandidates, legacyEnding, legacyForecast } from "../src/engine/legacy";
import { chapterEnd } from "../src/engine/politics";
import { stateCalendar } from "../src/engine/scenarioState";
import { treasuryBalance } from "../src/ledger/ledger";
import { runPhase19NaturalGrowth } from "./phase19NaturalGrowth";

const seed = Number(process.argv[2]);
const maxTicks = Number(process.argv[3] ?? 620_000);
const YEAR = 4000;
const held = (state: GameState, kind: string, resource: "bread" | "malt") =>
  state.buildings.filter(building => building.kind === kind).reduce((sum, building) => sum + (building.inventory[resource] ?? 0), 0);
const when = (state: GameState) => ({ tick: state.tick, year: stateCalendar(state).year, chapter: state.politics?.chapter.number ?? 1, population: state.population,
  treasury: treasuryBalance(state), lived: state.houses.filter(house => house.residents > 0).length, l4: state.houses.filter(house => house.level >= 4 && house.residents > 0).length,
  bread: held(state, "granary", "bread"), granaryMalt: held(state, "granary", "malt") });

const yearly: ReturnType<typeof when>[] = [];
let last: GameState | null = null;
let heirs: unknown = null;
class Stop extends Error {}
try {
  runPhase19NaturalGrowth({ targetLots: 24, maxTicks, seed, onTick: state => {
    last = state;
    if (state.tick % YEAR === 0) yearly.push(when(state));
    if (heirs === null && (state.legacy?.candidates.length ?? 0) > 0) heirs = heirCandidates(state).map(({ kind, relation, name, age, created }) => ({ kind, relation, name, age, created }));
    if (chapterEnd(state, CHAPTER_FIVE.chapter) !== null) throw new Stop();
  }, additionalAcceptance: state => chapterEnd(state, CHAPTER_FIVE.chapter) !== null });
} catch (error) {
  if (!(error instanceof Stop)) throw error;
}
const final = last as GameState | null;
if (final === null) throw new Error("no state");
const l = final.legacy ?? null;
const book = campaignChronicle(final);
process.stdout.write(`${JSON.stringify({ seed, maxTicks,
  chapterEnds: (final.politics?.chapterEnds ?? []).map(end => ({ chapter: end.chapter, tick: end.tick, year: end.chronicle.toYear })),
  legacy: l === null ? null : { startTick: l.startTick, steps: legacyForecast(final), answers: l.answers, heirs, heir: l.heir ?? null, mayorId: l.mayorId ?? null,
    royalSubsidy: l.royalSubsidy, backlash: l.backlash, feeFarm: l.feeFarm, family: l.family ?? null, legacy: l.legacy ?? null, endowment: l.endowment, clothSold: l.clothSold,
    scores: l.scores ?? null, ending: legacyEnding(final) },
  outcome: final.settlement?.outcome ?? null,
  book: { chapters: book.chapters.map(chapter => ({ chapter: chapter.chapter, events: chapter.events.length, decisions: chapter.decisions.length })),
    family: book.family.people.length, heads: book.family.people.filter(person => person.head).length, factions: book.factions.map(faction => faction.entries.length),
    textLines: campaignChronicleText(final).split("\n").length },
  final: when(final), yearly }, null, 1)}\n`);
