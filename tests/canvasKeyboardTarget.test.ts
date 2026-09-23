import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { isCanvasKeyboardControl } from '../src/render/canvasKeyboardTarget';

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

test('runtime ignores native-control keydown but always releases held camera and Space state before keyup guard', () => {
  // Given
  const source = readFileSync(new URL('../src/render/useGameCanvasRuntime.ts', import.meta.url), 'utf8');
  const down = source.slice(source.indexOf('const keyDown ='), source.indexOf('const keyUp ='));
  const up = source.slice(source.indexOf('const keyUp ='), source.indexOf('const leaveCanvas ='));
  // When / Then
  assert.ok(down.indexOf('isCanvasKeyboardControl') < down.indexOf('cameraInputKeyDown'));
  assert.ok(up.indexOf('cameraInputKeyUp') < up.indexOf('isCanvasKeyboardControl'));
  assert.ok(up.indexOf('refs.spacePressed.current = false') < up.indexOf('isCanvasKeyboardControl'));
});
