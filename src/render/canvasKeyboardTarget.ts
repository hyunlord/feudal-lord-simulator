/** Native controls own their keyboard gestures, even when a child receives the event. */
export function isCanvasKeyboardControl(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(
    'button, summary, input, textarea, select, a[href], [contenteditable]:not([contenteditable="false"]), [role="button"], [role="textbox"], .diagnostic-card',
  ) !== null;
}
