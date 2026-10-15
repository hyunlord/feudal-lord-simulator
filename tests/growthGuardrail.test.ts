import assert from 'node:assert/strict';
import test from 'node:test';
import { efficientAcceptance } from '../scripts/efficientGrowthAcceptance';
import { compareChronicZeroWheat, growthGuardrail, guardrailEarlyStopTick } from '../scripts/growthGuardrail';
import { runPhase19NaturalGrowth } from '../scripts/phase19NaturalGrowth';

const metrics = { lots: 24, arableCells: 96, farmsteads: 4, mills: 8, chronicZeroWheatMills: 0, chronicZeroWheatKnown: true,
  chronicZeroWheatObservedTicks: 24000, granaries: 7, markets: 2, churches: 2,
  population: 768, idleWorkers: 250, buildings: 80, warnings: 0,
  coveredTicks: 2400, fullWindow: true, known: true, rawStarvedTicks: 4000, eligibleMillTicks: 19200 };
const result = { seed: 3, stopReason: 'target-scale-stable', lots: 24, l4Houses: 24,
  serviceGaps: { water: 0, market: 0, church: 0 }, diagnosticResult: 'no_action' };

test('Given baseline-complete seed and high idle When evaluated Then idle is recorded without failing the known continuity baseline', () => {
  const verdict = growthGuardrail(result, efficientAcceptance(metrics));
  assert.equal(verdict.status, 'passed');
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

test('Given a chronic mill ratio over measured historical baseline When evaluated Then a material regression fails', () => {
  const verdict = growthGuardrail(result, efficientAcceptance({ ...metrics, mills: 10, chronicZeroWheatMills: 3 }));
  assert.equal(verdict.checks.zeroWheatRegression, false);
  assert.equal(verdict.status, 'regression');
  assert.equal(verdict.baseline.chronicZeroWheatMillRatio, 0);
  assert.equal(verdict.recorded.zeroWheatMillRatio, 0.3);
});

test('Given unmeasured continuity When evaluated Then the ratio remains unknown', () => {
  const verdict = growthGuardrail(result, efficientAcceptance({ ...metrics, chronicZeroWheatKnown: false }));
  assert.equal(verdict.checks.zeroWheatRegression, null);
  assert.equal(verdict.recorded.zeroWheatMillRatio, null);
  assert.equal(verdict.status, 'indeterminate');
});

test('Given comparable chronic mill ratios When compared Then only material worsening fails', () => {
  assert.equal(compareChronicZeroWheat(0.2, 0), 'pass');
  assert.equal(compareChronicZeroWheat(0.3, 0), 'regression');
  assert.equal(compareChronicZeroWheat(0, null), 'indeterminate');
});

test('Given excessive facilities or warning markers When evaluated Then hard caps remain fail-closed', () => {
  const verdict = growthGuardrail(result, efficientAcceptance({ ...metrics, mills: 21, granaries: 8, warnings: 8 }));
  assert.equal(verdict.checks.efficiency, false);
});

// RR22 (user approval 2026-10-15): a seed that has not won by twice its baseline victory tick (or the baseline's plus
// 200,000, the later) stops early and is a regression; a seed that has won runs to its end.
test('Given the pinned baselines When the early stop is set Then it is the later of twice the victory tick and the victory tick plus 200,000', () => {
  assert.equal(guardrailEarlyStopTick(4), 543_776);   // victory 271,888: twice it
  assert.equal(guardrailEarlyStopTick(2), 926_814);   // victory 463,407: twice it
  assert.equal(guardrailEarlyStopTick(9), null);      // no pinned baseline: the run keeps its budget
});

test('Given a seed stopped early unwon When evaluated Then it is a regression; one that won is not', () => {
  const early = growthGuardrail({ ...result, stopReason: 'unreached-early-stop' }, efficientAcceptance(metrics));
  assert.equal(early.checks.reached, false);
  assert.equal(early.status, 'regression');
  assert.equal(growthGuardrail(result, efficientAcceptance(metrics)).checks.reached, true);
});

test('Given a run with no victory by stopUnwonAt When run Then it stops there as unreached-early-stop; without it the budget ends it', () => {
  const stopped = runPhase19NaturalGrowth({ targetLots: 24, maxTicks: 400, seed: 1, stopUnwonAt: 150 });
  assert.equal(stopped.stopReason, 'unreached-early-stop');
  assert.equal(stopped.earlyStopTick, stopped.final.tick);
  assert.ok(stopped.final.tick >= 150 && stopped.final.tick < 400 + 150);
  const budget = runPhase19NaturalGrowth({ targetLots: 24, maxTicks: 150, seed: 1 });
  assert.equal(budget.stopReason, 'tick-budget');
  assert.equal(budget.earlyStopTick, null);
});
