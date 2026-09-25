import type { MouseKeyboardTranslator, Outcome } from "./mouseKeyboardTranslator";
import type { createZoneTouchTranslator } from "./zoneTouchTranslator";

// The only place that listens to DOM input events (B9 gate 1): each listener hands the event's plain data to a
// translator and applies what it asks for (preventDefault / stopImmediatePropagation). Nothing here knows the game.

type GameCanvasEventHandlers = {
  readonly resize: () => void;
  readonly keyDown: (event: KeyboardEvent) => void;
  readonly keyUp: (event: KeyboardEvent) => void;
  readonly blurWindow: () => void;
  readonly startDrag: (event: MouseEvent) => void;
  readonly movePointer: (event: MouseEvent) => void;
  readonly leaveCanvas: () => void;
  readonly clickCanvas: (event: MouseEvent) => void;
  readonly contextMenuCanvas: (event: MouseEvent) => void;
  readonly wheel: (event: WheelEvent) => void;
  readonly finishDrag: (event: MouseEvent) => void;
};

type EventSource = Pick<HTMLCanvasElement, "addEventListener" | "removeEventListener">;

export function bindGameCanvasEvents(input: { readonly canvas: EventSource; readonly handlers: GameCanvasEventHandlers }): () => void {
  const { canvas, handlers } = input;
  window.addEventListener("resize", handlers.resize);
  window.addEventListener("keydown", handlers.keyDown);
  window.addEventListener("keyup", handlers.keyUp);
  window.addEventListener("blur", handlers.blurWindow);
  canvas.addEventListener("mousedown", handlers.startDrag);
  canvas.addEventListener("mousemove", handlers.movePointer);
  canvas.addEventListener("mouseleave", handlers.leaveCanvas);
  canvas.addEventListener("click", handlers.clickCanvas);
  canvas.addEventListener("contextmenu", handlers.contextMenuCanvas);
  canvas.addEventListener("wheel", handlers.wheel, { passive: false });
  window.addEventListener("mouseup", handlers.finishDrag);

  return () => {
    window.removeEventListener("resize", handlers.resize);
    window.removeEventListener("keydown", handlers.keyDown);
    window.removeEventListener("keyup", handlers.keyUp);
    window.removeEventListener("blur", handlers.blurWindow);
    canvas.removeEventListener("mousedown", handlers.startDrag);
    canvas.removeEventListener("mousemove", handlers.movePointer);
    canvas.removeEventListener("mouseleave", handlers.leaveCanvas);
    canvas.removeEventListener("click", handlers.clickCanvas);
    canvas.removeEventListener("contextmenu", handlers.contextMenuCanvas);
    canvas.removeEventListener("wheel", handlers.wheel);
    window.removeEventListener("mouseup", handlers.finishDrag);
  };
}

function applyOutcome(event: Event, outcome: Outcome): void {
  if (outcome.preventDefault) event.preventDefault();
  if (outcome.stopImmediatePropagation === true) event.stopImmediatePropagation();
}

/** Mouse and keyboard on the game canvas / window -> the translator. `resize` is the window service's, passed through. */
export function bindMouseKeyboard(canvas: EventSource, translator: MouseKeyboardTranslator, resize: () => void): () => void {
  const key = (event: KeyboardEvent) => ({ code: event.code, key: event.key, repeat: event.repeat, target: event.target });
  const pointer = (event: MouseEvent) => ({ button: event.button, clientX: event.clientX, clientY: event.clientY, shiftKey: event.shiftKey, detail: event.detail });
  return bindGameCanvasEvents({
    canvas,
    handlers: {
      resize,
      keyDown: event => applyOutcome(event, translator.keyDown(key(event))),
      keyUp: event => applyOutcome(event, translator.keyUp(key(event))),
      blurWindow: () => translator.focusLost(),
      startDrag: event => applyOutcome(event, translator.pointerDown(pointer(event))),
      movePointer: event => applyOutcome(event, translator.pointerMove(pointer(event))),
      leaveCanvas: () => translator.leave(),
      clickCanvas: event => applyOutcome(event, translator.click(pointer(event))),
      contextMenuCanvas: event => applyOutcome(event, translator.contextMenu(pointer(event))),
      wheel: event => applyOutcome(event, translator.wheel({ clientX: event.clientX, clientY: event.clientY, deltaY: event.deltaY })),
      finishDrag: event => applyOutcome(event, translator.pointerUp(pointer(event))),
    },
  });
}

/** Touch on the game canvas -> the zone touch translator. */
export function bindZoneTouch(canvas: EventSource, translator: ReturnType<typeof createZoneTouchTranslator>): () => void {
  const points = (list: TouchList) => Array.from({ length: list.length }, (_, index) => list[index] as Touch).map(touch => ({ clientX: touch.clientX, clientY: touch.clientY }));
  const start = (event: TouchEvent) => applyOutcome(event, translator.start(points(event.touches)));
  const move = (event: TouchEvent) => applyOutcome(event, translator.move(points(event.touches)));
  const end = (event: TouchEvent) => applyOutcome(event, translator.end(event.touches.length));
  canvas.addEventListener("touchstart", start, { passive: false });
  canvas.addEventListener("touchmove", move, { passive: false });
  canvas.addEventListener("touchend", end, { passive: false });
  canvas.addEventListener("touchcancel", end, { passive: false });
  return () => {
    canvas.removeEventListener("touchstart", start);
    canvas.removeEventListener("touchmove", move);
    canvas.removeEventListener("touchend", end);
    canvas.removeEventListener("touchcancel", end);
  };
}
