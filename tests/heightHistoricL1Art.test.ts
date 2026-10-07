import assert from 'node:assert/strict';
import test from 'node:test';
import { ART_REGISTRY } from '../src/render/art/wave42Registry';
import { checkCatalogFiles } from '../scripts/checkArtCatalog';
import catalog from '../src/render/art/catalog.json';
import type { ArtBundle } from '../src/render/art/artContract';

const prefix = 'height-historic-l1';
const bodyId = `${prefix}/house_l1-historic-body-v3`;
const context = { buildingKind: 'house', level: 1, calendarYear: 1300, lot: 'single', eligible: true,
  season: 'summer', legacyBodyUrl: 'assets/buildings/historical-houses/house_l1-v2.png' };

test('historic L1 targets only the existing default body before 1350', () => {
  const body = ART_REGISTRY.select('building-body', 'house-body', context, 1);
  assert.equal(body?.id, bodyId); assert.ok(body?.kind === 'building-body');
  assert.deepEqual(body.geometry.pivot, { x: 71.66148325358851, y: 125.92025518341308 + 36 });
  assert.equal(body.geometry.scale, 0.4986217267599071);
  assert.deepEqual(body.geometry.footprint, { width: 1, height: 1 });
  assert.deepEqual([body.image.width, body.image.height], [139, 175]);
  for (const calendarYear of [1350, 1400]) assert.notEqual(ART_REGISTRY.select('building-body', 'house-body', { ...context, calendarYear }, 1)?.id, bodyId);
  for (const legacyBodyUrl of ['assets/wave26/house/house_l1_c.png', 'assets/buildings/historical-houses/house_l0-v3.png']) {
    assert.notEqual(ART_REGISTRY.select('building-body', 'house-body', { ...context, legacyBodyUrl }, 1)?.id, bodyId);
  }
});

for (const houseCondition of ['strained', 'neglected', 'vacant'] as const) test(`historic L1 keeps distinct ${houseCondition} data`, () => {
  const overlay = ART_REGISTRY.select('state-overlay', 'house-condition', { bodyId, layer: 'worn', houseCondition }, 1);
  assert.equal(overlay?.id, `${prefix}/house_l1-historic-${houseCondition}-v3`);
  assert.ok(overlay?.kind === 'state-overlay'); assert.equal(overlay.order, 0);
});

test('ordinary and plague boards require abandoned facts and remain distinct from conditions', () => {
  for (const plagueVacant of [false, true]) {
    const facts = { bodyId, layer: 'boarded', plagueVacant, vacant: true };
    const overlay = ART_REGISTRY.select('state-overlay', 'house-boarded', facts, 1);
    assert.equal(overlay?.id, `${prefix}/house_l1-historic-${plagueVacant ? 'plague-shut' : 'boarded'}-v3`);
    assert.ok(overlay?.kind === 'state-overlay'); assert.equal(overlay.order, 10);
    assert.equal(ART_REGISTRY.select('state-overlay', 'house-boarded', { ...facts, vacant: false }, 1), null);
  }
  assert.equal(ART_REGISTRY.select('state-overlay', 'house-condition', { bodyId, layer: 'worn', houseCondition: 'maintained' }, 1), null);
});

test('all seven approved files have matching pixels, hashes and complete-body registration', () => {
  const bundle = (catalog as unknown as readonly ArtBundle[]).find(entry => entry.bundleId === prefix);
  assert.ok(bundle); assert.equal(bundle.entries.length, 7);
  for (const row of checkCatalogFiles(process.cwd(), [bundle])) assert.deepEqual(row.errors, []);
  const body = ART_REGISTRY.entry(bodyId); assert.ok(body?.kind === 'building-body');
  for (const entry of bundle.entries) { assert.ok('geometry' in entry); assert.deepEqual(entry.geometry, body.geometry); }
  const snow = ART_REGISTRY.select('state-overlay', 'house-snow', { bodyId, layer: 'snow' }, 1);
  assert.ok(snow?.kind === 'state-overlay'); assert.equal(snow.order, 20);
});
