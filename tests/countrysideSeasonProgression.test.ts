import assert from 'node:assert/strict';
import test from 'node:test';
import { recordingCanvas } from '../scripts/recordingCanvas';
import { DEFAULT_GAME_STATE } from '../src/state/gameStore';
import { drawCountrysideItem } from '../src/render/countrysideDraw';
import { treeProgression } from '../src/render/seasonProgression';
import { calendarProgress } from '../src/render/calendarProgress';
import { preloadCountryArt } from '../src/render/countrysideArt';

class LoadedImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  label = '';
  set src(value: string) { this.label = value; queueMicrotask(() => this.onload?.()); }
}

test('a bare countryside oak and willow never borrow autumn art while waiting for snow', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'Image');
  Object.defineProperty(globalThis, 'Image', { configurable: true, value: LoadedImage });
  try {
    preloadCountryArt();
    await new Promise<void>(resolve => queueMicrotask(resolve));
    const state = { ...DEFAULT_GAME_STATE, tick: 3200 };
    const id = Array.from({ length: 1000 }, (_, index) => `tree-${index}`)
      .find(identity => !treeProgression(calendarProgress(state), identity).snowy);
    assert.notEqual(id, undefined);
    if (id === undefined) throw new Error('The leaf-fall-before-snow transition must remain testable');
    assert.equal(treeProgression(calendarProgress(state), id).season, 3);
    for (const family of ['oak_solitary', 'willow_pollard'] as const) {
      const target = recordingCanvas(1280, 800);
      drawCountrysideItem(target.context, { kind: 'countryside', id, depth: 20, anchorTx: 10,
        piece: { id, family, tx: 10, ty: 10, cells: [], salt: 0 } }, state, 1);
      const draws = target.canvas.ops.filter(op => op.startsWith('drawImage('));
      assert.equal(draws.length, 1);
      assert.ok(draws[0]?.includes(`${family}_winter.png`), draws.join('\n'));
    }
    const spring = { ...state, tick: 4270 };
    const springId = Array.from({ length: 1000 }, (_, index) => `tree-${index}`)
      .find(identity => treeProgression(calendarProgress(spring), identity).season === 3);
    if (springId === undefined) throw new Error('The bare early-spring interval must remain testable');
    assert.equal(treeProgression(calendarProgress(spring), springId).snowy, false);
    const target = recordingCanvas(1280, 800);
    drawCountrysideItem(target.context, { kind: 'countryside', id: springId, depth: 20, anchorTx: 10,
      piece: { id: springId, family: 'haystack', tx: 10, ty: 10, cells: [], salt: 0 } }, spring, 1);
    assert.ok(target.canvas.ops.some(op => op.includes('haystack_winter.png')), target.canvas.ops.join('\n'));
  } finally {
    if (original === undefined) Reflect.deleteProperty(globalThis, 'Image');
    else Object.defineProperty(globalThis, 'Image', original);
  }
});
