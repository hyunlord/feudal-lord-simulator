import assert from 'node:assert/strict';
import test from 'node:test';
import { ART_REGISTRY } from '../src/render/art/wave42Registry';

for (const variant of ['c', 'e', 'f'] as const) {
  const bodyId = `height-doors2/house_l1_${variant}-v2`;
  const context = { buildingKind: 'house', level: 1, calendarYear: 1300, lot: 'single', eligible: true,
    season: 'summer', legacyBodyUrl: `assets/wave26/house/house_l1_${variant}.png` };
  test(`L1 ${variant} keeps its legacy selection and ground registration through the shared contract`, () => {
    const selected = ART_REGISTRY.select('building-body', 'house-body', context, 1);
    assert.equal(selected?.id, bodyId);
    assert.ok(selected?.kind === 'building-body');
    assert.equal(selected.geometry.pivot.x, 71.66148325358851);
    assert.ok(Math.abs(selected.geometry.pivot.y - 125.92025518341308 - (selected.image.height - 139)) < 1e-10,
      'top padding must move the pivot by the same amount, preserving world ground');
    assert.equal(selected.geometry.scale, 0.4986217267599071);
    assert.equal(selected.image.width, 139);
    assert.ok(selected.image.height >= 139);
    assert.ok(selected.roofRidge, 'the selected raised roof registers its attachment point');
    assert.notEqual(ART_REGISTRY.select('building-body', 'house-body', { ...context, calendarYear: 1380 }, 1)?.id, bodyId);
    assert.notEqual(ART_REGISTRY.select('building-body', 'house-body', { ...context, legacyBodyUrl: 'assets/wave26/house/house_l1_d.png' }, 1)?.id, bodyId);
  });
  for (const layer of ['fresh', 'weathered', 'boarded', 'snow'] as const) {
    test(`L1 ${variant} ${layer} belongs to its exact body and inherits the registered frame`, () => {
      const selected = ART_REGISTRY.select('state-overlay', `house-${layer}`, { ...context, bodyId, layer }, 1);
      assert.ok(selected?.kind === 'state-overlay');
      assert.deepEqual(selected.targetBodyIds, [bodyId]);
      assert.equal(selected.layer, layer);
      assert.equal(selected.transform, 'inherit-body');
      const body = ART_REGISTRY.select('building-body', 'house-body', context, 1);
      assert.ok(body?.kind === 'building-body');
      assert.deepEqual(selected.geometry, body.geometry);
      assert.deepEqual([selected.image.width, selected.image.height], [body.image.width, body.image.height]);
      assert.equal(selected.geometry.scale, 0.4986217267599071);
    });
  }
}
