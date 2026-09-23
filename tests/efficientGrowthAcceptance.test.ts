import assert from 'node:assert/strict';
import test from 'node:test';
import { efficientAcceptance } from '../scripts/efficientGrowthAcceptance';

const metrics = { lots: 24, farms: 10, mills: 10, chronicZeroWheatMills: 1, chronicZeroWheatKnown: true,
  chronicZeroWheatObservedTicks: 2400, granaries: 7, markets: 2, churches: 2,
  population: 100, idleWorkers: 5, buildings: 100, warnings: 9,
  coveredTicks: 2400, fullWindow: true, known: true, rawStarvedTicks: 199, eligibleMillTicks: 1000 };

test('Given facility counts at their caps When evaluating efficiency Then the counts qualify', () => {
  assert.equal(efficientAcceptance(metrics).passed, true);
});
for (const [name, changed] of [
  ['ten percent warnings', { warnings: 10 }],
  ['incomplete observation', { coveredTicks: 2399, fullWindow: false }],
  ['unknown observation', { known: false }],
  ['empty eligibility denominator', { eligibleMillTicks: 0 }],
  ['extra mill', { mills: 11 }], ['extra granary', { granaries: 8 }],
  ['extra market', { markets: 3 }], ['extra church', { churches: 3 }],
] as const) test(`efficiency fails ${name}`, () => {
  assert.equal(efficientAcceptance({ ...metrics, ...changed }).passed, false);
});
test('Given high idle, wheat starvation, and empty mills When evaluating efficiency Then they remain recorded diagnostics', () => {
  const result = efficientAcceptance({ ...metrics, idleWorkers: 40, rawStarvedTicks: 300, chronicZeroWheatMills: 3 });
  assert.equal(result.passed, true);
  assert.equal(result.idleRatio, 0.4);
  assert.equal(result.rawStarvationRatio, 0.3);
  assert.equal(result.zeroWheatMillRatio, 0.3);
});

test('Given no per-mill continuity history When evaluated Then zero-wheat ratio is unknown instead of an instant snapshot', () => {
  const result = efficientAcceptance({ ...metrics, chronicZeroWheatKnown: false, chronicZeroWheatMills: 0 });
  assert.equal(result.zeroWheatMillRatio, null);
  assert.equal(result.passed, true);
});

test('missing capture cannot pass', async () => {
  const { captureAcceptance } = await import('../scripts/efficientGrowthAcceptance');
  assert.equal(captureAcceptance(null).passed, false);
});
test('capture fails exact ten percent visible warnings and asset failures', async () => {
  const { captureAcceptance } = await import('../scripts/efficientGrowthAcceptance');
  const capture = { filename: 'final.jpg', jpegSha256: 'a'.repeat(64), stateSha256: 'b'.repeat(64),
    captured: true, width: 1600, height: 1100, dpr: 1, zoom: 0.9, assetsLoaded: true, buildings: 10, warnings: 0 };
  assert.equal(captureAcceptance(capture).passed, true);
  assert.equal(captureAcceptance({ ...capture, warnings: 1 }).passed, false);
  assert.equal(captureAcceptance({ ...capture, assetsLoaded: false }).passed, false);
});

test('v14 seed3-sized excess facilities cannot qualify despite otherwise healthy metrics', () => {
  const result = efficientAcceptance({ ...metrics, farms: 23, mills: 60, chronicZeroWheatMills: 34, granaries: 11, markets: 8, churches: 6 });
  assert.equal(result.passed, false);
  assert.deepEqual([result.checks.mills, result.checks.granaries, result.checks.markets, result.checks.churches], [false, false, false, false]);
});

test('opt-in efficiency leaves a short legacy simulation state unchanged', async () => {
  const { runPhase19NaturalGrowth } = await import('../scripts/phase19NaturalGrowth');
  let original = '';
  let guarded = '';
  const legacy = runPhase19NaturalGrowth({ targetLots: 24, maxTicks: 2, seed: 1,
    onState: (label, state) => { if (label === 'final') original = JSON.stringify(state); } });
  const efficient = runPhase19NaturalGrowth({ targetLots: 24, maxTicks: 2, seed: 1, additionalAcceptance: () => false,
    onState: (label, state) => { if (label === 'final') guarded = JSON.stringify(state); } });
  assert.equal(original, guarded);
  assert.equal('additionalAcceptance' in legacy.acceptance, false);
  assert.equal(efficient.acceptance.additionalAcceptance, false);
});

test('Given a two-tick natural run When observing completed ticks Then the hook receives consecutive states', async () => {
  const { runPhase19NaturalGrowth } = await import('../scripts/phase19NaturalGrowth');
  const observed: number[] = [];
  runPhase19NaturalGrowth({ targetLots: 24, maxTicks: 2, seed: 1,
    onTick: state => { observed.push(state.tick); } });
  assert.deepEqual(observed, [1, 2]);
});

test('finalization rejects JPEG dimensions that disagree with capture metadata', async () => {
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { createHash } = await import('node:crypto');
  const { finalizeEfficientGrowth } = await import('../scripts/efficientGrowthFinalize');
  const directory = mkdtempSync(join(tmpdir(), 'efficient-capture-dimensions-'));
  try {
    const raw = JSON.stringify({ tick: 1, seed: 1 });
    const jpeg = Buffer.from([255, 216, 255, 192, 0, 8, 8, 0, 100, 0, 100, 3, 255, 217]);
    writeFileSync(join(directory, 'final-state.json'), raw);
    writeFileSync(join(directory, 'summary.json'), JSON.stringify({ simulationPassed: true, finalStateSha256: createHash('sha256').update(raw).digest('hex') }));
    const capturePath = join(directory, 'capture-result.json');
    writeFileSync(capturePath, JSON.stringify({ tick: 1, seed: 1, stateSha256: createHash('sha256').update(raw).digest('hex'),
      jpeg: `data:image/jpeg;base64,${jpeg.toString('base64')}`, width: 1600, height: 1100 }));
    assert.throws(() => finalizeEfficientGrowth(directory, capturePath), /dimensions disagree/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('finalization rejects a simulation summary belonging to another final state', async () => {
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { createHash } = await import('node:crypto');
  const { finalizeEfficientGrowth } = await import('../scripts/efficientGrowthFinalize');
  const directory = mkdtempSync(join(tmpdir(), 'efficient-capture-state-'));
  try {
    const raw = JSON.stringify({ tick: 1, seed: 1 });
    writeFileSync(join(directory, 'final-state.json'), raw);
    writeFileSync(join(directory, 'summary.json'), JSON.stringify({ simulationPassed: true, finalStateSha256: '0'.repeat(64) }));
    const capturePath = join(directory, 'capture-result.json');
    writeFileSync(capturePath, JSON.stringify({ tick: 1, seed: 1, stateSha256: createHash('sha256').update(raw).digest('hex'), jpeg: '' }));
    assert.throws(() => finalizeEfficientGrowth(directory, capturePath), /Simulation summary does not match/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
