type GameCanvasEventHandlers = {
  readonly resize: () => void;
  readonly keyDown: (event: KeyboardEvent) => void;
  readonly keyUp: (event: KeyboardEvent) => void;
  readonly blurWindow: () => void;
  readonly startDrag: (event: MouseEvent) => void;
  readonly movePointer: (event: MouseEvent) => void;
  readonly leaveCanvas: () => void;
  readonly clickCanvas: () => void;
  readonly wheel: (event: WheelEvent) => void;
  readonly finishDrag: (event: MouseEvent) => void;
};

type GameCanvasEventsInput = {
  readonly canvas: HTMLCanvasElement;
  readonly handlers: GameCanvasEventHandlers;
};

export function bindGameCanvasEvents(input: GameCanvasEventsInput): () => void {
  const { canvas, handlers } = input;
  window.addEventListener("resize", handlers.resize);
  window.addEventListener("keydown", handlers.keyDown);
  window.addEventListener("keyup", handlers.keyUp);
  window.addEventListener("blur", handlers.blurWindow);
  canvas.addEventListener("mousedown", handlers.startDrag);
  canvas.addEventListener("mousemove", handlers.movePointer);
  canvas.addEventListener("mouseleave", handlers.leaveCanvas);
  canvas.addEventListener("click", handlers.clickCanvas);
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
    canvas.removeEventListener("wheel", handlers.wheel);
    window.removeEventListener("mouseup", handlers.finishDrag);
  };
}
