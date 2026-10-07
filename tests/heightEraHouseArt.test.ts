import assert from 'node:assert/strict';
import test from 'node:test';
import catalog from '../src/render/art/catalog.json';
import { ART_REGISTRY } from '../src/render/art/wave42Registry';

const era = catalog.find(bundle => bundle.bundleId === 'wave20-era');
assert.ok(era);
for (const year of [1350, 1400] as const) {
  for (const level of [0, 1] as const) {
    test(`era ${year} L${level} retains its selection IDs, weights, and year boundary`, () => {
      const rule = era.rules.find(candidate => candidate.id === `wave20/rule/body-l${level}-${year}`);
      assert.ok(rule);
      assert.equal(rule.priority, 100);
      assert.deepEqual(rule.variants, ['a', 'b'].map(variant => ({ assetId: `wave20/house_l${level}_${year}_${variant}-v1`, weight: 1 })));
      assert.ok(rule.conditions.some(condition => condition.field === 'calendarYear' && condition.op === 'range' && 'min' in condition && condition.min === year));
      const context = { buildingKind: 'house', level, calendarYear: year, lot: 'single', eligible: true, season: 'summer' };
      for (const seed of [0, 1, 17, 101, 4096]) {
        const selected = ART_REGISTRY.select('building-body', 'house-body', context, seed);
        assert.ok(selected?.kind === 'building-body');
        assert.ok(selected.id.startsWith(`wave20/house_l${level}_${year}_`));
        assert.ok(!ART_REGISTRY.select('building-body', 'house-body', { ...context, calendarYear: year - 1 }, seed)?.id.startsWith(`wave20/house_l${level}_${year}_`));
        if (level === 0) {
          assert.equal(selected.image.url, `assets/wave20/houses/${selected.id.split('/')[1]}.png`);
          assert.deepEqual(selected.geometry.pivot, { x: 77.35406698564593, y: 139.57894736842104 });
          assert.equal(selected.image.height, 153);
        }
      }
    });
  }
  for (const variant of ['a', 'b'] as const) {
    const id = `wave20/house_l1_${year}_${variant}-v1`;
    test(`${id} uses its registered complete body and private overlays without moving its ground`, () => {
      const body = ART_REGISTRY.entry(id);
      assert.ok(body?.kind === 'building-body');
      assert.ok(body.image.url.startsWith('assets/height-era1/'));
      assert.equal(body.geometry.scale, 0.4986217267599071);
      assert.equal(body.image.width, 139);
      assert.equal(body.geometry.pivot.x, 71.66148325358851);
      assert.ok(Math.abs(body.geometry.pivot.y - 125.92025518341308 - (body.image.height - 139)) < 1e-10);
      assert.ok(body.roofRidge);
      for (const layer of ['boarded', 'snow'] as const) {
        const overlay = ART_REGISTRY.select('state-overlay', `house-${layer}`, { bodyId: id, layer, season: 'winter', vacant: true }, 0);
        assert.ok(overlay?.kind === 'state-overlay');
        assert.deepEqual(overlay.targetBodyIds, [id]);
        assert.deepEqual(overlay.geometry, body.geometry);
        assert.deepEqual([overlay.image.width, overlay.image.height], [body.image.width, body.image.height]);
        assert.ok(overlay.image.url.startsWith('assets/height-era1/'));
      }
    });
  }
}
