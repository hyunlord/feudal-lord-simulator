import assert from 'node:assert/strict';
import test from 'node:test';
import { createArtRegistry } from '../src/render/art/artRegistry';
import { createArtImageLoader } from '../src/render/art/artImageLoader';

const registry = createArtRegistry([{ schemaVersion: 1, bundleId: 'loader', rules: [], entries: [
  { id: 'image', kind: 'land-stage', image: { url: 'assets/art/test.png', width: 64, height: 32 },
    provenance: { inboxFile: 'assets-inbox/test.png', sourceSha256: 'a'.repeat(64), runtimeSha256: 'b'.repeat(64) },
    geometry: { pivot: { x: 32, y: 30 }, scale: 1, allowMirror: false }, family: 'tree', stage: 'stump', layout: 'single' },
] }]);
/** Only the DOM image boundary is replaced: callbacks and the decode promise remain asynchronous. */
function fakeImage(width = 64, height = 32) {
  const image: HTMLImageElement = Object.create(null);
  let resolveDecode: () => void = () => { throw new Error('Decode promise not initialized'); };
  let rejectDecode: (error: Error) => void = () => { throw new Error('Decode promise not initialized'); };
  const decoded = new Promise<void>((resolve, reject) => { resolveDecode = resolve; rejectDecode = reject; });
  Object.assign(image, { naturalWidth: width, naturalHeight: height, src: '', onload: null, onerror: null, decode: () => decoded });
  return { image, resolveDecode, rejectDecode,
    load: () => image.onload?.call(image, new Event('load')),
    fail: () => image.onerror?.call(image, new Event('error')) };
}
test('lazy image loads once and becomes ready only after decoding', async () => {
  // Given a validated registry and a controllable image boundary.
  const fake = fakeImage(); let allocations = 0;
  const loader = createArtImageLoader(registry, { baseUrl: '/game/', createImage: () => { allocations++; return fake.image; } });
  assert.equal(loader.status('image').status, 'idle'); assert.equal(allocations, 0);
  // When the same ID is requested before decode completion.
  assert.equal(loader.image('image'), null); assert.equal(loader.image('image'), null);
  fake.load();
  assert.equal(loader.status('image').status, 'loading');
  fake.resolveDecode(); await Promise.resolve();
  // Then the sole image is ready and the base URL was honored.
  assert.equal(allocations, 1); assert.equal(loader.image('image'), fake.image);
  assert.equal(loader.status('image').status, 'ready'); assert.equal(fake.image.src, '/game/assets/art/test.png');
});
test('wrong natural dimensions reject a successfully decoded image', async () => {
  // Given a file whose real size differs from the registry.
  const fake = fakeImage(63); const loader = createArtImageLoader(registry, { baseUrl: '/', createImage: () => fake.image });
  // When its load and decode succeed.
  loader.image('image'); fake.load(); fake.resolveDecode(); await Promise.resolve();
  // Then it remains unavailable to draw, with an explicit mismatch reason.
  assert.equal(loader.image('image'), null); assert.equal(loader.status('image').status, 'missing');
  assert.match(loader.status('image').reason ?? '', /Decoded size/);
});
test('decode rejection is reported as missing', async () => {
  // Given an image request that finishes but cannot decode.
  const fake = fakeImage(); const loader = createArtImageLoader(registry, { baseUrl: '/', createImage: () => fake.image });
  // When the decoder rejects.
  loader.image('image'); fake.load(); fake.rejectDecode(new Error('bad PNG')); await Promise.resolve();
  // Then failure is observable and no image is returned.
  assert.equal(loader.status('image').status, 'missing'); assert.equal(loader.image('image'), null);
  assert.match(loader.status('image').reason ?? '', /bad PNG/);
});
test('network failure is terminal and does not allocate another image', () => {
  // Given a failed image request.
  const fake = fakeImage(); let allocations = 0;
  const loader = createArtImageLoader(registry, { baseUrl: '/', createImage: () => { allocations++; return fake.image; } });
  loader.image('image'); fake.fail();
  // When the same image is requested again.
  assert.equal(loader.image('image'), null);
  // Then it is still missing and no retry changes lazy cache behavior.
  assert.equal(loader.status('image').status, 'missing'); assert.equal(allocations, 1);
});
test('Node without Image is unavailable rather than ready', () => {
  // Given no browser Image API.
  const loader = createArtImageLoader(registry, { baseUrl: '/', createImage: null });
  // When / Then neither known nor missing IDs pretend to be loaded.
  assert.equal(loader.image('image'), null); assert.equal(loader.status('image').status, 'unavailable');
  assert.equal(loader.status('unknown').status, 'unavailable');
});
test('ready subscriptions fire once after decode and immediately for an already ready image', async () => {
  const fake = fakeImage(); const loader = createArtImageLoader(registry, { baseUrl: '/', createImage: () => fake.image });
  let count = 0; const ready = (image: HTMLImageElement): void => { assert.equal(image, fake.image); count++; };
  loader.onReady('image', ready); loader.onReady('image', ready);
  loader.image('image'); fake.load(); assert.equal(count, 0);
  fake.resolveDecode(); await Promise.resolve(); assert.equal(count, 1);
  loader.onReady('image', ready); assert.equal(count, 1);
  loader.onReady('image', () => { count++; }); assert.equal(count, 2);
  fake.load(); await Promise.resolve(); assert.equal(count, 2);
});
test('a failing readiness consumer cannot turn a decoded image into a decoder failure', async () => {
  const fake = fakeImage(); const loader = createArtImageLoader(registry, { baseUrl: '/', createImage: () => fake.image });
  let otherCalled = false;
  loader.onReady('image', () => { throw 'raster consumer failed'; });
  loader.onReady('image', () => { otherCalled = true; });
  loader.image('image'); fake.load(); fake.resolveDecode(); await Promise.resolve();
  assert.equal(loader.status('image').status, 'ready'); assert.equal(otherCalled, true);
  assert.equal(loader.readinessErrors('image')[0]?.message, 'Readiness callback failed: raster consumer failed');
});
test('loadSettled shares one lifecycle and resolves ready after decode', async () => {
  const fake = fakeImage(); let allocations = 0;
  const loader = createArtImageLoader(registry, { baseUrl: '/', createImage: () => { allocations++; return fake.image; } });
  const first = loader.loadSettled('image'); const second = loader.loadSettled('image');
  assert.equal(first, second); assert.equal(allocations, 1);
  let settled = false; void first.then(() => { settled = true; });
  fake.load(); await Promise.resolve(); assert.equal(settled, false);
  fake.resolveDecode(); assert.deepEqual(await first, { status: 'ready', reason: null });
  assert.equal(loader.loadSettled('image'), first); assert.equal(loader.image('image'), fake.image);
  fake.fail(); assert.equal(loader.status('image').status, 'ready');
});
test('loadSettled resolves every failure without retries or rejected promises', async () => {
  for (const mode of ['network', 'decode-reject', 'decode-throw', 'size', 'src', 'constructor'] as const) {
    const fake = fakeImage(mode === 'size' ? 63 : 64); let allocations = 0;
    if (mode === 'decode-throw') fake.image.decode = () => { throw new Error('synchronous decode'); };
    if (mode === 'src') Object.defineProperty(fake.image, 'src', { set() { throw new Error('src assignment'); } });
    const loader = createArtImageLoader(registry, { baseUrl: '/', createImage: () => {
      allocations++; if (mode === 'constructor') throw new Error('Image constructor'); return fake.image;
    } });
    const pending = loader.loadSettled('image');
    if (mode === 'network') fake.fail();
    if (mode === 'decode-reject') { fake.load(); fake.rejectDecode(new Error('bad decode')); }
    if (mode === 'decode-throw') fake.load();
    if (mode === 'size') { fake.load(); fake.resolveDecode(); }
    const state = await pending;
    assert.equal(state.status, 'missing', mode); assert.ok(state.reason, mode);
    assert.equal(loader.image('image'), null); assert.equal(loader.loadSettled('image'), pending); assert.equal(allocations, 1);
  }
});
test('loadSettled resolves unavailable for unknown IDs and no browser Image', async () => {
  const loader = createArtImageLoader(registry, { baseUrl: '/', createImage: null });
  for (const id of ['image', 'unknown']) {
    const first = loader.loadSettled(id);
    assert.equal(loader.loadSettled(id), first); assert.equal((await first).status, 'unavailable');
  }
});
test('settlement survives a readiness consumer failure and a late decode rejection', async () => {
  const fake = fakeImage(); const loader = createArtImageLoader(registry, { baseUrl: '/', createImage: () => fake.image });
  loader.onReady('image', () => { throw 'consumer failure'; });
  const pending = loader.loadSettled('image'); fake.load(); fake.resolveDecode();
  assert.equal((await pending).status, 'ready'); assert.equal(loader.readinessErrors('image').length, 1);
  const late = fakeImage(); const other = createArtImageLoader(registry, { baseUrl: '/', createImage: () => late.image });
  const failed = other.loadSettled('image'); late.load(); late.fail(); late.rejectDecode(new Error('late'));
  const result = await failed; await Promise.resolve();
  assert.equal(result.reason, 'Image request failed'); assert.deepEqual(other.status('image'), result);
});
test('unprintable thrown values settle failures and cannot interrupt readiness listeners', async () => {
  const unprintable: unknown[] = [Object.create(null), { toString() { throw new Error('formatting failure'); } }];
  for (const error of unprintable) {
    const constructor = createArtImageLoader(registry, { baseUrl: '/', createImage: () => { throw error; } });
    const constructorState = await constructor.loadSettled('image');
    assert.equal(constructorState.status, 'missing'); assert.match(constructorState.reason ?? '', /Unprintable thrown value/);
    for (const mode of ['sync-decode', 'async-decode', 'src'] as const) {
      const fake = fakeImage();
      if (mode === 'sync-decode') fake.image.decode = () => { throw error; };
      if (mode === 'async-decode') fake.image.decode = () => Promise.reject(error);
      if (mode === 'src') Object.defineProperty(fake.image, 'src', { set() { throw error; } });
      const loader = createArtImageLoader(registry, { baseUrl: '/', createImage: () => fake.image });
      const pending = loader.loadSettled('image');
      if (mode !== 'src') fake.load();
      const state = await pending; assert.equal(state.status, 'missing'); assert.match(state.reason ?? '', /Unprintable thrown value/);
    }
    const fake = fakeImage(); const loader = createArtImageLoader(registry, { baseUrl: '/', createImage: () => fake.image });
    let later = 0;
    loader.onReady('image', () => { throw error; }); loader.onReady('image', () => { later++; });
    const pending = loader.loadSettled('image'); fake.load(); fake.resolveDecode();
    assert.equal((await pending).status, 'ready'); assert.equal(later, 1);
    assert.match(loader.readinessErrors('image')[0]?.message ?? '', /Unprintable thrown value/);
  }
});

for (const [label, thrown] of [
  ['null prototype', Object.create(null)],
  ['throwing toString', { toString() { throw new Error('conversion failed'); } }],
] as const) test(`unprintable ${label} readiness failures cannot suppress later listeners`, async () => {
  const fake = fakeImage(); const loader = createArtImageLoader(registry, { baseUrl: '/', createImage: () => fake.image });
  let called = 0; const fails = (): void => { throw thrown; };
  loader.onReady('image', fails); loader.onReady('image', () => { called++; });
  loader.image('image'); fake.load(); fake.resolveDecode(); await Promise.resolve();
  assert.equal(called, 1); assert.equal(loader.status('image').status, 'ready');
  assert.equal(loader.image('image'), fake.image);
  assert.doesNotThrow(() => loader.onReady('image', () => { throw thrown; }));
  loader.onReady('image', () => { called++; }); assert.equal(called, 2);
  loader.onReady('image', fails); assert.equal(loader.readinessErrors('image').length, 2);
  for (const error of loader.readinessErrors('image')) assert.equal(error.message, 'Readiness callback failed: Unprintable thrown value');
});
