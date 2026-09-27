// F2-A gate (spec docs/design/chapter-two-war.md WR-10): runs the bot from a seed's growth opening through chapter 2
// and records the war — the answers, the men away, the raid (with what the same raid would have taken from the same
// town without a ring and behind a finished stone one), the wall or the market, chapter 2's end. Stops at chapter 3.
//   tsx scripts/chapterTwoRun.ts <seed> <maxTicks> [--wall-choice=wall|market] > seed.json
import { CHAPTER_TWO } from "../src/content/chapterConfig";
import { WAR_BALANCE } from "../src/content/warConfig";
import type { GameState } from "../src/engine/engine.types";
import { lordshipOf } from "../src/engine/lordshipState";
import { evaluateEraRequirements } from "../src/engine/era";
import { chapterEnd } from "../src/engine/politics";
import { stateCalendar } from "../src/engine/scenarioState";
import { raidLosses, raidSeasonOffset, ringDefencePermille } from "../src/engine/war";
import { treasuryBalance } from "../src/ledger/ledger";
import { runPhase19NaturalGrowth } from "./phase19NaturalGrowth";

const [seedArg, maxArg] = process.argv.slice(2);
const seed = Number(seedArg);
const maxTicks = Number(maxArg ?? 200_000);
const wallArg = process.argv.find(arg => arg.startsWith("--wall-choice="))?.split("=")[1];
const wallChoice = wallArg === "wall" || wallArg === "market" ? wallArg : undefined;

const when = (state: GameState) => ({ tick: state.tick, year: stateCalendar(state).year, population: state.population, treasury: treasuryBalance(state) });
let chapter2: ReturnType<typeof when> | null = null;
let messenger: ReturnType<typeof when> | null = null;
let beforeRaid: { readonly tick: number; readonly defencePermille: number;
  readonly counterfactual: Readonly<Record<"none" | "timber" | "stone", { burntHouses: number; looted: number; coin: number }>> } | null = null;
let stoneProclaimed: number | null = null;
let houseChanged = false;
/** FIX-5: every 4,000 ticks of chapter 2, the stone project's unmet conditions and the wall's stone segments. */
const stoneTrace: { tick: number; era: string; unmet: string[]; quarries: number; masonries: number; stoneSegments: number; segments: number }[] = [];
let last: GameState | null = null;

class Stop extends Error {}
try {
  runPhase19NaturalGrowth({ targetLots: 24, maxTicks, seed, ...(wallChoice === undefined ? {} : { wallChoice }), onTick: state => {
    last = state;
    if ((state.politics?.chapter.number ?? 1) >= CHAPTER_TWO.chapter) chapter2 ??= when(state);
    if (state.war !== undefined) messenger ??= when(state);
    if (state.era === "stone_town") stoneProclaimed ??= state.tick;
    if (chapter2 !== null && state.tick % 4000 === 0) {
      const segments = state.palisade?.segments ?? [];
      stoneTrace.push({ tick: state.tick, era: state.era, unmet: state.era === "palisade" ? evaluateEraRequirements(state).filter(entry => !entry.met).map(entry => `${entry.key}:${entry.current}/${entry.target}`) : [],
        quarries: state.buildings.filter(building => building.kind === "quarry").length, masonries: state.buildings.filter(building => building.kind === "masonry").length,
        stoneSegments: segments.filter(segment => segment.completed && segment.material === "stone" && segment.replacementConstructionSiteId == null).length, segments: segments.length });
    }
    if (lordshipOf(state).house.order > 1) houseChanged = true;
    // The tick before the raid: the rule's losses for this town with no ring, a timber one and a finished stone one.
    const war = state.war;
    if (war !== undefined && war.raid === undefined && state.tick === war.messengerTick + raidSeasonOffset(state) * 1000 - 1) {
      const pick = (defence: number) => { const losses = raidLosses(state, defence); return { burntHouses: losses.burntHouses, looted: losses.looted, coin: losses.coin }; };
      beforeRaid = { tick: state.tick, defencePermille: ringDefencePermille(state),
        counterfactual: { none: pick(0), timber: pick(WAR_BALANCE.timberDefencePermille), stone: pick(WAR_BALANCE.stoneDefencePermille) } };
    }
    if (chapterEnd(state, CHAPTER_TWO.chapter) !== null) throw new Stop();
  } });
} catch (error) {
  if (!(error instanceof Stop)) throw error;
}
const final = last as GameState | null;
const end = final === null ? null : chapterEnd(final, CHAPTER_TWO.chapter);
process.stdout.write(`${JSON.stringify({ seed, wallChoice: wallChoice ?? "bot", maxTicks, chapter2, messenger, beforeRaid,
  war: final?.war ?? null, stoneProclaimed, houseChanged, stoneTrace,
  chapterEnd: end === null ? null : { tick: end.tick, year: end.chronicle.toYear, war: end.chronicle.stats.war ?? null, populationEnd: end.chronicle.stats.populationEnd },
  final: final === null ? null : { ...when(final), era: final.era, houses: final.houses.length, burnt: final.houses.filter(house => house.burntTick !== undefined).length,
    outcome: final.settlement?.outcome ?? null, chapter: final.politics?.chapter.number ?? 1 } }, null, 1)}\n`);
