import assert from 'node:assert/strict';
import test from 'node:test';
import { ART_REGISTRY } from '../src/render/art/wave42Registry';
import { checkCatalogFiles } from '../scripts/checkArtCatalog';
import catalog from '../src/render/art/catalog.json';
import { eligibleVariants, variantPool } from '../src/render/buildingVariants';

const prefix = 'height-wave2-l1tile';
const bodyId = `${prefix}/house_l1_tile-body-v2`;
const context = { buildingKind: 'house', level: 1, calendarYear: 1300, lot: 'single', eligible: true,
  season: 'summer', legacyBodyUrl: 'assets/buildings/variants-wave2/house_l1_tile-v1.png' };

test('Wave2 tiled L1 targets only the existing selected tile body before 1350', () => {
  const body = ART_REGISTRY.select('building-body', 'house-body', context, 1);
  assert.equal(body?.id, bodyId); assert.ok(body?.kind === 'building-body');
  assert.deepEqual(body.geometry.pivot, { x: 71.66148325358851, y: 125.92025518341308 + 24 });
  assert.equal(body.geometry.scale, 0.498621726759907);
  assert.deepEqual(body.geometry.footprint, { width: 1, height: 1 });
  assert.deepEqual([body.image.width, body.image.height], [139, 163]);
  for (const calendarYear of [1350, 1400]) assert.notEqual(ART_REGISTRY.select('building-body', 'house-body', { ...context, calendarYear }, 1)?.id, bodyId);
  for (const legacyBodyUrl of ['assets/wave26/house/house_l1_c.png', 'assets/buildings/historical-houses/house_l0-v2.png']) {
    assert.notEqual(ART_REGISTRY.select('building-body', 'house-body', { ...context, legacyBodyUrl }, 1)?.id, bodyId);
  }
});

for (const houseCondition of ['strained', 'neglected', 'vacant'] as const) test(`Wave2 tiled L1 keeps distinct ${houseCondition} data`, () => {
  const overlay = ART_REGISTRY.select('state-overlay', 'house-condition', { bodyId, layer: 'worn', houseCondition }, 1);
  assert.equal(overlay?.id, `${prefix}/house_l1_tile-${houseCondition}-v2`);
  assert.ok(overlay?.kind === 'state-overlay'); assert.equal(overlay.order, 0);
});

test('ordinary and plague boards require abandoned facts and remain distinct from conditions', () => {
  for (const plagueVacant of [false, true]) {
    const facts = { bodyId, layer: 'boarded', plagueVacant, vacant: true };
    const overlay = ART_REGISTRY.select('state-overlay', 'house-boarded', facts, 1);
    assert.equal(overlay?.id, `${prefix}/house_l1_tile-${plagueVacant ? 'plague-shut' : 'boarded'}-v2`);
    assert.ok(overlay?.kind === 'state-overlay'); assert.equal(overlay.order, 10);
    assert.equal(ART_REGISTRY.select('state-overlay', 'house-boarded', { ...facts, vacant: false }, 1), null);
  }
  assert.equal(ART_REGISTRY.select('state-overlay', 'house-condition', { bodyId, layer: 'worn', houseCondition: 'maintained' }, 1), null);
});

test('all seven approved files have matching pixels, hashes and complete-body registration', () => {
  const bundle = catalog.find(entry => entry.bundleId === prefix);
  assert.ok(bundle); assert.equal(bundle.entries.length, 7);
  for (const row of checkCatalogFiles(process.cwd(), [bundle])) assert.deepEqual(row.errors, []);
  const body = ART_REGISTRY.entry(bodyId); assert.ok(body?.kind === 'building-body');
  for (const entry of bundle.entries) { assert.ok('geometry' in entry); assert.deepEqual(entry.geometry, body.geometry); }
  const snow = ART_REGISTRY.select('state-overlay', 'house-snow', { bodyId, layer: 'snow' }, 1);
  assert.ok(snow?.kind === 'state-overlay'); assert.equal(snow.order, 20);
});

test('existing tile selector still excludes absent or unfinished enclosing walls', () => {
  const building = { kind: 'house', tx: 2, ty: 2 } as const;
  const pool = variantPool(building, 1); assert.ok(pool);
  const polygon = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 6 }, { x: 0, y: 6 }];
  const hasTile = (completed: boolean) => eligibleVariants(pool, building, { polygon, segments: [{ completed }] }).some(item => item.id === 'tile');
  assert.equal(hasTile(false), false); assert.equal(hasTile(true), true);
  assert.equal(eligibleVariants(pool, building, null).some(item => item.id === 'tile'), false);
});
