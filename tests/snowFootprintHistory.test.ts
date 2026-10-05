import assert from 'node:assert/strict';
import test from 'node:test';
import { createSnowFootprintHistory } from '../src/render/snowFootprintHistory';
import { c25BoardState } from '../scripts/c25Board';
import type { Walker } from '../src/agents/walker.types';
const initial = c25BoardState();
const tiles = initial.tiles.map(tile => ({ ...tile, hasRoad: true, buildingId: null, terrain: 'grass' as const }));
const base = { ...initial, tiles, tick: 3500 };
function walker(tx: number, ty = 2): Walker {
  return { id: 'observed', kind: 'builder', homeBuildingId: 'home', siteId: 'site', slotIndex: 0, position: { tx, ty }, path: [], pathIndex: 0, previousTile: null, cargo: null, spawnedTick: 3400 };
}
test('a complete strip appears only behind a sufficiently long observed supported path, never from future route', () => {
  const history = createSnowFootprintHistory();
  assert.deepEqual(history.observe(base, [walker(2)]), []);
  for (let i = 1; i <= 10; i++) assert.deepEqual(history.observe({ ...base, tick: base.tick + i }, [walker(2 + i * 0.1)]), []);
  const prints = history.observe({ ...base, tick: 3512 }, [walker(3.2)]);
  // A skipped observation resets instead of interpolating an unobserved path.
  assert.deepEqual(prints, []);
  for (let i = 13; i < 30; i++) history.observe({ ...base, tick: 3500 + i }, [walker(3.2 + (i - 12) * 0.1)]);
  assert.ok(history.counts().prints > 0);
});
test('pause, reload, rewind, teleport and unsupported directions do not fabricate tracks', () => {
  const history = createSnowFootprintHistory(); history.observe(base, [walker(2)]);
  for (let i = 1; i <= 20; i++) history.observe({ ...base, tick: 3500 + i }, [walker(2 + i * 0.1)]);
  assert.ok(history.counts().prints > 0);
  const reloaded = { ...base, tick: 3520, tiles: [...tiles] };
  assert.deepEqual(history.observe(reloaded, [walker(4)]), []);
  assert.deepEqual(history.observe(reloaded, [walker(4)]), []);
  assert.deepEqual(history.observe({ ...base, tick: 3400 }, [walker(4)]), []);
  history.observe(base, [walker(2)]);
  for (let i = 1; i <= 20; i++) history.observe({ ...base, tick: 3500 + i }, [walker(2, 2 + i * 0.1)]);
  assert.equal(history.counts().prints, 0);
  assert.deepEqual(history.observe({ ...base, tick: 3521 }, [walker(20)]), []);
});
test('observation state remains bounded and never reads a planned path', () => {
  const history = createSnowFootprintHistory();
  for (let i = 0; i < 150; i++) history.observe({ ...base, tick: 3500 + i }, Array.from({ length: 200 }, (_, j) => ({ ...walker(2 + (i % 30) * 0.1), id: `walker-${j}`, path: [{ tx: 99, ty: 99 }] })));
  const counts = history.counts();
  assert.ok(counts.walkers <= 64); assert.ok(counts.samples <= 64 * 24); assert.ok(counts.prints <= 128);
});
