// C4 gate (spec docs/design/ale-chain.md AL-8): runs the bot from a seed's growth opening through chapter 2 and records
// when the ale chain comes together — a barn on barley, the malt kiln, the first malt, the first brewed ale, the first
// alehouse, the first ale drunk — with the town's level-2+ houses and its prosperity (victory) tick.
//   tsx scripts/aleChainRun.ts <seed> <maxTicks> > seed.json
import type { GameState } from "../src/engine/engine.types";
import { alehouses, brewingSlot } from "../src/engine/ale";
import { stateCalendar } from "../src/engine/scenarioState";
import { runPhase19NaturalGrowth } from "./phase19NaturalGrowth";

const [seedArg, maxArg] = process.argv.slice(2);
const seed = Number(seedArg);
const maxTicks = Number(maxArg ?? 200_000);
const first: Record<string, number | null> = { chapter2: null, barleyBarn: null, kiln: null, malt: null, ale: null, alehouse: null, aleDrunk: null };
const trace: { tick: number; year: number; barley: number; malt: number; brewing: number; ale: number; alehouses: number; l2plus: number; l4: number; population: number }[] = [];
let last: GameState | null = null;
const mark = (key: string, tick: number) => { first[key] ??= tick; };

runPhase19NaturalGrowth({ targetLots: 24, maxTicks, seed, onTick: state => {
  last = state;
  if (state.tick % 50 !== 0) return;
  if ((state.politics?.chapter.number ?? 1) >= 2) mark("chapter2", state.tick);
  if (state.buildings.some(building => building.crop === "barley")) mark("barleyBarn", state.tick);
  if (state.buildings.some(building => building.kind === "malt_kiln")) mark("kiln", state.tick);
  const stock = (resource: "barley" | "malt") => state.buildings.reduce((sum, building) => sum + (building.inventory[resource] ?? 0), 0);
  if (stock("malt") > 0) mark("malt", state.tick);
  const ale = state.houses.reduce((sum, house) => sum + (brewingSlot(house)?.stock.ale ?? 0), 0);
  if (ale > 0) mark("ale", state.tick);
  if (alehouses(state).length > 0) mark("alehouse", state.tick);
  if ((state.ledger?.entries ?? []).some(entry => entry.category === "stall_fee" && entry.sourceRefs.some(ref => String(ref.detail ?? "").startsWith("alehouse:")))) mark("aleDrunk", state.tick);
  if (state.tick % 4000 === 0) {
    trace.push({ tick: state.tick, year: stateCalendar(state).year, barley: stock("barley"), malt: stock("malt"),
      brewing: state.houses.filter(house => brewingSlot(house) !== null).length, ale, alehouses: alehouses(state).length,
      l2plus: state.houses.filter(house => house.level >= 2).length, l4: state.houses.filter(house => house.level === 4).length, population: state.population });
  }
} });
const final = last as GameState | null;
process.stdout.write(`${JSON.stringify({ seed, maxTicks, first, complete: first.aleDrunk !== null,
  victoryTick: final?.settlement?.milestones.prosperity ?? null, final: final === null ? null : { tick: final.tick, year: stateCalendar(final).year,
    population: final.population, l4: final.houses.filter(house => house.level === 4).length, chapter: final.politics?.chapter.number ?? 1 }, trace }, null, 1)}\n`);
