import test from 'node:test';
import assert from 'node:assert/strict';
import { gateArtAxis, gateArtPanels } from '../src/render/gateArtGeometry';
import { GATE_HALF_CLEARANCE } from '../src/world/wallTraversal';
for (const axis of ['descending', 'ascending'] as const) {
  test(`registered ${axis} gate inner feet preserve logical aperture`, () => {
    for (const material of ['stone', 'timber'] as const) {
      const panels = gateArtPanels(material, axis);
      assert.equal(panels.length, 3);
      const middle = panels[1]; assert.ok(middle);
      assert.equal(middle.targetLeft, -GATE_HALF_CLEARANCE * 32);
      assert.equal(middle.targetRight, GATE_HALF_CLEARANCE * 32);
    }
  });
}
test('only two opposite cardinal neighbors select generated gate art', () => {
  const point = { x: 5, y: 5 };
  assert.equal(gateArtAxis({point, neighbors:[{x:4,y:5},{x:6,y:5}],kind:'gate'}), 'descending');
  assert.equal(gateArtAxis({point, neighbors:[{x:5,y:6},{x:5,y:4}],kind:'gate'}), 'ascending');
  for (const neighbors of [[{x:4,y:5}], [{x:4,y:5},{x:5,y:6}], [{x:4,y:4},{x:6,y:6}]]) {
    assert.equal(gateArtAxis({point,neighbors,kind:'gate'}), null);
  }
});
