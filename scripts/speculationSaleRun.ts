// FIX-3 evidence (spec docs/design/flow-chapter-one.md FC-2b): the famine card's speculation prediction and the history
// ledger's actual two seasons on, on full ticks, for three towns — no income with 400 bread and 200 wheat in the granary,
// the same with last season's income 1,200, and no income with an empty granary. Runs the same on the code before FC-2b.
//   tsx scripts/speculationSaleRun.ts > speculation-cases.json
import { readFileSync } from "node:fs";
import type { GameState } from "../src/engine/engine.types";
import { advanceEvents } from "../src/engine/events";
import { advanceSeasons } from "../src/engine/seasonPressure";
import { advanceTick } from "../src/engine/tick";
import { postLedgerEntries } from "../src/ledger/ledger";
import { decodeSave } from "../src/save/saveCodec";
import { gameReducer } from "../src/state/gameStore";
import { famineDecisionView } from "../src/ui/decisionModels";

// The chapter tests' ready town (tests/flowChapterOne.test.ts readyTown): the 176-person town, a market, 5,000 in rent.
const saved = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v13/population-176.save.json"))).envelope.state as GameState;
const { seasons: _seasons, events: _events, politics: _politics, historicalEras: _eras, ...rest } = saved;
const bare = rest as GameState;
const market = { id: "market-test", kind: "market" as const, tx: 2, ty: 2, workers: 3, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
const posted = postLedgerEntries(bare, [{ account: "cash", category: "rent", amount: 5_000, sourceRefs: [{ type: "building", id: bare.houses[0]!.buildingId }] }]);
const ready: GameState = { ...bare, treasuryCoin: posted.treasuryCoin, ledger: posted.ledger, buildings: [...bare.buildings, market] };
// The Great Famine arrives in spring 1315.
const arrived = advanceEvents(advanceSeasons({ ...ready, tick: 60_000 }));
const lastSeason = (income: number) => ({ season: 3 as const, year: 1314, startTick: 59_000, endTick: 60_000, income, expense: 0,
  stockDelta: { bread: 0, wheat: 0, timber: 0, stone: 0 }, popDelta: 0, notableEvents: [], nextObjectiveHint: null });
const town = (income: number, bread: number, wheat: number): GameState => ({ ...arrived, seasons: { ...arrived.seasons!, history: [lastSeason(income)] },
  buildings: arrived.buildings.map(building => building.kind === "granary" ? { ...building, inventory: { ...building.inventory, bread, wheat } } : building) });

const cases = ([["income 0, granary bread 400 · wheat 200", town(0, 400, 200)], ["income 1,200, granary bread 400 · wheat 200", town(1_200, 400, 200)],
  ["income 0, empty granary", town(0, 0, 0)]] as const).map(([name, state]) => {
  const card = famineDecisionView(state)!.options.find(option => option.choice === "speculation")!.predicted;
  let run = gameReducer(state, { type: "famine_response", choice: "speculation" });
  const id = run.history!.records.find(entry => entry.template === "decision.famine_response")!.id;
  for (let tick = 0; tick < 2_000; tick += 1) run = advanceTick(run);
  const decision = run.history!.records.find(entry => entry.id === id)!.decision!;
  return { case: name, treasuryAtAnswer: state.treasuryCoin, card, predicted: decision.predicted.treasury, actual: decision.actual?.treasury ?? null,
    treasuryAtDue: run.treasuryCoin, saleEntries: (run.ledger?.entries ?? []).filter(entry => entry.category === "famine_sale")
      .map(entry => ({ tick: entry.tick, amount: entry.amount, detail: entry.sourceRefs[1]?.detail })) };
});

process.stdout.write(`${JSON.stringify({ cases }, null, 1)}\n`);
