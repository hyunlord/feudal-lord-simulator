import { writeFileSync } from 'node:fs';
import { DEFAULT_GAME_STATE } from '../src/state/gameStore';
import { advanceTick } from '../src/engine/tick';
import { createAutoplayTraceDriver } from './economyHarnessAutoplay';
import { evaluateEraRequirements } from '../src/engine/era';

const startedAt = Date.now();
const driver = createAutoplayTraceDriver();
let state = structuredClone(DEFAULT_GAME_STATE);
const requestedTicks = Number(process.argv[2] ?? 1200000);
const checkpoint = process.argv[3];
const summaryPath = process.argv[4];
let minimumPopulationAfterGrace = Number.POSITIVE_INFINITY;
let peakPopulation = state.population;
let victoryTick: number | null = null;
let stopReason = "tick_ceiling";
let minimumFedPercentAfterGrace = 100;
const transitions = [{ tick: state.tick, era: state.era }];
const rejectedActions: { tick: number; action: unknown }[] = [];
const invalidStocks: { tick: number; building: string; ledger: string; amount: number }[] = [];
for (let step = 0; step < requestedTicks; step += 1) {
  const previousActionCount = driver.appliedActions.length;
  const advised = driver.apply(state);
  if (driver.appliedActions.length > previousActionCount && advised === state) {
    rejectedActions.push({ tick: state.tick, action: driver.appliedActions.at(-1)?.advisorAction });
    stopReason = "advisor_action_rejected";
    break;
  }
  state = advanceTick(advised);
  peakPopulation = Math.max(peakPopulation, state.population);
  if (state.tick > 6000) {
    minimumPopulationAfterGrace = Math.min(minimumPopulationAfterGrace, state.population);
    const occupied = state.houses.filter(house => house.residents > 0);
    const fed = occupied.filter(house => house.breadStock > 0).length;
    minimumFedPercentAfterGrace = Math.min(minimumFedPercentAfterGrace, occupied.length === 0 ? 0 : fed / occupied.length * 100);
  }
  if (state.era !== transitions.at(-1)?.era) transitions.push({ tick: state.tick, era: state.era });
  for (const building of state.buildings) for (const ledger of ['inventory', 'reserved', 'stockReserved'] as const) {
    for (const amount of Object.values(building[ledger])) if (amount !== undefined && (!Number.isFinite(amount) || amount < 0)) {
      if (invalidStocks.length < 20) invalidStocks.push({ tick: state.tick, building: building.id, ledger, amount });
    }
  }
  if (state.tick % 6000 === 0 && checkpoint) writeFileSync(checkpoint, JSON.stringify(state));
  if (state.tick % 3000 === 0) console.log(JSON.stringify({ tick: state.tick, population: state.population, era: state.era, idle: state.idleWorkers, requirements: evaluateEraRequirements(state), buildings: state.buildings.map(building => ({ kind: building.kind, workers: building.workers, inventory: building.inventory, tx: building.tx, ty: building.ty })), sites: state.constructionSites, action: driver.appliedActions.at(-1), houses: state.houses, settlement: state.settlement }));
  if (state.settlement?.outcome === 'victory' && victoryTick === null) victoryTick = state.tick;
  if (state.settlement?.outcome === 'abandoned') { stopReason = 'abandoned'; break; }
  if (victoryTick !== null && state.tick >= victoryTick + 6000) { stopReason = 'victory_followed_by_6000_ticks'; break; }
}
if (checkpoint) writeFileSync(checkpoint, JSON.stringify(state));
const summary = {
  source: 'DEFAULT_GAME_STATE; real advanceTick and gameReducer; optional advisor at120tick decision cadence; no resource, population, era or milestone injection',
  stopReason, victoryTick, rejectedActions,
  elapsedSeconds: (Date.now() - startedAt) / 1000,
  requestedTicks, finalTick: state.tick, population: state.population, peakPopulation,
  checkedLedgers: ["building.inventory", "building.reserved", "building.stockReserved"],
  minimumPopulationAfterGrace: Number.isFinite(minimumPopulationAfterGrace) ? minimumPopulationAfterGrace : null,
  minimumFedPercentAfterGrace, transitions, invalidStocks,
  completedWalls: state.palisade?.segments.filter(segment => segment.completed).length ?? 0,
  wallCount: state.palisade?.segments.length ?? 0,
  settlement: state.settlement, requirements: evaluateEraRequirements(state),
  actions: driver.appliedActions,
};
if (summaryPath) writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ summary }));
