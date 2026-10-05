import assert from 'node:assert/strict';
import test from 'node:test';
const modulePath = '../scripts/artContractCaptures.mjs';
const { packCanvasPixels, capturePhase } = await import(modulePath);

test('transfers exact RGBA bytes as a compact scalar across the browser boundary', () => {
  // Given enough pixels to cross the browser encoder chunk boundary, including all byte values and alpha.
  const rgba = Uint8ClampedArray.from({ length: 131072 }, (_, index) => index % 256);
  const canvas = { width: 256, height: 128, getContext: () => ({ getImageData: () => ({ data: rgba }) }), toDataURL: () => 'data:image/png;base64,fixture' };
  // When the browser-side transfer packs the canvas.
  const packed = packCanvasPixels(canvas);
  // Then Node recovers every byte exactly without four million protocol array nodes.
  assert.deepEqual(Buffer.from(packed.rgbaBase64, 'base64'), Buffer.from(rgba));
  assert.equal('rgba' in packed, false);
  assert.equal(typeof packed.rgbaBase64, 'string');
});

test('bounds a never-resolving browser phase and records which phase failed', async context => {
  // Given an evaluate-like operation which never resolves.
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const progress: unknown[] = [];
  const pending = capturePhase('view/snapshot', () => new Promise(() => {}), { timeoutMs: 100, progress: (event: unknown) => progress.push(event) });
  // When the Node-side deadline expires independently of the frozen browser clock.
  const rejected = assert.rejects(pending, /Capture phase timed out: view\/snapshot/);
  context.mock.timers.tick(100);
  await rejected;
  // Then the last persisted event identifies the pending operation.
  assert.equal(progress.length, 2);
  assert.deepEqual(progress[0], { phase: 'view/snapshot', status: 'started' });
  assert.match(JSON.stringify(progress[1]), /failed/);
});

test('opaque initial documents do not touch denied localStorage', async () => {
  // Given the opaque about:blank document on which Playwright also executes init scripts.
  const { runInNewContext } = await import('node:vm');
  const { initializeCaptureDocument } = await import(modulePath);
  const scope = { location: { protocol: 'about:' }, localStorage: { setItem() { throw new Error('opaque storage was accessed'); } } };
  // When / Then no browser API is accessed before the HTTP navigation.
  assert.doesNotThrow(() => runInNewContext(`(${initializeCaptureDocument.toString()})()`, scope));
});
test('storage access errors on the actual HTTP document remain fatal', async () => {
  // Given a real origin with a genuine storage failure.
  const { runInNewContext } = await import('node:vm');
  const { initializeCaptureDocument } = await import(modulePath);
  const scope = { location: { protocol: 'http:' }, localStorage: { setItem() { throw new Error('real storage failure'); } } };
  // When / Then the guard does not conceal product-origin failures.
  assert.throws(() => runInNewContext(`(${initializeCaptureDocument.toString()})()`, scope), /real storage failure/);
});

for (const [url, allow] of [
  ['ws://127.0.0.1:4309/?token=vite-session', true],
  ['ws://127.0.0.1:4309/game?token=vite-session', false],
  ['ws://127.0.0.1:4309/', false],
  ['ws://127.0.0.1:4310/?token=vite-session', false],
  ['ws://example.org:4309/?token=vite-session', false],
  ['ws://127.0.0.1:4309/?token=vite-session&other=1', false],
] as const) test(`routes only the capture server Vite socket: ${url}`, async () => {
  // Given openScene's normal catch-all websocket blocker and a candidate socket.
  const { routeCaptureWebSocket } = await import(modulePath);
  let connected = false, fallback = false;
  const socket = { url: () => url, connectToServer: () => { connected = true; } };
  // When the capture exception checks origin, path and token shape.
  routeCaptureWebSocket(socket, 'http://127.0.0.1:4309/', () => { fallback = true; });
  // Then only the intended Vite socket connects; unrelated sockets retain existing behavior.
  assert.equal(connected, allow); assert.equal(fallback, !allow);
});

test('requested and decoded assets fail acceptance until an actual draw is observed', async () => {
  // Given a preloaded asset which was never drawn.
  const { expectedArtIssues } = await import(modulePath);
  const url = '/assets/art/example.png';
  const evidence = { requestPaths: new Set([url]), decoded: [{ url, decoded: true, width: 64, height: 32 }], draws: [] };
  // When / Then preload success cannot substitute for actual draw coverage.
  assert.deepEqual(expectedArtIssues([url], evidence), [`Expected URL was not drawn: ${url}`]);
});
test('requested decoded and drawn asset passes the per-view asset gate', async () => {
  // Given all three independently observed lifecycle stages.
  const { expectedArtIssues } = await import(modulePath);
  const url = '/assets/art/example.png';
  // When / Then a complete observation passes.
  assert.deepEqual(expectedArtIssues([url], { requestPaths: new Set([url]), decoded: [{ url, decoded: true, width: 64, height: 32 }], draws: [url] }), []);
});

