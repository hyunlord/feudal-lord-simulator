// FIX-2 evidence (spec docs/design/flow-chapter-one.md FC-2a): the famine card's relief prediction and the history
// ledger's actual two seasons on, on full ticks, for three towns — no income with a granary of bread, no income with the
// fixture's own granary, and last season's income 1,200 (C3). Then the relief's ledger lines and a world hash without the
// ledger and history after 3,000 ticks, to compare with the code before FC-2a.
//   tsx scripts/reliefCostRun.ts > relief-cases.json
import { createHash } from "node:crypto";
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
const town = (income: number, bread: number | null): GameState => ({ ...arrived, seasons: { ...arrived.seasons!, history: [lastSeason(income)] },
  buildings: bread === null ? arrived.buildings : arrived.buildings.map(building => building.kind === "granary" ? { ...building, inventory: { ...building.inventory, bread } } : building) });
const reliefLines = (state: GameState) => (state.ledger?.entries ?? []).filter(entry => entry.category === "famine_relief")
  .map(entry => ({ tick: entry.tick, account: entry.account, amount: entry.amount, detail: entry.sourceRefs[1]?.detail }));

const cases = ([["income 0, granary bread 3,000", town(0, 3_000)], ["income 0, the fixture's granary (bread 7)", town(0, null)],
  ["income 1,200 (C3), the fixture's granary", town(1_200, null)]] as const).map(([name, state]) => {
  const card = famineDecisionView(state)!.options.find(option => option.choice === "relief")!.predicted;
  let run = gameReducer(state, { type: "famine_response", choice: "relief" });
  const id = run.history!.records.find(entry => entry.template === "decision.famine_response")!.id;
  for (let tick = 0; tick < 2_000; tick += 1) run = advanceTick(run);
  const decision = run.history!.records.find(entry => entry.id === id)!.decision!;
  return { case: name, treasuryAtAnswer: state.treasuryCoin, card, predicted: decision.predicted.treasury, actual: decision.actual?.treasury ?? null,
    treasuryAtDue: run.treasuryCoin, reliefEntries: reliefLines(run) };
});

// The simulation is the same: 3,000 ticks of relief with 60 bread in the granary.
let state = gameReducer(town(0, 60), { type: "famine_response", choice: "relief" });
for (let tick = 0; tick < 3_000; tick += 1) state = advanceTick(state);
const { ledger, history: _history, pathCache: _cache, ...world } = state;
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
const simulation = { tick: state.tick, world: hash(world), cash: hash((ledger?.entries ?? []).filter(entry => entry.account === "cash").map(({ id: _id, ...entry }) => entry)),
  rollups: hash(ledger?.rollups), treasury: state.treasuryCoin, reliefEntries: reliefLines(state) };

process.stdout.write(`${JSON.stringify({ cases, simulation }, null, 1)}\n`);
