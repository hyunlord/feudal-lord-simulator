import assert from 'node:assert/strict';
import test from 'node:test';
import { recordingCanvas } from '../scripts/recordingCanvas';
import { DEFAULT_GAME_STATE } from '../src/state/gameStore';
import { drawSeasonalDecals } from '../src/render/seasonalDecals';
import { resetSeasonBlendForTest } from '../src/render/seasonTransition';

test('an empty settled-season ground pass leaves the canvas call stream untouched', () => {
  for (const tick of [600, 1600, 2600, 3600]) {
    resetSeasonBlendForTest();
    const { context, canvas } = recordingCanvas(1280, 800);
    drawSeasonalDecals(context, { ...DEFAULT_GAME_STATE, tick, palisade: null }, [], 1);
    assert.deepEqual(canvas.ops, [], `empty ground at ${tick}`);
    assert.equal(context.globalAlpha, 1);
  }
});
