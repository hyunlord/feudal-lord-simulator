import assert from 'node:assert/strict';
import test from 'node:test';
import { bindGameCanvasEvents } from '../src/input/domInputBindings';

test('wheel and context menu prevent browser defaults only on canvas and release on cleanup', () => {
  // Given
  const canvas = new EventTarget();
  const page = new EventTarget();
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: page });
  const noop = () => {};
  const cancel = (event: Event) => event.preventDefault();
  const cleanup = bindGameCanvasEvents({ canvas, handlers: {
    resize: noop, keyDown: noop, keyUp: noop, blurWindow: noop, startDrag: noop,
    movePointer: noop, leaveCanvas: noop, clickCanvas: noop, finishDrag: noop,
    wheel: cancel, contextMenuCanvas: cancel,
  } });
  try {
    // When
    for (const type of ['wheel', 'contextmenu']) {
      const onCanvas = new Event(type, { cancelable: true });
      const outsideCanvas = new Event(type, { cancelable: true });
      canvas.dispatchEvent(onCanvas);
      page.dispatchEvent(outsideCanvas);
      // Then
      assert.equal(onCanvas.defaultPrevented, true);
      assert.equal(outsideCanvas.defaultPrevented, false);
    }
    cleanup();
    for (const type of ['wheel', 'contextmenu']) {
      const afterUnmount = new Event(type, { cancelable: true });
      canvas.dispatchEvent(afterUnmount);
      assert.equal(afterUnmount.defaultPrevented, false);
    }
  } finally {
    cleanup();
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
