import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import catalog from '../src/render/art/catalog.json';
import metadata from '../assets-inbox/wave13/candidates-v1/records/metadata-herds.json';
import { createArtRegistry } from '../src/render/art/artRegistry';
import { createFarmPropArt } from '../src/render/farmPropArt';
import { WAVE13_ANIMAL_SCALE } from '../src/render/animalScale';

const specs = [
  { file: 'sheep_cluster_moving_b-v1', base: 'sheep_flock_b', members: 5 },
  { file: 'cattle_drove-v1', base: 'cattle_pair', members: 3 },
  { file: 'pig_cluster-v1', base: 'pig_pair', members: 4 },
] as const;
for (const spec of specs) test(`Given ${spec.file} When existing ${spec.base} is selected Then all four authored static crops use native geometry and common scale`, () => {
  // Given
  const registry = createArtRegistry(catalog);
  const art = createFarmPropArt(registry, { createImage: null, baseUrl: '/' });
  const record = metadata.find(entry => entry.id === `herd/${spec.file}`); assert.ok(record);
  assert.equal(record.qa.memberCount, spec.members); assert.equal(record.qa.staticCluster, true); assert.equal(record.qa.animation, false);
  // When
  const selected = Array.from({ length: 32 }, (_, i) => art.select({ kind: spec.base, x: 4, y: 4, id: `farm-prop:pasture:${i}` }));
  // Then
  const entries = [...new Map(selected.map(entry => { assert.ok(entry); return [entry.id, entry]; })).values()];
  assert.equal(entries.length, 4);
  const [width, height] = record.cell; assert.ok(width && height);
  const [pivotX, pivotY] = record.pivot; assert.ok(pivotX && pivotY);
  for (const entry of entries) {
    const crop = entry.geometry.crop; assert.ok(crop);
    assert.equal(crop.x % width, 0); assert.equal(crop.y, 0); assert.equal(crop.width, width); assert.equal(crop.height, height);
    assert.deepEqual(entry.geometry.pivot, { x: crop.x + pivotX, y: pivotY });
    assert.equal(entry.geometry.scale, WAVE13_ANIMAL_SCALE); assert.equal(entry.geometry.allowMirror, false);
    assert.equal(entry.staticCluster, true); assert.equal(entry.animation, false);
    const source = readFileSync(entry.provenance.inboxFile); const runtime = readFileSync(`public/${entry.image.url}`);
    assert.deepEqual(runtime, source);
    assert.equal(createHash('sha256').update(runtime).digest('hex'), entry.provenance.runtimeSha256);
  }
});
