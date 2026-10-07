import assert from 'node:assert/strict';
import test from 'node:test';
import { wetPathStage, wetPathJoinFade, wetPathJoinCentres } from '../src/render/footpathWet';
import { footpathRule } from '../src/render/footpathModel';

 test('Given a weather curve When quantized Then exactly six wet levels plus dry are stable', () => {
  assert.deepEqual([...new Set(Array.from({ length: 1001 }, (_, n) => wetPathStage(n / 1000, true, true, 'summer')))], [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(wetPathStage(0.51, true, true, 'summer'), wetPathStage(0.52, true, true, 'summer'));
});
test('Given dry, disabled, unavailable or winter art When staged Then clear pixels remain untouched', () => {
  assert.equal(wetPathStage(0, true, true, 'summer'), 0);
  assert.equal(wetPathStage(1, false, true, 'summer'), 0);
  assert.equal(wetPathStage(1, true, false, 'summer'), 0);
  assert.equal(wetPathStage(1, true, true, 'winter'), 0);
});
test('Given every corner and fork When blended Then the whole clear join cell is preserved with a smooth taper', () => {
  for (const ports of [['NE', 'NW'], ['SE', 'SW'], ['NE', 'SE'], ['NW', 'SW'], ['NE', 'SW', 'NW'], ['NE', 'SE', 'SW', 'NW']] as const) {
    const piece = { cell: 0, tx: 2, ty: 3, ports, rule: footpathRule(ports), bridge: false };
    for (const axis of ['ne', 'nw'] as const) {
      const run = { axis, line: axis === 'ne' ? 2 : 3 };
      const centres = wetPathJoinCentres(run, [piece]);
      const centre = (axis === 'ne' ? -3 : 2) * 128 + 64;
      assert.deepEqual(centres, [centre]);
      assert.equal(wetPathJoinFade(centre, centres), 0);
      assert.equal(wetPathJoinFade(centre + 64, centres), 0);
      assert.equal(wetPathJoinFade(centre + 96, centres), 0.5);
      assert.equal(wetPathJoinFade(centre + 128, centres), 1);
      assert.equal(wetPathJoinFade(centre - 96, centres), 0.5);
    }
  }
});
test('Given straight paths and joins on another line When blended Then no unrelated fade is introduced', () => {
  const ports = ['NE', 'SW'] as const;
  const piece = { cell: 0, tx: 2, ty: 3, ports, rule: footpathRule(ports), bridge: false };
  assert.deepEqual(wetPathJoinCentres({ axis: 'ne', line: 2 }, [piece]), []);
  assert.equal(wetPathJoinFade(-512, []), 1);
});
