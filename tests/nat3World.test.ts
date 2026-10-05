import assert from 'node:assert/strict';
import test from 'node:test';
import { calendarProgress, autumnAccumulation } from '../src/render/calendarProgress';
import { worldRainParticles, rainBandWeight } from '../src/render/worldRainModel';

test('calendar progress follows actual seasons and reload rather than observation time', () => {
  const state = { scenarioId: 'core:campaign_market_town', tick: 2_500 };
  const progress = calendarProgress(state);
  assert.equal(progress.season, 2); assert.equal(progress.fraction, 0.5);
  assert.deepEqual(calendarProgress(structuredClone(state)), progress);
  assert.ok(autumnAccumulation(progress) > autumnAccumulation(calendarProgress({ ...state, tick: 2_100 })));
  assert.equal(autumnAccumulation(calendarProgress({ ...state, tick: 3_500 })), 0);
});
test('rain particles retain identities and world positions when only the camera changes', () => {
  const a = { x: -200, y: -200, width: 800, height: 800 };
  const b = { x: 0, y: 0, width: 800, height: 800 };
  const input = { seed: 31, seconds: 15, intensity: 1 };
  const first = worldRainParticles(input, a); const second = worldRainParticles(input, b);
  assert.ok(first.length > 0);
  const shared = first.filter(p => p.x > 40 && p.x < 550 && p.y > 40 && p.y < 550);
  assert.ok(shared.length > 0);
  for (const particle of shared) assert.deepEqual(second.find(p => p.id === particle.id), particle);
  assert.deepEqual(worldRainParticles(input, a), first);
  assert.equal(worldRainParticles({ ...input, intensity: 0 }, a).length, 0);
});
test('rain bands move independently of the viewport and stay within intensity bounds', () => {
  const values = Array.from({ length: 40 }, (_, i) => rainBandWeight(300, 200, i, 7));
  assert.ok(Math.max(...values) - Math.min(...values) > 0.2);
  assert.ok(values.every(x => x >= 0 && x <= 1));
});
