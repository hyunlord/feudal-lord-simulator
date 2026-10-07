import assert from 'node:assert/strict';
import test from 'node:test';
import type { RenderQueueItem } from '../src/render/objectRenderOrder';
import { placeWalkers } from '../src/render/walkerOcclusion';
import { sortRenderItems } from '../src/render/objectRenderSort';

const house: RenderQueueItem = { kind: 'building', id: 'house', depth: 22, anchorTx: 11,
  building: { id: 'house', kind: 'storehouse', tx: 10, ty: 10, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 } };
for (const [tx, ty, expected] of [[10, 10, ['funeral', 'house']], [11.6, 9.8, ['house', 'funeral']]] as const) {
  test(`funeral uses the footprint depth rule at ${tx},${ty}`, () => {
    const procession: RenderQueueItem = { kind: 'funeral', id: 'funeral', depth: tx + ty, anchorTx: tx,
      foot: { tx, ty }, scene: { x: 0, y: 0, dir: 'NE', gait: 0 } };
    const result = placeWalkers(sortRenderItems([house, procession]), { constructionSites: [] }, () => false);
    assert.deepEqual(result.map(item => item.id), expected);
    assert.equal(result.filter(item => item.kind === 'funeral').length, 1);
  });
}
