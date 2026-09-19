import assert from 'node:assert/strict';
import test from 'node:test';
import { constructionArtLayers } from '../src/render/constructionArtAssets';
import { createConstructionSite } from '../src/economy/construction';
import { constructionCompletionEffectsForFrame, createConstructionCompletionTracker } from '../src/render/constructionCompletionEffects';

test('construction layers follow stage and footprint without altering source proportions', () => {
  const small = createConstructionSite({ ordinal: 1, kind: 'house', tx: 3, ty: 4, startedTick: 0 });
  const large = createConstructionSite({ ordinal: 2, kind: 'storehouse', tx: 3, ty: 4, startedTick: 0 });
  assert.equal(constructionArtLayers(small, 'plot').length, 0);
  assert.equal(constructionArtLayers(small, 'foundation').length, 1);
  assert.equal(constructionArtLayers(small, 'frame').length, 3);
  assert.equal(constructionArtLayers(small, 'roof').length, 4);
  const largeLayer = constructionArtLayers(large, 'foundation')[0];
  const smallLayer = constructionArtLayers(small, 'foundation')[0];
  assert.ok(largeLayer && smallLayer);
  assert.ok(largeLayer.width > smallLayer.width);
});
test('completed building evidence distinguishes construction from cancellation', () => {
  const site = createConstructionSite({ ordinal: 1, kind: 'house', tx: 3, ty: 4, startedTick: 0 });
  const cancelled = createConstructionCompletionTracker();
  constructionCompletionEffectsForFrame(cancelled, [site], 0, []);
  assert.deepEqual(constructionCompletionEffectsForFrame(cancelled, [], 20, []), []);
  const completed = createConstructionCompletionTracker();
  constructionCompletionEffectsForFrame(completed, [site], 0, []);
  const effects = constructionCompletionEffectsForFrame(completed, [], 20, [site.id]);
  assert.equal(effects.length, 1);
  assert.equal(effects[0]?.confirmedCompletion, true);
  assert.deepEqual(constructionCompletionEffectsForFrame(completed, [], 220, [site.id]), []);
});
