import assert from 'node:assert/strict';
import test from 'node:test';
import { ART_REGISTRY } from '../src/render/art/wave42Registry';
import { checkCatalogFiles } from '../scripts/checkArtCatalog';
import catalog from '../src/render/art/catalog.json';
import type { ArtBundle } from '../src/render/art/artContract';

const prefix = 'height-wave2-l0garden';
const bodyId = `${prefix}/house_l0_garden-body-v2`;
const context = { buildingKind: 'house', level: 0, calendarYear: 1300, lot: 'single', eligible: true,
  season: 'summer', legacyBodyUrl: 'assets/buildings/variants-wave2/house_l0_garden-v1.png' };

test('Wave2 L0 garden targets only the existing default body before 1350', () => {
  const body = ART_REGISTRY.select('building-body', 'house-body', context, 1);
  assert.equal(body?.id, bodyId); assert.ok(body?.kind === 'building-body');
  assert.deepEqual(body.geometry.pivot, { x: 77.35406698564593, y: 139.57894736842104 });
  assert.equal(body.geometry.scale, 0.49957049486461247);
  assert.deepEqual(body.geometry.footprint, { width: 1, height: 1 });
  assert.deepEqual([body.image.width, body.image.height], [153, 153]);
  for (const calendarYear of [1350, 1400]) assert.notEqual(ART_REGISTRY.select('building-body', 'house-body', { ...context, calendarYear }, 1)?.id, bodyId);
  for (const legacyBodyUrl of ['assets/wave26/house/house_l1_c.png', 'assets/buildings/historical-houses/house_l0-v2.png']) {
    assert.notEqual(ART_REGISTRY.select('building-body', 'house-body', { ...context, legacyBodyUrl }, 1)?.id, bodyId);
  }
});

for (const houseCondition of ['strained', 'neglected', 'vacant'] as const) test(`Wave2 L0 garden keeps distinct ${houseCondition} data`, () => {
  const overlay = ART_REGISTRY.select('state-overlay', 'house-condition', { bodyId, layer: 'worn', houseCondition }, 1);
  assert.equal(overlay?.id, `${prefix}/house_l0_garden-${houseCondition}-v2`);
  assert.ok(overlay?.kind === 'state-overlay'); assert.equal(overlay.order, 0);
});

test('all six approved files have matching pixels, hashes and complete-body registration', () => {
  const bundle = (catalog as unknown as readonly ArtBundle[]).find(entry => entry.bundleId === prefix);
  assert.ok(bundle); assert.equal(bundle.entries.length, 6);
  for (const row of checkCatalogFiles(process.cwd(), [bundle])) assert.deepEqual(row.errors, []);
  const body = ART_REGISTRY.entry(bodyId); assert.ok(body?.kind === 'building-body');
  for (const entry of bundle.entries) { assert.ok('geometry' in entry); assert.deepEqual(entry.geometry, body.geometry); }
  const snow = ART_REGISTRY.select('state-overlay', 'house-snow', { bodyId, layer: 'snow' }, 1);
  assert.ok(snow?.kind === 'state-overlay'); assert.equal(snow.order, 20);
});
