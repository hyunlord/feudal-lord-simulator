import baseline from '../seeds/baseline-7db9df85.json';
import type { efficientAcceptance } from './efficientGrowthAcceptance';

const ZERO_WHEAT_MATERIAL_DELTA = 0.2;

export type GuardrailObservation = Readonly<{
  seed: number;
  stopReason: string;
  lots: number;
  l4Houses: number;
  serviceGaps: Readonly<{ water: number; market: number; church: number }>;
  diagnosticResult: string | null;
}>;

const seedBaselines = [undefined, baseline.seeds['1'], baseline.seeds['2'], baseline.seeds['3'],
  baseline.seeds['4'], baseline.seeds['5']] as const;

export function growthGuardrail(observation: GuardrailObservation, efficiency: ReturnType<typeof efficientAcceptance>) {
  const reference = seedBaselines[observation.seed];
  if (reference === undefined) throw new RangeError(`No pinned growth baseline for seed ${observation.seed}`);
  const newServiceGap = (['water', 'market', 'church'] as const).some(service =>
    observation.serviceGaps[service] > reference.serviceOutside[service]);
  const belowBaselineL4 = observation.lots < reference.lots || observation.l4Houses < reference.l4Houses;
  const checks = {
    efficiency: efficiency.passed,
    baselineL4: !belowBaselineL4,
    serviceGap: !newServiceGap,
    newDeadlock: !(observation.stopReason === 'tick-budget' && observation.diagnosticResult === 'no_action' &&
      (belowBaselineL4 || newServiceGap)),
    zeroWheatRegression: efficiency.zeroWheatMillRatio !== null &&
      efficiency.zeroWheatMillRatio <= reference.zeroWheatMillRatio + ZERO_WHEAT_MATERIAL_DELTA,
  };
  return {
    passed: Object.values(checks).every(Boolean),
    checks,
    baseline: { sourceCommit: baseline.sourceCommit, seed: observation.seed, tick: reference.tick,
      l4Houses: reference.l4Houses, serviceOutside: reference.serviceOutside,
      zeroWheatMillRatio: reference.zeroWheatMillRatio },
    recorded: { rawStarvationRatio: efficiency.rawStarvationRatio,
      zeroWheatMillRatio: efficiency.zeroWheatMillRatio, idleWorkerRatio: efficiency.idleRatio },
    zeroWheatMaterialDelta: ZERO_WHEAT_MATERIAL_DELTA,
  };
}
