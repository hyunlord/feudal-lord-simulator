import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writePng } from '../scripts/processBuildingSprite';
const modulePath = '../scripts/artPixelCompare.mjs';
const comparator = await import(modulePath);
for (const [label, rgba] of [ ['RGB', [11, 20, 30, 255]], ['alpha', [10, 20, 30, 254]] ] as const) {
  test(`rejects one changed ${label} channel when PNG dimensions match`, () => {
    // Given two actual lossless PNG files differing in one channel.
    const dir = mkdtempSync(join(tmpdir(), 'art-pixels-'));
    try {
      writePng(join(dir, 'a.png'), { dimensions: { width: 1, height: 1 }, rgba: Uint8Array.from([10, 20, 30, 255]) });
      writePng(join(dir, 'b.png'), { dimensions: { width: 1, height: 1 }, rgba: Uint8Array.from(rgba) });
      // When the comparator reads their decoded pixels.
      const result = comparator.comparePng(join(dir, 'a.png'), join(dir, 'b.png'));
      // Then even a one-channel delta is a failed gate.
      assert.equal(result.pass, false);
      assert.equal(result.differingPixels, 1);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
}
test('rejects different dimensions even with identical byte counts', () => {
  // Given equally sized RGBA buffers representing different rectangles.
  const a = { dimensions: { width: 1, height: 2 }, rgba: new Uint8Array(8) };
  const b = { dimensions: { width: 2, height: 1 }, rgba: new Uint8Array(8) };
  // When / Then size mismatch cannot pass pixel equality.
  assert.equal(comparator.compareRgba(a, b).pass, false);
});
test('accepts identical full RGBA buffers', () => {
  // Given a transparent pixel.
  const a = { dimensions: { width: 1, height: 1 }, rgba: Uint8Array.from([10, 20, 30, 0]) };
  // When / Then all four channels match.
  assert.equal(comparator.compareRgba(a, a).pass, true);
});

for (const failure of ['missing-png', 'extra-png', 'failed-capture', 'different-camera'] as const) {
  test(`rejects capture folders when ${failure}`, async () => {
    // Given two real capture folders and one broken acceptance condition.
    const { mkdirSync, writeFileSync } = await import('node:fs');
    const root = mkdtempSync(join(tmpdir(), 'art-folders-'));
    try {
      for (const side of ['a', 'b']) {
        const dir = join(root, side); mkdirSync(dir);
        const image = { dimensions: { width: 1, height: 1 }, rgba: Uint8Array.from([1, 2, 3, 255]) };
        if (!(side === 'b' && failure === 'missing-png')) writePng(join(dir, 'scene.png'), image);
        if (side === 'b' && failure === 'extra-png') writePng(join(dir, 'extra.png'), image);
        writeFileSync(join(dir, 'scene.jpg'), 'context-only');
        writeFileSync(join(dir, 'captures.json'), JSON.stringify({ errors: [], pass: !(side === 'b' && failure === 'failed-capture'),
          views: [{ name: 'scene', stable: true, repeat: { pass: true }, errors: [], repeatErrors: [], identity: { savedStateSHA: 'fixture-sha', expectedRequests: ['/assets/fixture.png'], tile: side === 'b' && failure === 'different-camera' ? [2, 1] : [1, 1] } }] }));
      }
      // When / Then an identical pixel cannot hide the broken gate.
      assert.equal(comparator.compareFolders(join(root, 'a'), join(root, 'b')).pass, false);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
}
