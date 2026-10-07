import assert from 'node:assert/strict';
import test from 'node:test';
import { funeralRegistration } from '../src/render/funeralRegistration';
import { storyWalkerScale } from '../src/render/storyWorldProps';

for (const direction of ['NE', 'SE', 'SW', 'NW'] as const) for (const gait of [0, 1]) {
  test(`four decorative hands meet the bier in ${direction} gait ${gait}`, () => {
    // Given measured source endpoints and the existing 17.6 px adult scale.
    const scale = storyWalkerScale('wk_funeral_bearers');
    // When registered around a route point at the origin.
    const layout = funeralRegistration(direction, gait);
    // Then every selected hand meets its corresponding handle.
    assert.equal(layout.bearers.length, 4);
    for (const bearer of layout.bearers) {
      assert.ok(Math.abs(bearer.x + scale * (bearer.hand[0] - 37) - layout.bier.x - .65 * (bearer.tip[0] - 32)) < 1e-10);
      assert.ok(Math.abs(bearer.y + scale * (bearer.hand[1] - 70) - layout.bier.y - .65 * (bearer.tip[1] - 16)) < 1e-10);
    }
  });
  test(`route centre and two near/two far bearers remain stable in ${direction} gait ${gait}`, () => {
    const layout = funeralRegistration(direction, gait);
    assert.ok(Math.abs(layout.bearers.reduce((sum, b) => sum + b.x, 0)) < 1e-10);
    assert.ok(Math.abs(layout.bearers.reduce((sum, b) => sum + b.y, 0)) < 1e-10);
    assert.equal(layout.bearers.filter(b => b.behind).length, 2);
    assert.deepEqual(layout, funeralRegistration(direction, gait + 2));
    assert.equal(layout.bierKey, direction === 'NE' || direction === 'SW' ? 'prop_bier_shroud_ne' : 'prop_bier_shroud_nw');
  });
}
