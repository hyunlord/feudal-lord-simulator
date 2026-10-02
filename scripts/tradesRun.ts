// LM-E6a gates (spec docs/design/trades.md TR-1…TR-8): a lord-mode town on one land and seed from 1300 to `lastYear`
// (LM-E1 lordModeRun), and each year its trades — households by trade, the chains' productivity and bottleneck, the
// streets, the carters' haulage and the stuck stock — plus a sample of the receipts and the butcher → tanner →
// shoemaker chain's goods.
//   tsx scripts/tradesRun.ts <archetypeId> <seed> <lastYear> [policy] > run.json
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { GameState } from "../src/engine/engine.types";
import { stateCalendar } from "../src/engine/scenarioState";
import { stuckStock } from "../src/engine/stuckStock";
import { tradeCounts, tradesOf } from "../src/engine/trades";
import type { EstatePolicy } from "../src/engine/townAgency.types";
import { tradeReceiptLine, chainLine, streetName } from "../src/content/trades.ko";
import { lordModeRun } from "./lordModeRun";

export function tradeYear(state: GameState) {
  const trades = tradesOf(state);
  const stuck = stuckStock(state).filter(entry => entry.source === "stock");
  return {
    year: stateCalendar(state).year - 1, population: state.population, households: trades.households.length,
    counts: tradeCounts(state),
    chains: Object.fromEntries(Object.entries(trades.chains).map(([chain, value]) => [chain, chainLine(chain as never, value!)])),
    chainGoods: { hides: trades.stock.hides ?? 0, leather: trades.stock.leather ?? 0, shoes: trades.stock.shoes ?? 0, meat: trades.stock.meat ?? 0 },
    streets: trades.streets.map(street => ({ name: streetName(street.tradeId), households: street.houseIds.length, namedYear: stateCalendar({ ...state, tick: street.namedTick }).year })),
    haulage: trades.haulage.last,
    stuck: { total: stuck.reduce((sum, entry) => sum + entry.amount, 0), noCarrier: stuck.filter(entry => entry.reason === "no_carrier").reduce((sum, entry) => sum + entry.amount, 0) },
  };
}

export function tradesRun(archetypeId: string, seed: number, lastYear: number, policy: EstatePolicy) {
  const years: ReturnType<typeof tradeYear>[] = [];
  let end: GameState | null = null;
  const run = lordModeRun({ archetypeId, seed, lastYear, policy, onYear: state => years.push(tradeYear(state)), onEnd: state => { end = state; } });
  const final = end as GameState | null;
  const trades = final === null ? null : tradesOf(final);
  return {
    archetypeId, seed, lastYear, policy, final: run.final, eras: run.eras, years,
    receipts: (trades?.households ?? []).map(household => ({ house: household.houseId, year: stateCalendar({ ...final!, tick: household.sinceTick }).year,
      line: tradeReceiptLine(household.tradeId, household.receipt.reasons), score: household.receipt.score, chance: `${household.receipt.chancePermille}‰ of ${household.receipt.of}`,
      productivity: household.productivityPermille, workshop: household.workshop })),
    quits: trades?.quits ?? [], elapsedSeconds: run.elapsedSeconds,
  };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [archetypeId, seed, lastYear, policy] = process.argv.slice(2);
  process.stdout.write(`${JSON.stringify(tradesRun(archetypeId!, Number(seed), Number(lastYear), (policy ?? "growth") as EstatePolicy), null, 1)}\n`);
}
