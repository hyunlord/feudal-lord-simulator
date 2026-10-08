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

test('band readability keeps bounded opacity and monotone weather births without camera-dependent styling', () => {
  const view = { x: -800, y: -600, width: 1600, height: 1200 };
  const input = { seed: 7, seconds: 501.2, intensity: 0.55 };
  const medium = worldRainParticles(input, view);
  const heavy = worldRainParticles({ ...input, intensity: 1 }, view);
  assert.ok(medium.some(p => p.preferStrong));
  assert.ok(medium.some(p => p.strength > 0.55));
  for (const p of medium) {
    assert.ok(Number.isFinite(p.strength) && p.strength > 0 && p.strength <= 0.9);
    const next = heavy.find(q => q.id === p.id); assert.ok(next);
    assert.ok(next.strength >= p.strength); assert.equal(next.preferStrong, p.preferStrong);
    assert.equal(next.variant, p.variant);
  }
  assert.equal(worldRainParticles({ ...input, intensity: 0 }, view).length, 0);
  assert.ok(heavy.length <= (Math.ceil((view.width + 360) / 48) + 2) * (Math.ceil((view.height + 360) / 48) + 2) * 6);
});

test('readability changes preserve motion and the finite world particle candidate budget', () => {
  const input = { seed: 31, seconds: 15, intensity: 0.55 };
  const view = { x: -200, y: -200, width: 800, height: 800 };
  const first = worldRainParticles(input, view);
  assert.deepEqual(first, worldRainParticles(input, view));
  const other = worldRainParticles(input, { x: 0, y: 0, width: 1280 / 0.6, height: 800 / 0.6 });
  for (const p of first.filter(p => p.x > 40 && p.y > 40)) assert.deepEqual(other.find(q => q.id === p.id), p);
  assert.deepEqual(worldRainParticles({ ...input, intensity: -1 }, view), []);
});
