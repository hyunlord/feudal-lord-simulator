import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSaveFile } from '../scripts/loadSaveFile';
import { funeralQueueItems, funeralScene } from '../src/render/plagueWorldProps';

test('normal plague save preserves route, pause and rewind without creating engine walkers', () => {
  const state = loadSaveFile('docs/qa/round02/repro/saves/chapter3-plague1348.json.gz');
  const before = JSON.stringify(state);
  const first = funeralScene(state, 4000);
  const later = funeralScene(state, 8000);
  assert.ok(first !== null && later !== null);
  assert.notDeepEqual(first, later);
  assert.deepEqual(funeralScene(state, 4000), first);
  assert.equal(funeralQueueItems(state, 4000).length, 1);
  assert.equal(funeralScene(state, 12000), null);
  assert.equal(funeralScene(state, 15999), null);
  assert.ok(funeralScene(state, 16000) !== null);
  assert.equal(JSON.stringify(state), before);
});
