import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { recordingCanvas } from '../scripts/recordingCanvas';

const pending: (() => void)[] = [];
class PathImage {
  naturalWidth = 512;
  naturalHeight = 64;
  width = 512;
  height = 64;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  label = '';
  decode() { return Promise.resolve(); }
  set src(value: string) { this.label = value; pending.push(() => this.onload?.()); }
}
const surfaces: ReturnType<typeof recordingCanvas>[] = [];
class ScratchCanvas {
  readonly surface: ReturnType<typeof recordingCanvas>;
  constructor(readonly width: number, readonly height: number) {
    this.surface = recordingCanvas(width, height); surfaces.push(this.surface);
  }
  getContext() { return this.surface.context; }
}
Object.defineProperty(globalThis, 'Image', { value: PathImage, configurable: true });
Object.defineProperty(globalThis, 'OffscreenCanvas', { value: ScratchCanvas, configurable: true });
const { wetPathCondition, drawWetPathOverlay } = await import('../src/render/footpathWet');
const { footpathChunkToken } = await import('../src/render/footpathDraw');
const { setPresentationPreference } = await import('../src/render/presentationPreferences');
const { DEFAULT_GAME_STATE } = await import('../src/state/gameStore');
const { ART_REGISTRY, selectLandArt } = await import('../src/render/art/wave42Registry');
const state = { ...DEFAULT_GAME_STATE, seed: 1, tick: 16999, width: 8, height: 8,
  tiles: Array.from({ length: 64 }, (_, cell) => ({ tx: cell % 8, ty: Math.floor(cell / 8), terrain: 'grass' as const, hasRoad: false, buildingId: null })),
  land: { footfall: [], footpaths: [9, 10, 11], fallow: [] } };

test('Given unloaded wet art When both images settle Then chunk readiness changes to the modeled wet stage', async () => {
  setPresentationPreference('weatherFx', true);
  const before = footpathChunkToken(state, { cx: 0, cy: 0 });
  assert.equal(wetPathCondition(state).stage, 0);
  for (const settle of pending.splice(0)) settle();
  await Promise.resolve();
  assert.equal(wetPathCondition(state).stage, 6);
  assert.notEqual(footpathChunkToken(state, { cx: 0, cy: 0 }), before);
});
test('Given wet chunks When weather effects turn off Then their tokens invalidate and overlay draw is a no-op', () => {
  const before = footpathChunkToken(state, { cx: 0, cy: 0 });
  setPresentationPreference('weatherFx', false);
  const disabled = wetPathCondition(state);
  assert.equal(disabled.stage, 0);
  assert.notEqual(footpathChunkToken(state, { cx: 0, cy: 0 }), before);
  const target = recordingCanvas(512, 64);
  drawWetPathOverlay(target.context, { axis: 'ne', line: 1 }, -128, 256, [], disabled.stage, 'summer');
  assert.deepEqual(target.canvas.ops, []);
  setPresentationPreference('weatherFx', true);
});
test('Given successive weather ticks When the stage is unchanged Then chunk tokens do not reraster each tick', () => {
  assert.equal(footpathChunkToken(state, { cx: 0, cy: 0 }), footpathChunkToken({ ...state, tick: 16998 }, { cx: 0, cy: 0 }));
  assert.notEqual(footpathChunkToken(state, { cx: 0, cy: 0 }), footpathChunkToken({ ...state, tick: 0 }, { cx: 0, cy: 0 }));
  assert.equal(footpathChunkToken(state, { cx: 4, cy: 4 }), '');
});
test('Given both axes and overlapping runs When composed Then native 512 UV sampling has identical world phase', () => {
  for (const axis of ['ne', 'nw'] as const) {
    for (const from of [-600, -128, 0, 128]) {
      const target = recordingCanvas(1024, 64);
      drawWetPathOverlay(target.context, { axis, line: 3 }, from, from + 600, [], 6, 'summer');
      const source = surfaces.at(-1);
      assert.ok(source);
      const first = Math.floor(from / 512) * 512 - from;
      assert.ok(source.canvas.ops.includes(`drawImage(/assets/wave42/paths/path_muddy_${axis}_summer.png,0,0,512,64,${first},0,512,64)`));
      assert.ok(target.canvas.ops.some(op => op.startsWith('drawImage(')));
    }
  }
});
test('Given summer strips When selected Then each source byte, pivot and nonmirrored scale match the authored contract', () => {
  const wet = ART_REGISTRY.entries('land-stage').filter(entry => entry.kind === 'land-stage' && entry.family === 'wet-path');
  assert.equal(wet.length, 2);
  for (const axis of ['ne', 'nw'] as const) {
    const entry = selectLandArt('wet-path-strip', { family: 'wet-path', stage: axis, season: 'summer' });
    const bytes = readFileSync(entry.provenance.inboxFile);
    assert.deepEqual(readFileSync(`public/${entry.image.url}`), bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.provenance.sourceSha256);
    assert.deepEqual(entry.geometry, { pivot: { x: 256, y: 32 }, scale: 0.5, allowMirror: false });
    assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], [512, 64]);
  }
  assert.equal(ART_REGISTRY.select('land-stage', 'wet-path-strip', { family: 'wet-path', stage: 'ne', season: 'winter' }, 0), null);
});
