// LM-E6a gate (spec docs/design/trades.md TR-7): more carters, less stuck stock. A lord-mode town (lordModeRun) to the
// start of `fromYear`, then the same town played on for `years` years with the carter households held at 0, 2, 4, 8
// and 12; every stuck-stock check (100 ticks) samples the stuck stock by reason, the haulage and the spoiled field
// wheat. Holding the number: before each check the variant's carters are set again (the first trade households in
// house order become carters; others that took up carting become millers, a trade that takes no game goods).
//   tsx scripts/tradesHaulageCompare.ts <archetypeId> <seed> <fromYear> <years> > compare.json
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { GameState } from "../src/engine/engine.types";
import { stuckStock } from "../src/engine/stuckStock";
import { advanceTick } from "../src/engine/tick";
import { tradesOf } from "../src/engine/trades";
import type { TradeHousehold } from "../src/engine/trades.types";
import { lordModeRun } from "./lordModeRun";

function withCarters(state: GameState, count: number): GameState {
  // The first `count` trade households in house order become carters (the others keep their trades). The trade layer
  // takes no game goods, so turning a shoemaker into a carter changes nothing but the haulage.
  const trades = tradesOf(state);
  const ordered = [...trades.households].sort((left, right) => left.houseId.localeCompare(right.houseId));
  const households: TradeHousehold[] = ordered.map((household, index) => index < count ? { ...household, tradeId: "carter", workshop: "big_yard" }
    : household.tradeId === "carter" ? { ...household, tradeId: "miller", workshop: "water_mill" } : household);
  return { ...state, trades: { ...trades, households } };
}

export function haulageCompare(archetypeId: string, seed: number, fromYear: number, years: number) {
  let start: GameState | null = null;
  lordModeRun({ archetypeId, seed, lastYear: fromYear - 1, policy: "growth", onEnd: state => { start = state; } });
  const base = start as GameState | null;
  if (base === null) throw new Error("no state");
  const variants = [0, 2, 4, 8, 12].map(carters => {
    let state = withCarters(base, carters);
    let samples = 0, stuckTotal = 0, noCarrier = 0, receiverFull = 0, moved = 0, held = 0, lost = 0;
    let lastLost = state.harvestRecord?.lost ?? 0;
    for (let tick = 0; tick < years * 4_000; tick += 1) {
      if ((state.tick + 1) % 100 === 0) state = withCarters(state, carters);
      const before = tradesOf(state).haulage;
      state = advanceTick(state);
      const after = tradesOf(state).haulage;
      // A season start moves the season's haulage to `last` (the start's own haul included).
      moved += after.season >= before.season ? after.season - before.season : after.last - before.season;
      // The field wheat a full barn could not take and winter spoiled (BOT-4 harvest record), counted as it grows.
      const lostNow = state.harvestRecord?.lost ?? 0;
      if (lostNow > lastLost) lost += lostNow - lastLost;
      lastLost = lostNow;
      if (state.tick % 100 === 0) {
        const stuck = stuckStock(state).filter(entry => entry.source === "stock");
        samples += 1;
        stuckTotal += stuck.reduce((sum, entry) => sum + entry.amount, 0);
        noCarrier += stuck.filter(entry => entry.reason === "no_carrier").reduce((sum, entry) => sum + entry.amount, 0);
        receiverFull += stuck.filter(entry => entry.reason === "receiver_full").reduce((sum, entry) => sum + entry.amount, 0);
        held = tradesOf(state).households.filter(household => household.tradeId === "carter").length;
      }
    }
    return { carters, heldAtLastCheck: held, samples, meanStuck: Math.round(stuckTotal / samples), meanNoCarrier: Math.round(noCarrier / samples),
      meanReceiverFull: Math.round(receiverFull / samples), hauled: moved, fieldWheatLost: lost, population: state.population };
  });
  return { archetypeId, seed, fromYear, years, population: base.population, houses: base.houses.length, variants };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [archetypeId, seed, fromYear, years] = process.argv.slice(2);
  process.stdout.write(`${JSON.stringify(haulageCompare(archetypeId!, Number(seed), Number(fromYear), Number(years ?? 4)), null, 1)}\n`);
}
