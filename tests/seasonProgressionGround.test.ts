import assert from 'node:assert/strict';
import test from 'node:test';
import { groundWinterAlpha } from '../src/render/seasonProgression';
import { worldSnowParticles } from '../src/render/worldSnow';
import catalog from '../src/render/art/catalog.json';
import { createArtRegistry } from '../src/render/art/artRegistry';

test('first frost precedes roof snow, varies by object, and melts in spring without invented first-year snow', () => {
  assert.equal(groundWinterAlpha({ tick: 2700 }, 'tile:1:1', 'frost'), 0);
  const amounts = Array.from({ length: 20 }, (_, i) => groundWinterAlpha({ tick: 2910 }, `tile:${i}:1`, 'frost'));
  assert.ok(new Set(amounts).size > 1);
  assert.ok(amounts.every(x => x > 0 && x < 1));
  assert.equal(groundWinterAlpha({ tick: 1 }, 'tile:1:1', 'frost'), 0);
  assert.equal(groundWinterAlpha({ tick: 4001 }, 'tile:1:1', 'frost'), 1);
  assert.equal(groundWinterAlpha({ tick: 4300 }, 'tile:1:1', 'frost'), 0);
});
test('fence drifts accumulate at fixed identities and are reconstructable after reload', () => {
  const values = [3000, 3400, 3600, 3900].map(tick => groundWinterAlpha({ tick }, 'fence:120:64', 'drift'));
  assert.equal(values[0], 0); assert.equal(values[3], 1);
  assert.deepEqual(values, [...values].sort((a, b) => a - b));
  assert.equal(groundWinterAlpha(JSON.parse('{"tick":3400}'), 'fence:120:64', 'drift'), values[1]);
});
test('snow births freeze with the calendar and retain identical world positions across camera changes', () => {
  const view = { x: 0, y: 0, width: 400, height: 300 };
  for (const blowing of [false, true]) {
    const a = worldSnowParticles(5, 128, view, blowing);
    const b = worldSnowParticles(5, 128, { ...view, x: 100 }, blowing);
    assert.deepEqual(a, worldSnowParticles(5, 128, view, blowing));
    const common = a.filter(p => b.some(q => q.id === p.id)); assert.ok(common.length > 0);
    for (const p of common) assert.deepEqual(p, b.find(q => q.id === p.id));
  }
});
test('snow weather contract accepts exactly six sources and rejects incomplete families', () => {
  const bundle = catalog.find(b => b.bundleId === 'wave39-seasons-snow'); assert.ok(bundle);
  const registry = createArtRegistry([bundle]); assert.equal(registry.entries().length, 6);
  assert.throws(() => createArtRegistry([{ ...bundle, entries: bundle.entries.filter(e => !e.id.includes('small')) }]));
});

import { validSnowMotion, validFootprintRules } from '../src/render/snowProgressionProfiles';
import profiles from '../src/render/seasonProgression.json';
test('invalid particle rates and unbounded observation budgets cannot enter presentation loops', () => {
  assert.equal(validSnowMotion({ ...profiles.snowWeather, interval: 0 }), false);
  assert.equal(validSnowMotion({ ...profiles.snowWeather, bandInterval: 0.00001 }), false);
  assert.equal(validSnowMotion({ ...profiles.snowWeather, speed: undefined }), false);
  assert.equal(validFootprintRules({ ...profiles.snowFootprints, maxWalkers: 10_000 }), false);
  assert.equal(validFootprintRules({ ...profiles.snowFootprints, maxPrints: Infinity }), false);
});

test('footprint profiles reject inconsistent distances and impossible coverage thresholds', () => {
  for (const override of [{ minAccumulation: 2 }, { minStep: 8, maxStep: 6 }, { maxSamples: 1 }, { stripLength: 200, maxSamples: 2, maxStep: 6 }]) {
    assert.equal(validFootprintRules({ ...profiles.snowFootprints, ...override }), false);
  }
  assert.equal(validFootprintRules(profiles.snowFootprints), true);
});
