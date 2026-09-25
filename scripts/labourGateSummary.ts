// C3 gates ③ and ④ from efficientGrowthRun output folders: idle labour, raw shortage and bread ratio over the
// stable interval (complete 2,400-tick windows that start at or after the final stableSince, as in C1c-2 A8).
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { GameState } from '../src/engine/engine.types';
import { availableWorkers } from '../src/population/labour';

type Row = Record<string, number | null>;

export function labourGateSummary(directory: string) {
  const summary = JSON.parse(readFileSync(resolve(directory, 'summary.json'), 'utf8'));
  const rows: Row[] = readFileSync(resolve(directory, 'food-periods.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
  const stableSince: number | null = summary.strict?.stableSince ?? null;
  const windows = stableSince === null ? [] : rows.filter(row => (row.tick ?? 0) - 2400 >= stableSince);
  const total = (key: string) => windows.reduce((sum, row) => sum + (row[key] ?? 0), 0);
  const ratio = (top: number, bottom: number) => bottom > 0 ? Number((top / bottom).toFixed(4)) : null;
  const idleAtWindowEnds = windows.filter(row => (row.population ?? 0) > 0)
    .map(row => (row.labourIdle ?? row.idleWorkers ?? 0) / (row.population ?? 1));
  const final = summary.final ?? {};
  // L1: in the final state the households' adults add up to the old labour pool and adults + children to population.
  const finalPath = resolve(directory, 'final-state.json');
  const state: GameState | null = existsSync(finalPath) ? JSON.parse(readFileSync(finalPath, 'utf8')) : null;
  const households = state === null ? null : {
    adults: state.houses.reduce((sum, house) => sum + (house.members?.adults ?? 0), 0),
    children: state.houses.reduce((sum, house) => sum + (house.members?.children ?? 0), 0),
    population: state.population, labourPool: availableWorkers(state.population),
  };
  // Bread and wheat held at the end of the run (granaries, mills, barns, homes): the reserve the town carries.
  const reserve = state === null ? null : {
    bread: state.buildings.reduce((sum, building) => sum + (building.inventory.bread ?? 0), 0)
      + state.houses.reduce((sum, house) => sum + house.breadStock, 0),
    wheat: state.buildings.reduce((sum, building) => sum + (building.inventory.wheat ?? 0), 0),
  };
  return {
    reserve,
    householdsMatch: households === null ? null
      : households.adults === households.labourPool && households.adults + households.children === households.population,
    households,
    seed: summary.seed, guardrail: summary.guardrail?.passed ?? null, victoryTick: summary.victoryTick,
    stopReason: summary.stopReason, stableSince, stableWindows: windows.length,
    stableBreadRatio: ratio(total('breadProduced'), total('requestedBread')),
    // LB-13 (user decision LB8): meal fulfilment replaces production/request as the margin measure.
    stableMealFulfilment: ratio(total('consumedBread'), total('requestedBread')),
    stableStoredWheatMean: windows.length === 0 ? null : Math.round(total('storedWheat') / windows.length),
    stableRawStarvationRatio: ratio(total('rawStarvedTicks'), total('eligibleMillTicks')),
    stableIdleRatioMean: summary.stableLabour?.meanIdleRatio ?? (idleAtWindowEnds.length > 0
      ? Number((idleAtWindowEnds.reduce((sum, value) => sum + value, 0) / idleAtWindowEnds.length).toFixed(4)) : null),
    stableIdleRatioRange: summary.stableLabour === undefined ? null : [summary.stableLabour.minIdleRatio, summary.stableLabour.maxIdleRatio],
    meanFieldHands: summary.stableLabour?.meanFieldHands ?? null, meanHauling: summary.stableLabour?.meanHauling ?? null,
    mills: windows.at(-1)?.mills ?? null, granaries: windows.at(-1)?.granaries ?? null, farmsteads: windows.at(-1)?.farmsteads ?? null,
    arableCells: windows.at(-1)?.arableCells ?? null, population: final.population ?? windows.at(-1)?.population ?? null,
    elapsedSeconds: summary.elapsedSeconds,
  };
}

if (process.argv[1] !== undefined && process.argv[1].endsWith('labourGateSummary.ts')) {
  for (const directory of process.argv.slice(2)) process.stdout.write(`${JSON.stringify(labourGateSummary(directory))}\n`);
}
