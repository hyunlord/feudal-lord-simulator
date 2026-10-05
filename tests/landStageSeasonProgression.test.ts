import assert from 'node:assert/strict';
import test from 'node:test';
import { landStageEdition, treeStageItem } from '../src/render/landStageItems';

test('felled land stages accumulate and melt snow by stable identity instead of the season boundary', () => {
  const items = Array.from({ length: 40 }, (_, tx) => treeStageItem({ tx, ty: 8, harvestedAtTick: 2999 }, 3000));
  const winterCount = (tick: number) => items.filter(item => landStageEdition(item, { tick }) === item.piece.editions.winter).length;
  assert.equal(winterCount(3000), 0);
  assert.ok(winterCount(3400) > 0 && winterCount(3400) < items.length);
  assert.equal(winterCount(3800), items.length);
  assert.equal(winterCount(4000), items.length);
  assert.ok(winterCount(4100) > 0 && winterCount(4100) < items.length);
  assert.equal(winterCount(4300), 0);
  assert.equal(winterCount(1), 0);
  for (const item of items) {
    assert.equal(landStageEdition(item, { tick: 3400 }), landStageEdition(structuredClone(item), { tick: 3400 }));
  }
});
