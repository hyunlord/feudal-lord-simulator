import assert from 'node:assert/strict';
import test from 'node:test';
import { efficientAcceptance } from '../scripts/efficientGrowthAcceptance';
import { growthGuardrail } from '../scripts/growthGuardrail';

const metrics = { lots: 24, farms: 20, mills: 8, zeroWheatMills: 0, granaries: 7, markets: 2, churches: 2,
  population: 768, idleWorkers: 250, buildings: 80, warnings: 0,
  coveredTicks: 2400, fullWindow: true, known: true, rawStarvedTicks: 4000, eligibleMillTicks: 19200 };
const result = { seed: 3, stopReason: 'target-scale-stable', lots: 24, l4Houses: 24,
  serviceGaps: { water: 0, market: 0, church: 0 }, diagnosticResult: 'no_action' };

test('Given baseline-complete seed and high idle When evaluated Then idle is recorded without failing the guardrail', () => {
  const verdict = growthGuardrail(result, efficientAcceptance(metrics));
  assert.equal(verdict.passed, true);
  assert.equal(verdict.recorded.idleWorkerRatio, 250 / 768);
});

test('Given seed 3 with permanent church gap and no action When evaluated Then gap and deadlock fail', () => {
  const verdict = growthGuardrail({ ...result, stopReason: 'tick-budget', l4Houses: 13,
    serviceGaps: { water: 0, market: 0, church: 11 } }, efficientAcceptance(metrics));
  assert.equal(verdict.checks.serviceGap, false);
  assert.equal(verdict.checks.newDeadlock, false);
  assert.equal(verdict.checks.baselineL4, false);
});

test('Given a 21 percent increase in zero-wheat mills When evaluated Then baseline-relative regression fails', () => {
  const verdict = growthGuardrail(result, efficientAcceptance({ ...metrics, mills: 10, zeroWheatMills: 3 }));
  assert.equal(verdict.checks.zeroWheatRegression, false);
});

test('Given exactly 20 percentage points more zero-wheat mills When evaluated Then materiality threshold does not fail', () => {
  const verdict = growthGuardrail(result, efficientAcceptance({ ...metrics, mills: 10, zeroWheatMills: 2 }));
  assert.equal(verdict.checks.zeroWheatRegression, true);
});

test('Given excessive facilities or warning markers When evaluated Then hard caps remain fail-closed', () => {
  const verdict = growthGuardrail(result, efficientAcceptance({ ...metrics, mills: 21, granaries: 8, warnings: 8 }));
  assert.equal(verdict.checks.efficiency, false);
});
