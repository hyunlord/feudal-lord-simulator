import assert from 'node:assert/strict';
import test from 'node:test';
import { springHedgeSlices } from '../src/render/springHedges';
import { tileToScreen } from '../src/render/iso';

test('spring hedge source ground line follows both isometric edge directions without gaps', () => {
  for (const axis of ['x', 'y'] as const) {
    const piece = { axis, tx: 7, ty: 9, offset: 0.97, step: 0 };
    const slices = springHedgeSlices(piece, { width: 512, height: 64, groundY: 53, scale: 0.5 });
    assert.equal(slices.length, 2);
    assert.equal(slices.reduce((sum, slice) => sum + slice.source.width, 0), 64);
    const start = tileToScreen(axis === 'x' ? 6.5 : 7.5, 9.5);
    const slope = axis === 'x' ? 0.5 : -0.5;
    let travelled = 0;
    for (const slice of slices) {
      assert.equal(slice.source.height, 64);
      assert.ok(slice.source.x >= 0 && slice.source.x + slice.source.width <= 512);
      assert.equal(slice.m[4], start.sx + travelled);
      assert.equal(slice.m[3] * 53 + slice.m[5], start.sy + slope * travelled);
      travelled += slice.source.width * slice.m[0];
    }
    assert.equal(travelled, 32);
  }
});
