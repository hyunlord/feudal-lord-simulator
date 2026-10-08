import assert from 'node:assert/strict';
import test from 'node:test';
import { ART_REGISTRY } from '../src/render/art/wave42Registry';

const bodyId = 'height-l0c/house_l0_c-v2';
const context = { buildingKind: 'house', level: 0, calendarYear: 1300, lot: 'single', eligible: true,
  season: 'summer', legacyBodyUrl: 'assets/wave26/house/house_l0_c.png' };
test('L0 c replacement follows only its existing legacy pick before the era boundary', () => {
  const body = ART_REGISTRY.select('building-body', 'house-body', context, 1);
  assert.equal(body?.id, bodyId);
  assert.ok(body?.kind === 'building-body');
  assert.deepEqual(body.geometry.pivot, { x: 77.35406698564593, y: 139.57894736842104 });
  assert.equal(body.geometry.scale, 0.49957049486461247);
  assert.deepEqual([body.image.width, body.image.height], [153, 153]);
  assert.deepEqual(body.geometry.footprint, { width: 1, height: 1 });
  for (const calendarYear of [1350, 1400]) {
    assert.notEqual(ART_REGISTRY.select('building-body', 'house-body', { ...context, calendarYear }, 1)?.id, bodyId);
  }
  for (const legacyBodyUrl of ['assets/wave26/house/house_l0_d.png', 'assets/buildings/historical-houses/house_l0-v3.png']) {
    assert.notEqual(ART_REGISTRY.select('building-body', 'house-body', { ...context, legacyBodyUrl }, 1)?.id, bodyId);
  }
});
for (const layer of ['fresh', 'weathered', 'boarded', 'snow'] as const) {
  test(`L0 c ${layer} stays bound to its own complete registered body`, () => {
    const body = ART_REGISTRY.entry(bodyId);
    const overlay = ART_REGISTRY.select('state-overlay', `house-${layer}`, { ...context, bodyId, layer }, 1);
    assert.ok(body?.kind === 'building-body');
    assert.ok(overlay?.kind === 'state-overlay');
    assert.deepEqual(overlay.targetBodyIds, [bodyId]);
    assert.deepEqual(overlay.geometry, body.geometry);
    assert.equal(overlay.transform, 'inherit-body');
    assert.deepEqual([overlay.image.width, overlay.image.height], [153, 153]);
    assert.notEqual(ART_REGISTRY.select('state-overlay', `house-${layer}`, { ...context, bodyId: 'height-final/house_l0-v4', layer }, 1)?.id, overlay.id);
  });
}
