import assert from 'node:assert/strict';
import test from 'node:test';
import { isCanvasKeyboardControl } from '../src/render/canvasKeyboardTarget';
import { createMouseKeyboardTranslator } from '../src/input/mouseKeyboardTranslator';

class TargetElement extends EventTarget {
  constructor(readonly selector: string) { super(); }
  closest(selectors: string): TargetElement | null {
    return selectors.split(', ').includes(this.selector) ? this : null;
  }
}

test('native controls retain keyboard gestures while canvas and body use game input', () => {
  // Given: a narrow DOM boundary probe; actual browser activation is covered by UI QA.
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'Element');
  Object.defineProperty(globalThis, 'Element', { configurable: true, value: TargetElement });
  try {
    // When / Then
    for (const selector of ['button', 'summary', 'input', 'textarea', 'select', 'a[href]', '[role="button"]', '[role="textbox"]', '[contenteditable]:not([contenteditable="false"])', '.diagnostic-card']) {
      assert.equal(isCanvasKeyboardControl(new TargetElement(selector)), true, selector);
    }
    for (const selector of ['canvas', 'body']) assert.equal(isCanvasKeyboardControl(new TargetElement(selector)), false);
    assert.equal(isCanvasKeyboardControl(null), false);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'Element', previous);
    else Reflect.deleteProperty(globalThis, 'Element');
  }
});

test('translator ignores native-control keydown but always releases held camera and Space state on keyup', () => {
  // Given: a button has focus (B9: the keyboard translator owns what the runtime keyDown/keyUp used to check)
  const button = { closest: () => ({}) };
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'Element');
  Object.defineProperty(globalThis, 'Element', { configurable: true, value: class { closest() { return null; } } });
  Object.setPrototypeOf(button, (globalThis as unknown as { Element: { prototype: object } }).Element.prototype);
  const pans: unknown[] = [];
  let camera = { zoom: 1, panX: 0, panY: 0 };
  // UI-6c: the key times on the frames' clock. With the real performance.now() the keyup landed wherever the process
  // clock stood; on a loaded DGX it fell 1.7–2.0 s in, inside the last frame's 300 ms release glide, and that frame
  // panned (reproduced with a busy-wait before the test: fails from 1.6 s of delay, passes with this clock).
  let clock = 984;
  const translator = createMouseKeyboardTranslator({
    now: () => clock,
    bounds: () => ({ left: 0, top: 0, width: 800, height: 600 }), camera: () => camera, world: () => ({ minX: -4000, minY: -4000, maxX: 4000, maxY: 4000 }),
    armed: () => ({ zone: false, zonePolygon: false, palisade: false, road: false }),
    emit: intent => { if (intent.kind === 'pan') { pans.push(intent); camera = { ...camera, panX: camera.panX + intent.dx }; } return true; },
    // F3-A (INSTALL-3b's hand-over): the keys' own clock, before the fake frames (the real clock ran past them on a
    // loaded host, and the key let go at 2 s read as still held).
    now: () => 500,
  });
  try {
    // When: a camera key goes down on the button, then Space and the key go up anywhere
    const down = translator.keyDown({ code: 'KeyD', key: 'd', target: button as unknown as EventTarget });
    translator.frame(1_000, 984, { width: 800, height: 600 });
    // Then: nothing moved, and nothing is held
    assert.equal(down.preventDefault, false);
    assert.deepEqual(pans, []);
    clock = 1_000;
    translator.keyDown({ code: 'KeyD', key: 'd', target: null });
    translator.frame(1_016, 1_000, { width: 800, height: 600 });
    assert.equal(pans.length, 1, 'control: the same key on the map pans');
    // Released just after that frame: the last frame is past the 300 ms release glide, so a pan there means still held.
    clock = 1_016;
    translator.keyUp({ code: 'KeyD', key: 'd', target: button as unknown as EventTarget });
    translator.frame(2_000, 1_984, { width: 800, height: 600 });
    assert.equal(pans.length, 1, 'keyup on a control still releases the held key');
  } finally {
    if (previous) Object.defineProperty(globalThis, 'Element', previous);
    else Reflect.deleteProperty(globalThis, 'Element');
  }
});
