import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { loadSaveFile } from '../scripts/loadSaveFile';
import { groundBoundaryScene } from '../src/render/groundBoundaryScene';
import { createYardHurdleItems } from '../src/render/yardHurdleItems';
import { hurdleAssetKey } from '../src/render/hurdleArt';
import { compareObjectRenderItems } from '../src/render/objectRenderMerge';
import { ART_REGISTRY, selectLandArt } from '../src/render/art/wave42Registry';

const state = loadSaveFile('tests/fixtures/distributor-entry-seed5.json.gz');
const prepared = { ...state, houses: state.houses.map(house => house.residents === 0
  ? { ...house, abandonedTick: state.tick } : house) };
const scene = groundBoundaryScene(state);

test('unavailable art preserves every old panel and its transform exactly', () => {
  const items = createYardHurdleItems(() => false)(prepared, scene);
  const legacy = scene.yardProps.hurdles.map(piece => ({ kind: 'zone_prop' as const, id: piece.id,
    depth: piece.depth, anchorTx: Math.round(piece.anchor.x), prop: { kind: hurdleAssetKey(piece),
      x: piece.anchor.x, y: piece.anchor.y, flip: piece.mirror, scale: 1, id: piece.id, depth: piece.depth } })).sort(compareObjectRenderItems);
  assert.deepEqual(items, legacy);
});

test('two-season readiness swaps atomically and resettlement restores on unchanged geometry', () => {
  const decoded = new Set<string>();
  const queue = createYardHurdleItems(keys => keys.every(key => decoded.has(key)));
  const summer = selectLandArt('yard-fence', { family: 'yard-fence', stage: 'collapsed', season: 'summer' }).id;
  const winter = selectLandArt('yard-fence', { family: 'yard-fence', stage: 'collapsed', season: 'winter' }).id;
  const legacy = queue(prepared, scene);
  assert.equal(legacy.filter(item => item.kind === 'land_stage').length, 0);
  decoded.add(summer);
  assert.strictEqual(queue(prepared, scene), legacy);
  decoded.add(winter);
  const swapped = queue(prepared, scene);
  assert.equal(swapped.length, legacy.length);
  assert.strictEqual(queue(prepared, scene), swapped);
  const broken = swapped.filter(item => item.kind === 'land_stage');
  assert.equal(broken.length, 2);
  for (const item of broken) {
    assert.equal(swapped.some(other => other.id === item.id.replace('collapsed:', '')), false);
    assert.equal(item.depth, item.piece.tx + item.piece.ty);
    assert.deepEqual(item.piece.editions, { summer, winter });
  }
  assert.strictEqual(groundBoundaryScene(prepared), scene);
  assert.deepEqual(queue(state, scene), legacy);
  const occupied = { ...prepared, houses: prepared.houses.map(house => ({ ...house, residents: 1 })) };
  assert.deepEqual(queue(occupied, scene), legacy);
  assert.deepEqual(queue({ ...prepared, tick: state.tick - 1 }, scene), legacy);
  assert.deepEqual(queue(prepared, { ...scene, yardProps: { ...scene.yardProps, hurdles: [] } }), []);
  decoded.delete(winter);
  assert.deepEqual(queue(prepared, scene), legacy);
});

test('both contracts keep authored source SHA, pivot, uniform .25 scale and no flip', () => {
  for (const season of ['summer', 'winter']) {
    const entry = selectLandArt('yard-fence', { family: 'yard-fence', stage: 'collapsed', season });
    assert.equal(ART_REGISTRY.entry(entry.id), entry);
    assert.deepEqual(entry.geometry, { pivot: { x: 64, y: 120 }, scale: 0.25,
      footprint: { width: 0.5, height: 0.5 }, allowMirror: false });
    assert.equal(entry.image.width, 128);
    assert.equal(entry.image.height, 160);
    const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
    assert.equal(hash(entry.provenance.inboxFile), entry.provenance.sourceSha256);
    assert.equal(hash(`public/${entry.image.url}`), entry.provenance.runtimeSha256);
  }
});
