import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import type { GameState } from '../src/engine/engine.types';

class TestImage {
  naturalWidth = 0; naturalHeight = 0; width = 0; height = 0;
  onload: (() => void) | null = null; onerror: (() => void) | null = null;
  url = '';
  set src(url: string) {
    this.url = url;
    try {
      const bytes = readFileSync(`public${url}`);
      this.naturalWidth = this.width = bytes.readUInt32BE(16);
      this.naturalHeight = this.height = bytes.readUInt32BE(20);
      queueMicrotask(() => this.onload?.());
    } catch { queueMicrotask(() => this.onerror?.()); }
  }
  decode() { return Promise.resolve(); }
}
const calls: unknown[][] = [];
const context: CanvasRenderingContext2D = Object.assign(Object.create(null), {
  globalAlpha: 1, imageSmoothingEnabled: true,
  drawImage: (...args: unknown[]) => calls.push(args),
  getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
  save() {}, restore() {}, setTransform() {}, clearRect() {}, scale() {}, fillRect() {},
  beginPath() {}, ellipse() {}, fill() {}, translate() {},
});
class TestCanvas {
  constructor(readonly width: number, readonly height: number) {}
  getContext() { return context; }
}
const imageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'Image');
const canvasDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'OffscreenCanvas');
Object.defineProperty(globalThis, 'Image', { value: TestImage, configurable: true });

// Canvas calls, file dimensions and loading boundary are real consumers; pixels remain browser-proof work.
test('both carter consumers retain real gait, body readiness, and directional draw order', async () => {
  try {
    const { drawRuntimeActor, preloadRuntimeActorAssets } = await import('../src/render/runtimeActorAssets');
    const { drawWalker } = await import('../src/render/drawWalkers');
    const { TRANSPORT_ART } = await import('../src/render/runtimeTransportAssets');
    const { composedWalkerReady } = await import('../src/render/walkerComposer');
    const { walkerPresentationFor } = await import('../src/render/walkerPresentation');
    const directions = ['NE', 'SE', 'SW', 'NW'] as const;
    for (const direction of ['NE'] as const) {
      const selected = TRANSPORT_ART.select({ direction }); assert.ok(selected);
      await TRANSPORT_ART.adapters.loadSettled(selected.id);
    }
    calls.length = 0;
    assert.equal(drawRuntimeActor(context, { role: 'carter', direction: 'NE', gaitFrame: 0 }, 32, 32, 0.55, 1, true), false);
    assert.equal(calls.length, 0, 'loaded cart cannot appear without actor body');
    await preloadRuntimeActorAssets();
    calls.length = 0;
    assert.equal(drawRuntimeActor(context, { role: 'carter', direction: 'SW', gaitFrame: 1 }, 32, 32, 0.55, 1, true), true);
    assert.ok(calls.some(call => call[0] instanceof TestImage && call[0].url.includes('cart_hand')), 'legacy cart remains while replacement loads');
    for (const direction of directions) {
      const selected = TRANSPORT_ART.select({ direction }); assert.ok(selected);
      await TRANSPORT_ART.adapters.loadSettled(selected.id);
    }
    for (const direction of directions) for (const gaitFrame of [0, 1] as const) {
      calls.length = 0;
      const payloads: number[] = [];
      assert.equal(drawRuntimeActor(context, { role: 'carter', direction, gaitFrame }, 32, 32, 0.55, 1, true, payload => payloads.push(payload.width)), true);
      const cartIndex = calls.findIndex(call => call[0] instanceof TestImage && call[0].url.includes('handcart_body-v2'));
      assert.equal(cartIndex, direction === 'SE' || direction === 'SW' ? 0 : 1);
      assert.deepEqual(calls[cartIndex]?.slice(1, 5), [directions.indexOf(direction) * 96, gaitFrame * 74, 96, 74]);
      assert.equal(payloads.length, 1); assert.ok(Math.abs((payloads[0] ?? 0) - 9.68) < 1e-10);
    }
    Object.defineProperty(globalThis, 'OffscreenCanvas', { value: TestCanvas, configurable: true });
    const state: GameState = JSON.parse(gunzipSync(readFileSync('docs/verification/v2-walkers/scene/seed2-summer.json.gz')).toString());
    const carter = state.walkers.find(walker => walker.kind === 'carter'); assert.ok(carter);
    const original = JSON.stringify(carter);
    composedWalkerReady(state, carter); await Promise.resolve();
    assert.equal(composedWalkerReady(state, carter), true);
    const presentation = walkerPresentationFor(carter);
    for (const cargo of [null, carter.cargo]) {
      calls.length = 0;
      drawWalker(context, { ...carter, cargo }, 1, 'normal', state);
      const cartCall = calls.find(call => call[0] instanceof TestImage && call[0].url.includes('handcart_body-v2'));
      assert.ok(cartCall, 'composed carter draws the installed cart for loaded and empty trips');
      assert.deepEqual(cartCall.slice(1, 5), [directions.indexOf(presentation.direction) * 96, presentation.gaitFrame * 74, 96, 74]);
    }
    assert.equal(JSON.stringify(carter), original, 'drawing preserves engine cargo and movement facts');
  } finally {
    if (imageDescriptor) Object.defineProperty(globalThis, 'Image', imageDescriptor); else Reflect.deleteProperty(globalThis, 'Image');
    if (canvasDescriptor) Object.defineProperty(globalThis, 'OffscreenCanvas', canvasDescriptor); else Reflect.deleteProperty(globalThis, 'OffscreenCanvas');
  }
});