for (const action of ['offscreen-only', 'paint-to-main', 'full-clear', 'resize'] as const) {
  test(`tracks strip image lineage through OffscreenCanvas when ${action}`, async () => {
    // Given browser API boundaries with separate normal/offscreen prototypes, as in Chromium.
    const { runInNewContext } = await import('node:vm');
    const { initializeCaptureDocument } = await import(modulePath);
    const scope = { URL, action };
    const observed = runInNewContext(`
      class HTMLImageElement { get src() { return this.url; } set src(value) { this.url = value; } }
      class HTMLCanvasElement {
        get width() { return this.w ?? 64; } set width(value) { this.w = value; }
        get height() { return this.h ?? 64; } set height(value) { this.h = value; }
      }
      class OffscreenCanvas extends HTMLCanvasElement {}
      class CanvasRenderingContext2D {
        constructor(canvas) { this.canvas = canvas; }
        drawImage() {} clearRect() {}
        getTransform() { return {a:1,b:0,c:0,d:1,e:0,f:0}; }
      }
      class OffscreenCanvasRenderingContext2D {
        constructor(canvas) { this.canvas = canvas; }
        drawImage() {} clearRect() {}
        getTransform() { return {a:1,b:0,c:0,d:1,e:0,f:0}; }
      }
      const main = new HTMLCanvasElement();
      const document = {querySelector: () => main};
      const location = {protocol:'http:',href:'http://127.0.0.1:4309/'};
      const localStorage = {setItem() {}};
      const window = {};
      (${initializeCaptureDocument.toString()})();
      const image = new HTMLImageElement(); image.src = '/assets/wave42/paths/path_clear_ne_summer.png';
      const scratch = new OffscreenCanvas();
      const paint = new OffscreenCanvasRenderingContext2D(scratch);
      paint.drawImage(image, 0, 0);
      if (action === 'full-clear') paint.clearRect(0, 0, 64, 64);
      if (action === 'resize') scratch.width = 128;
      if (action !== 'offscreen-only') new CanvasRenderingContext2D(main).drawImage(scratch, 0, 0);
      [...window.__ART_CAPTURE__.draws];
    `, scope);
    // When source pixels reach the main canvas (or their scratch content is cleared beforehand).
    // Then only a real painted chain counts, not an isolated offscreen draw or stale cleared raster.
    assert.deepEqual(Array.from(observed), action === 'paint-to-main' ? ['/assets/wave42/paths/path_clear_ne_summer.png'] : []);
  });
}

const captureView = { name: 'prepared-season-spring-z1', state: 'prepared-season-spring', season: 'spring',
  tile: [34, 34], zoom: 1, width: 1280, height: 800, dpr: 1,
  expectedRequests: ['/assets/foliage/tree_dead.png'] };

test('accepts all calendar seasons and planned capture zooms before opening a browser', async () => {
  const { validateCaptureViews, captureSeasonIndex } = await import(modulePath);
  for (const [index, season] of ['spring', 'summer', 'autumn', 'winter'].entries()) {
    assert.equal(captureSeasonIndex(season), index);
    for (const zoom of [0.6, 1, 1.4]) {
      assert.doesNotThrow(() => validateCaptureViews([{ ...captureView, season, zoom }]));
    }
  }
});

test('capture view validation still rejects malformed views, unsafe URLs and unsupported zooms', async () => {
  const { validateCaptureViews, captureSeasonIndex } = await import(modulePath);
  assert.throws(() => captureSeasonIndex('winter_snow'));
  for (const invalid of [null, [], [null], [captureView, captureView],
    ...[{ season: 'winter_snow' }, { season: 0 }, { zoom: 2 }, { zoom: '1.4' }, { tile: [0, Infinity] },
      { tile: [1] }, { name: '../escape' }, { state: '../escape' }, { width: 0 }, { height: 1.5 },
      { dpr: 0 }, { expectedRequests: [] }, { expectedRequests: ['//assets/foliage/tree_dead.png'] },
      { expectedRequests: ['/assets/../tree.png'] }, { expectedRequests: ['/assets/tree.png?x=1'] },
      { expectedRequests: ['/assets/definitely-absent-fixture.png'] }].map(patch => [{ ...captureView, ...patch }])]) {
    assert.throws(() => validateCaptureViews(invalid));
  }
});
