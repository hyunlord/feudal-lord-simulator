import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { decodePng } from '../scripts/keyartDerivatives';
import { PETITION_CROWD_FIGURES, petitionCrowdScale } from '../src/render/storyCrowdScale';
import { WALKER_FIGURE_PX } from '../src/render/walkerComposer';

test('petition group uses individual registered people, not whole-sheet height', () => {
  const png = decodePng(new Uint8Array(readFileSync('public/assets/wave9/event/crowd_manor_gate-v1.png')));
  const heights = PETITION_CROWD_FIGURES.map(({ crown, sole }) => {
    for (const point of [crown, sole]) {
      assert.ok(png.data[(point.y * png.width + point.x) * 4 + 3]! > 64,
        `registered source endpoint ${point.x},${point.y} must be visibly opaque`);
    }
    const height = sole.y - crown.y + 1;
    assert.ok(Math.abs(height * petitionCrowdScale() / WALKER_FIGURE_PX - 1) <= 0.1);
    return height;
  }).sort((a, b) => a - b);
  assert.equal(heights[Math.floor(heights.length / 2)]! * petitionCrowdScale(), WALKER_FIGURE_PX);
});
