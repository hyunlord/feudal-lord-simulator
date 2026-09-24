import { authoredAssetPath } from "../scripts/runtimeAssetProvenance";
import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { millRegistration } from '../src/render/animatedMill';

test('mill separate originals retain exact provenance when the optional source archive is available', async (context) => {
  const hashes = { body: 'f2d06c4bc58f49cb22fc1e6b0c28f4991e9ba06f60882058089dc225277655e0', sails: 'c8cabbb902df49619608192bbb4e556d5c8351cf72bd63c3dcb2de24361a0340' };
  for (const id of ['body', 'sails'] as const) {
    const part = millRegistration[id];
    const source = authoredAssetPath(part.url);
    await context.test(id, { skip: existsSync(source) ? false : `Optional original unavailable: ${source}; runtime hashes remain mandatory in runtimeAssetCoordinates.test.ts` }, () => {
      const image = readFileSync(source);
      assert.equal(createHash('sha256').update(image).digest('hex'), hashes[id]);
      assert.equal(image.readUInt32BE(16), part.width);
      assert.equal(image.readUInt32BE(20), part.height);
    });
  }
});

test('mill hub registrations stay inside their authored canvases', () => {
  assert.ok(millRegistration.bodyHub.x < millRegistration.body.width);
  assert.ok(millRegistration.sailHub.x < millRegistration.sails.width);
});

for (const mode of ['ready', 'error', 'wrong_size', 'constructor_throw', 'src_throw', 'raster_throw'] as const) {
  test(`mill loader settles with ${mode} and missing part keeps static fallback`, () => {
    execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', `
      import assert from 'node:assert/strict';
      import { preloadMillAssets, millAssetStatuses, drawAnimatedMill } from './src/render/animatedMill.ts';
      globalThis.Image = class {
        constructor() { if ('${mode}' === 'constructor_throw') throw new Error('image unavailable'); }
        set src(url) {
          if ('${mode}' === 'src_throw') throw new Error('url unavailable');
          this.naturalWidth = '${mode}' === 'wrong_size' ? 1 : url.includes('body') ? 1254 : 1312;
          this.naturalHeight = url.includes('body') ? 1254 : 1199;
          queueMicrotask(() => '${mode}' === 'error' ? this.onerror() : this.onload());
        }
      };
      if ('${mode}' === 'raster_throw') globalThis.OffscreenCanvas = class { getContext() { throw new Error('no canvas'); } };
      const first = preloadMillAssets(); assert.equal(first, preloadMillAssets()); await first;
      assert.ok(millAssetStatuses().every(part => part.status === (['ready','raster_throw'].includes('${mode}') ? 'ready' : 'missing')));
      if (!['ready','raster_throw'].includes('${mode}')) assert.equal(drawAnimatedMill({}, {kind:'mill'}), false);
    `]);
  });
}
