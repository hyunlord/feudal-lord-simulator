import baseline from '../seeds/baseline-7db9df85.json';
import type { efficientAcceptance } from './efficientGrowthAcceptance';

const ZERO_WHEAT_MATERIAL_DELTA = 0.2;

export function compareChronicZeroWheat(current: number | null, baselineRatio: number | null) {
  if (current === null || baselineRatio === null) return 'indeterminate' as const;
  return current <= baselineRatio + ZERO_WHEAT_MATERIAL_DELTA ? 'pass' as const : 'regression' as const;
}

export type GuardrailObservation = Readonly<{
  seed: number;
  stopReason: string;
  lots: number;
  l4Houses: number;
  serviceGaps: Readonly<{ water: number; market: number; church: number }>;
  diagnosticResult: string | null;
}>;

type BaselineSeed = Omit<typeof baseline.seeds['1'], 'chronicZeroWheatMillRatio'> & {
  readonly chronicZeroWheatMillRatio: number | null;
};
const seedBaselines: readonly (BaselineSeed | undefined)[] = [undefined, baseline.seeds['1'], baseline.seeds['2'], baseline.seeds['3'],
  baseline.seeds['4'], baseline.seeds['5']];

export function growthGuardrail(observation: GuardrailObservation, efficiency: ReturnType<typeof efficientAcceptance>) {
  const reference = seedBaselines[observation.seed];
  if (reference === undefined) throw new RangeError(`No pinned growth baseline for seed ${observation.seed}`);
  const newServiceGap = (['water', 'market', 'church'] as const).some(service =>
    observation.serviceGaps[service] > reference.serviceOutside[service]);
  const belowBaselineL4 = observation.lots < reference.lots || observation.l4Houses < reference.l4Houses;
  const millComparison = compareChronicZeroWheat(efficiency.zeroWheatMillRatio, reference.chronicZeroWheatMillRatio);
  const checks = {
    efficiency: efficiency.passed,
    baselineL4: !belowBaselineL4,
    serviceGap: !newServiceGap,
    newDeadlock: !(observation.stopReason === 'tick-budget' && observation.diagnosticResult === 'no_action' &&
      (belowBaselineL4 || newServiceGap)),
    zeroWheatRegression: millComparison === 'indeterminate' ? null : millComparison === 'pass',
  };
  const hardRegression = Object.entries(checks).some(([key, passed]) => key !== 'zeroWheatRegression' && passed === false);
  const status = hardRegression || millComparison === 'regression' ? 'regression'
    : millComparison === 'indeterminate' ? 'indeterminate' : 'passed';
  return {
    passed: status === 'passed', status,
    checks,
    baseline: { sourceCommit: baseline.sourceCommit, seed: observation.seed, tick: reference.tick,
      l4Houses: reference.l4Houses, serviceOutside: reference.serviceOutside,
      chronicZeroWheatMillRatio: reference.chronicZeroWheatMillRatio,
      legacyFinalInstantZeroWheatMillRatio: reference.legacyFinalInstantZeroWheatMillRatio },
    recorded: { rawStarvationRatio: efficiency.rawStarvationRatio,
      zeroWheatMillRatio: efficiency.zeroWheatMillRatio, idleWorkerRatio: efficiency.idleRatio },
    zeroWheatMaterialDelta: ZERO_WHEAT_MATERIAL_DELTA,
    zeroWheatDefinition: 'A final mill had zero wheat for at least 2400 consecutive completed ticks in the uninterrupted stability interval',
  };
}
