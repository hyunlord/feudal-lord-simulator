// FIX-8 gate (decision FX8-1): the guardrail's growth run of one seed, not stopped at the town's stability but carried
// on through the chapters to a year (default 1450), recording each year the lived and L4 houses, the bread and malt
// in the granaries, the malt in the storehouses and kilns, and the chapter — does the town keep its 24 L4 houses?
//   tsx scripts/longRun.ts <seed> [toYear] > seed.json
import type { GameState } from "../src/engine/engine.types";
import { stateCalendar } from "../src/engine/scenarioState";
import { treasuryBalance } from "../src/ledger/ledger";
import { runPhase19NaturalGrowth } from "./phase19NaturalGrowth";

const seed = Number(process.argv[2]);
const toYear = Number(process.argv[3] ?? 1450);
const YEAR = 4000;
const held = (state: GameState, kind: string, resource: "bread" | "wheat" | "malt") =>
  state.buildings.filter(building => building.kind === kind).reduce((sum, building) => sum + (building.inventory[resource] ?? 0), 0);
const when = (state: GameState) => ({ tick: state.tick, year: stateCalendar(state).year, chapter: state.politics?.chapter.number ?? 1,
  population: state.population, treasury: treasuryBalance(state), lived: state.houses.filter(house => house.residents > 0).length,
  l4: state.houses.filter(house => house.level >= 4 && house.residents > 0).length,
  granaries: state.buildings.filter(building => building.kind === "granary").length,
  bread: held(state, "granary", "bread"), wheat: held(state, "granary", "wheat"),
  malt: { granary: held(state, "granary", "malt"), storehouse: held(state, "storehouse", "malt"), kiln: held(state, "malt_kiln", "malt") },
  sites: state.constructionSites?.length ?? 0 });

const yearly: ReturnType<typeof when>[] = [];
let last: GameState | null = null;
class Stop extends Error {}
try {
  runPhase19NaturalGrowth({ targetLots: 24, maxTicks: (toYear - 1300) * YEAR + YEAR, seed, onTick: state => {
    last = state;
    if (state.tick % YEAR === 0) yearly.push(when(state));
    if (stateCalendar(state).year >= toYear) throw new Stop();
  }, additionalAcceptance: state => stateCalendar(state).year >= toYear });
} catch (error) {
  if (!(error instanceof Stop)) throw error;
}
const final = last as GameState | null;
const after = (year: number) => yearly.filter(row => row.year >= year);
const minL4 = (rows: readonly ReturnType<typeof when>[]) => rows.reduce((low, row) => Math.min(low, row.l4), Number.POSITIVE_INFINITY);
const firstFull = yearly.find(row => row.l4 >= 24)?.year ?? null;
process.stdout.write(`${JSON.stringify({ seed, toYear, final: final === null ? null : when(final), firstFull24: firstFull,
  minL4AfterFirstFull: firstFull === null ? null : minL4(after(firstFull)), minL4From1400: minL4(after(1400)),
  maxGranaryMalt: yearly.reduce((high, row) => Math.max(high, row.malt.granary), 0), yearly }, null, 1)}\n`);
