import { readFileSync, writeFileSync } from 'node:fs';
import type { GameState } from '../src/engine/engine.types';
import { advanceTick } from '../src/engine/tick';
import { settlementMetrics } from '../src/engine/settlementMetrics';
import { createAutoplayTraceDriver } from './economyHarnessAutoplay';

const [input, output] = process.argv.slice(2);
if (input === undefined || output === undefined) throw new Error('Usage: <natural-state.json> <report.json>');
let state = JSON.parse(readFileSync(input, 'utf8')) as GameState;
const startTick = state.tick;
const driver = createAutoplayTraceDriver();
let minimumPopulation = state.population;
let minimumSuppliedPercent = 100;
let minimumFoodPercent = 100;
let invalidLedgerValues = 0;
let nonVictoryTicks = 0;
for (let step = 0; step < 6000; step += 1) {
  state = advanceTick(driver.apply(state));
  const metrics = settlementMetrics(state);
  minimumPopulation = Math.min(minimumPopulation, metrics.population);
  minimumSuppliedPercent = Math.min(minimumSuppliedPercent, metrics.suppliedPercent);
  minimumFoodPercent = Math.min(minimumFoodPercent, metrics.foodPercent);
  if (state.settlement?.outcome !== 'victory') nonVictoryTicks += 1;
  for (const building of state.buildings) for (const ledger of ['inventory', 'reserved', 'stockReserved'] as const) {
    invalidLedgerValues += Object.values(building[ledger]).filter(amount => amount !== undefined && (!Number.isFinite(amount) || amount < 0)).length;
  }
}
const report = { source: input, startTick, finalTick: state.tick, additionalTicks: 6000,
  minimumPopulation, minimumSuppliedPercent, minimumFoodPercent, invalidLedgerValues, nonVictoryTicks,
  finalMetrics: settlementMetrics(state), settlement: state.settlement };
writeFileSync(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
