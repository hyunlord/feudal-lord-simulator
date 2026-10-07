import assert from 'node:assert/strict';
import test from 'node:test';
import { ArtRegistryStore, createArtRegistry } from '../src/render/art/artRegistry';

const entry = {
  id: 'cart-ne', kind: 'walker-transport', group: 'handcart', facing: 'ne',
  image: { url: 'assets/cart.png', width: 384, height: 148 },
  provenance: { inboxFile: 'assets-inbox/cart.png', sourceSha256: 'a'.repeat(64), runtimeSha256: 'b'.repeat(64) },
  frameSelection: 'gait', scale: 17.6 / 71, referenceFigureHeight: 17.6, allowMirror: false,
  mountOffset: { x: 0.5, y: -8.8 }, payloadAnchor: { x: 39.5, y: 36.5 }, payloadWidth: 39.05,
  frames: [0, 1].map(gaitFrame => ({ gaitFrame, sourceRect: { x: 0, y: gaitFrame * 74, width: 96, height: 74 }, pivot: { x: 72.5, y: 10.5 } })),
};
const bundle = { schemaVersion: 1, packId: 'core', bundleId: 'transport', entries: [entry], rules: [] };

test('accepts gait-driven transport mounted relative to the actor foot', () => {
  const registry = createArtRegistry([bundle]);
  assert.deepEqual(registry.entry(entry.id), entry);
});

for (const [name, changes] of [
  ['outside crop', { frames: [{ ...entry.frames[0], sourceRect: { x: 380, y: 0, width: 96, height: 74 } }, entry.frames[1]] }],
  ['outside pivot', { frames: [{ ...entry.frames[0], pivot: { x: 120, y: 1 } }, entry.frames[1]] }],
  ['duplicate gait', { frames: [entry.frames[0], entry.frames[0]] }],
  ['missing gait', { frames: [entry.frames[0]] }],
  ['unknown gait', { frames: [{ ...entry.frames[0], gaitFrame: 2 }, entry.frames[1]] }],
  ['clock selection', { frameSelection: 'clock' }],
  ['invalid facing', { facing: 'up' }],
  ['zero scale', { scale: 0 }],
  ['mirroring', { allowMirror: true }],
  ['payload outside cell', { payloadAnchor: { x: 100, y: 20 } }],
  ['negative payload width', { payloadWidth: -1 }],
  ['overflow mount', { mountOffset: { x: Number.MAX_VALUE, y: 0 }, referenceFigureHeight: Number.MIN_VALUE }],
] as const) test(`rejects ${name} atomically`, () => {
  const store = new ArtRegistryStore([bundle]); const previous = store.registry;
  assert.throws(() => store.replace([{ ...bundle, entries: [{ ...entry, ...changes }] }]));
  assert.equal(store.registry, previous);
});

test('selects all eight native cells with fixed mounts and padding-independent payload width', async () => {
  const { ART_REGISTRY } = await import('../src/render/art/wave42Registry');
  const { walkerTransportPlacement } = await import('../src/render/art/walkerTransportPlacement');
  const { checkCatalogFiles } = await import('../scripts/checkArtCatalog');
  const entries = ART_REGISTRY.entries('walker-transport');
  assert.equal(entries.length, 4);
  for (const facing of ['ne', 'se', 'sw', 'nw']) {
    const selected = ART_REGISTRY.select('walker-transport', 'walker-handcart', { group: 'handcart', facing }, 0);
    assert.ok(selected?.kind === 'walker-transport');
    const first = walkerTransportPlacement(selected, { x: 32, y: 32 }, 0, 17.6);
    const second = walkerTransportPlacement(selected, { x: 32, y: 32 }, 1, 17.6);
    assert.deepEqual(first.targetRect, second.targetRect);
    assert.deepEqual(first.payload, second.payload);
    assert.equal(first.sourceRect.y, 0);
    assert.equal(second.sourceRect.y, 74);
    assert.equal(first.sourceRect.x, ['ne', 'se', 'sw', 'nw'].indexOf(facing) * 96);
    assert.ok(Math.abs(first.payload.width - 9.68) < 1e-10);
    assert.ok(Math.abs(first.targetRect.width / 96 - first.targetRect.height / 74) < 1e-10);
    const doubled = walkerTransportPlacement(selected, { x: 64, y: 64 }, 1, 35.2);
    assert.deepEqual(doubled.payload, { x: second.payload.x * 2, y: second.payload.y * 2, width: second.payload.width * 2 });
  }
  assert.ok(checkCatalogFiles(process.cwd(), [{ schemaVersion: 1, bundleId: 'files', entries, rules: [] }]).every(result => result.errors.length === 0));
});

test('transport image load failure leaves pixels unavailable for legacy fallback', async () => {
  const { createTransportArt } = await import('../src/render/runtimeTransportAssets');
  const { ART_REGISTRY } = await import('../src/render/art/wave42Registry');
  const source: HTMLImageElement = Object.create(null);
  Object.assign(source, { naturalWidth: 384, naturalHeight: 148, src: '', onload: null, onerror: null, decode: () => Promise.resolve() });
  const transport = createTransportArt(ART_REGISTRY, { createImage: () => source, baseUrl: '/' });
  const calls: unknown[][] = [];
  const context = { imageSmoothingEnabled: false, save() {}, restore() {}, drawImage: (...args: unknown[]) => calls.push(args), getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) };
  const presentation = { direction: 'NE', gaitFrame: 1 } as const;
  assert.equal(transport.draw(context, presentation, 0, 0, 0.55), null);
  source.onerror?.call(source, new Event('error'));
  assert.equal(transport.draw(context, presentation, 0, 0, 0.55), null);
  assert.deepEqual(calls, []);
});

test('decoded transport draws the exact gait crop without independent timing or mirroring', async () => {
  const { createTransportArt } = await import('../src/render/runtimeTransportAssets');
  const { ART_REGISTRY } = await import('../src/render/art/wave42Registry');
  const source: HTMLImageElement = Object.create(null);
  Object.assign(source, { naturalWidth: 384, naturalHeight: 148, src: '', onload: null, onerror: null, decode: () => Promise.resolve() });
  const transport = createTransportArt(ART_REGISTRY, { createImage: () => source, baseUrl: '/' });
  const calls: unknown[][] = [];
  const context = { imageSmoothingEnabled: false, save() {}, restore() {}, drawImage: (...args: unknown[]) => calls.push(args), getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) };
  const presentation = { direction: 'SW', gaitFrame: 1 } as const;
  assert.equal(transport.draw(context, presentation, 100, 200, 0.55), null);
  source.onload?.call(source, new Event('load')); await Promise.resolve();
  const drawn = transport.draw(context, presentation, 100, 200, 0.55);
  assert.ok(drawn);
  assert.deepEqual(calls[0]?.slice(0, 5), [source, 192, 74, 96, 74]);
  assert.ok(Math.abs(drawn.payload.width - 9.68) < 1e-10);
});
