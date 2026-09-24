import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGrowthOpening } from '../scripts/phase21OpeningTranslation';
import { growthDensityMetrics } from '../scripts/growthStateRecordMetrics';
import { superviseGrowthRecording } from '../scripts/growthStateRecordSupervisor';

test('density denominators distinguish absent enclosure from zero occupied area', () => {
  // Given a natural opening without a proclaimed enclosure.
  const state = createGrowthOpening(1).state;
  // When recording density.
  const result = growthDensityMetrics(state);
  // Then the enclosure ratios are unknown, rather than invented zeroes.
  assert.equal(result.wallInterior, null);
  assert.equal(result.buildingsPerLot, state.buildings.length / state.houses.length);
});

test('density counts farm footprint tiles and empty land within the declared polygon', () => {
  // Given a 4x4 enclosure with a 2x2 farm and one road tile.
  const opening = createGrowthOpening(1).state;
  const tiles = Array.from({ length: 16 }, (_, index) => ({ tx: index % 4, ty: Math.floor(index / 4), terrain: 'grass' as const, hasRoad: index === 0, buildingId: null }));
  const original = opening.buildings[0];
  assert.ok(original);
  const farm = { ...original, kind: 'wheat_farm' as const, tx: 1, ty: 1 };
  const state = { ...opening, tiles, buildings: [farm], constructionSites: [], houses: [], palisade: { id: 'wall', gate: { x: 0, y: 0 }, segments: [], polygon: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }, { x: 0, y: 0 }] } };
  // When recording density.
  const result = growthDensityMetrics(state);
  // Then farm and road footprints are excluded from empty land.
  assert.equal(result.wallInterior?.tileCount, 16);
  assert.equal(result.wallInterior?.farmTiles, 4);
  assert.equal(result.wallInterior?.farmAreaRatio, 4 / 16);
  assert.equal(result.wallInterior?.emptyLandTiles, 11);
  assert.equal(result.wallInterior?.emptyLandRatio, 11 / 16);
  assert.equal(result.buildingsPerLot, null);
});

test('parent watchdog preserves the decision input even if the child never yields again', async () => {
  // Given a child which announces its input and becomes synchronously stuck.
  const directory = mkdtempSync(join(tmpdir(), 'growth-recorder-test-'));
  const worker = join(directory, 'blocked.mjs');
  writeFileSync(worker, `process.send({kind:'decision-start',tick:120,stateJson:'{"tick":120}',metricsJson:'{"lots":2}',diagnosticJson:'null'},()=>{for(;;){}});`);
  try {
    // When the independent parent wall-clock budget expires.
    const result = await superviseGrowthRecording({ worker, output: join(directory, 'record'), seed: 1, targetLots: 24, maxTicks: 1200000, wallTimeMs: 5_000, slowDecisionMs: 30 });
    // Then it kills the child and retains the exact pending decision input.
    assert.equal(result.stopReason, 'wall-time-budget');
    assert.equal(result.finalTick, 120);
    assert.equal(result.stateSemantics, 'before-pending-decision');
    assert.equal(JSON.parse(readFileSync(join(directory, 'record/final-state.json'), 'utf8')).tick, 120);
    assert.equal(result.slowDecisions.length, 1);
    assert.ok(result.slowDecisions[0]?.stack.some(frame => frame.includes('blocked.mjs')));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('recording the natural opening preserves existing driver results', async () => {
  // Given the unmodified natural-growth opening and driver, running 240 ticks.
  const { createAutoplayTraceDriver } = await import('../scripts/economyHarnessAutoplay');
  const { advanceTick } = await import('../src/engine/tick');
  const { fileURLToPath } = await import('node:url');
  let expected = createGrowthOpening(1).state;
  const driver = createAutoplayTraceDriver({ id: 'parity', source: 'test', policy: { maxHousingLots: 24 }, onDiagnostic: () => undefined });
  for (let tick = 0; tick < 240; tick += 1) expected = advanceTick(driver.apply(expected));
  const directory = mkdtempSync(join(tmpdir(), 'growth-recorder-parity-'));
  try {
    // When the independent recording worker runs the same seed without acceptance gates.
    const result = await superviseGrowthRecording({ worker: fileURLToPath(new URL('../scripts/growthStateRecordWorker.ts', import.meta.url)), output: join(directory, 'record'), seed: 1, targetLots: 24, maxTicks: 240, wallTimeMs: 20_000 });
    // Then both full states, including cache data, match exactly.
    assert.equal(result.stopReason, 'tick-budget');
    assert.deepEqual(JSON.parse(readFileSync(join(directory, 'record/final-state.json'), 'utf8')), JSON.parse(JSON.stringify(expected)));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
