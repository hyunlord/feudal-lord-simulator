import assert from 'node:assert/strict';
import test from 'node:test';
import catalog from '../src/render/art/catalog.json';
import { createArtRegistry } from '../src/render/art/artRegistry';
import { createArtAdapters } from '../src/render/art/artAdapters';
import type { ArtRect } from '../src/render/art/artContract';

const registry = createArtRegistry(catalog);

test('fire brigade selection uses actual active facts and calendar seasons, without an event id whitelist', () => {
  for (const season of ['spring', 'summer', 'autumn', 'winter']) {
    const facts = { eventId: 'pack-specific-fire', group: 'bucket-brigade', season, active: true };
    const entry = registry.select('event-scene', 'fire-brigade', facts, 17);
    assert.equal(entry?.id, `world-events/bucket-brigade-${season === 'winter' ? 'winter' : 'summer'}`);
    assert.equal(registry.select('event-scene', 'fire-brigade', { ...facts, active: false }, 17), null);
  }
});

test('brigade paintings keep one ground pivot and calibrated adult size across seasons', () => {
  const summer = registry.entry('world-events/bucket-brigade-summer');
  const winter = registry.entry('world-events/bucket-brigade-winter');
  assert.ok(summer?.kind === 'event-scene' && winter?.kind === 'event-scene');
  assert.deepEqual(summer.geometry, winter.geometry);
  assert.deepEqual(summer.geometry.pivot, { x: 160, y: 200 });
  assert.ok(Math.abs(summer.geometry.scale * 50 - 17.6) < 1e-12);
  assert.equal(summer.geometry.allowMirror, false);
  assert.equal(summer.duration.mode, 'while-active');
});

test('flame animation repeats four native cells without moving its ground anchor', () => {
  const adapters = createArtAdapters(registry);
  const targets: ArtRect[] = [];
  for (const elapsedMs of [0, 100, 200, 300, 400]) {
    const placement = adapters.placement('world-events/fire-flicker', { at: { x: 20, y: 40 }, elapsedMs });
    assert.ok(placement?.type === 'blit');
    assert.deepEqual(placement.sourceRect, { x: (Math.floor(elapsedMs / 100) % 4) * 64, y: 0, width: 64, height: 96 });
    targets.push(placement.targetRect);
  }
  assert.ok(targets.every(target => JSON.stringify(target) === JSON.stringify(targets[0])));
});
