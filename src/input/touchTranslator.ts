import { canvasToWorld, type CameraState, type Point } from "../render/camera";
import { reportInputDevice } from "./inputDevice";
import type { InputIntent } from "./inputIntent";
import type { ArmedTools, MouseKeyboardTranslator, Outcome } from "./mouseKeyboardTranslator";

// Touch -> input intents (TOUCH-1, design master 13.1 rule 3; spec docs/design/input-intents.md IN-7). One finger
// drives the mouse translator's left button, so a finger does exactly what the mouse does on the same point (same
// canvas -> world path, same 4 px drag threshold, same tool rules): without a stroke tool a drag pans, with the road /
// zone / palisade tool it draws, a tap selects or places (a double tap is a double click: closes a zone polygon).
// On top of that:
//  - Two fingers always move the camera, tool or not: the midpoint's motion pans, the distance ratio zooms around the
//    midpoint. A second finger drops the one-finger press in progress (a stroke is cancelled, like a right click).
//  - A one-finger move over a page control (the build menu, a panel) is not passed on: the mouse's moves there go to
//    the control, not the canvas, so a mouse stroke does not follow the pointer under the UI and neither does a
//    finger (a touch keeps sending its moves to the canvas it started on). The release still ends the stroke at the
//    finger, as the window-level mouse up does.
//  - A one-finger hold of LONG_PRESS_MS without moving = `inspect` at that point (no stroke tool armed); its tap is
//    swallowed.
//  - A two-finger tap (both down and up within TWO_TAP_MS, moving less than TAP_SLOP) = cancel: the global cancel
//    (disarm, like Esc) while a tool is armed, else the cancel aimed at the map (the construction site there, like a
//    right click). A second finger that lands on a stroke in progress only drops that stroke (the right click
//    during a road drag), without the extra cancel.
//  - UX-3R2 (UX3R 8절): with a building tool armed one finger positions the ghost instead of panning — the ghost sits
//    PLACE_OFFSET_PX above the finger (so the finger never covers it); lifting ends the positioning with a `select`
//    at the ghost, which leaves the placement waiting for the confirm bar's ✓. Two fingers still move the camera.
// Everything is preventDefault-ed: the browser makes no mouse events or scrolling of its own on the canvas.

/** `covered`: a page control lies over the canvas at this point (the DOM binding hit-tests each move). */
type TouchPoint = { readonly clientX: number; readonly clientY: number; readonly covered?: boolean };
type CanvasRect = { readonly left: number; readonly top: number };

export type TouchTranslatorContext = {
  readonly bounds: () => CanvasRect;
  readonly camera: () => CameraState;
  readonly armed: () => ArmedTools;
  readonly emit: (intent: InputIntent) => boolean;
  readonly mouse: Pick<MouseKeyboardTranslator, "pointerDown" | "pointerMove" | "pointerUp" | "click" | "abortPress" | "swallowClick" | "pressing">;
  readonly now?: () => number;
  readonly setTimeout?: (callback: () => void, ms: number) => number;
  readonly clearTimeout?: (handle: number) => void;
};

export const LONG_PRESS_MS = 400;
export const TWO_TAP_MS = 300;
export const DOUBLE_TAP_MS = 350;
export const TAP_SLOP = 10;
export const PLACE_OFFSET_PX = 80;
const PREVENT: Outcome = { preventDefault: true };

type Mode =
  | { readonly kind: "idle" }
  | { readonly kind: "one"; readonly start: TouchPoint; last: TouchPoint; moved: boolean; timer: number | null; inspected: boolean }
  | { readonly kind: "place"; last: TouchPoint }
  | { readonly kind: "two"; readonly startedAt: number; readonly startMid: Point; readonly startDistance: number; mid: Point; distance: number; moved: boolean;
      /** The second finger dropped a one-finger press: that is the whole gesture, lifting both is no cancel tap. */
      readonly droppedPress: boolean };

export function createTouchTranslator(context: TouchTranslatorContext) {
  const now = context.now ?? (() => performance.now());
  const setTimer = context.setTimeout ?? ((callback: () => void, ms: number) => window.setTimeout(callback, ms));
  const clearTimer = context.clearTimeout ?? ((handle: number) => window.clearTimeout(handle));
  let mode: Mode = { kind: "idle" };
  let lastTap: { readonly at: number; readonly point: TouchPoint } | null = null;

  const local = (touch: TouchPoint): Point => { const rect = context.bounds(); return { x: touch.clientX - rect.left, y: touch.clientY - rect.top }; };
  const pairOf = (touches: readonly TouchPoint[]) => {
    const a = local(touches[0] as TouchPoint); const b = local(touches[1] as TouchPoint);
    return { mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) };
  };
  const strokeTool = () => { const armed = context.armed(); return armed.zone || armed.road || armed.palisade; };
  const stopTimer = () => { if (mode.kind === "one" && mode.timer !== null) { clearTimer(mode.timer); mode.timer = null; } };
  const above = (touch: TouchPoint): TouchPoint => ({ clientX: touch.clientX, clientY: touch.clientY - PLACE_OFFSET_PX });
  const positioning = () => { const armed = context.armed(); return armed.building === true && !strokeTool(); };
  const beginTwo = (touches: readonly TouchPoint[]) => {
    const droppedPress = mode.kind === "one" && context.mouse.pressing() && strokeTool();
    if (mode.kind === "one") { stopTimer(); context.mouse.abortPress(mode.last); }
    const { mid, distance } = pairOf(touches);
    mode = { kind: "two", startedAt: now(), startMid: mid, startDistance: distance, mid, distance, moved: false, droppedPress };
  };

  return {
    start(touches: readonly TouchPoint[]): Outcome {
      reportInputDevice("touch");
      if (touches.length >= 2) {
        if (mode.kind !== "two") beginTwo(touches);
        return PREVENT;
      }
      if (mode.kind !== "idle") return PREVENT;
      const touch = touches[0] as TouchPoint;
      if (positioning()) { mode = { kind: "place", last: touch }; context.mouse.pointerMove(above(touch)); lastTap = null; return PREVENT; }
      const double = lastTap !== null && now() - lastTap.at <= DOUBLE_TAP_MS
        && Math.hypot(lastTap.point.clientX - touch.clientX, lastTap.point.clientY - touch.clientY) <= TAP_SLOP * 2;
      context.mouse.pointerDown({ button: 0, clientX: touch.clientX, clientY: touch.clientY, detail: double ? 2 : 1 });
      const one: Mode = { kind: "one", start: touch, last: touch, moved: false, timer: null, inspected: false };
      mode = one;
      if (!strokeTool()) {
        one.timer = setTimer(() => {
          if (mode !== one || one.moved) return;
          one.timer = null;
          one.inspected = true;
          context.mouse.swallowClick();
          context.emit({ kind: "inspect", world: canvasToWorld(local(one.last), context.camera()) });
        }, LONG_PRESS_MS);
      }
      return PREVENT;
    },

    move(touches: readonly TouchPoint[]): Outcome {
      if (mode.kind === "place" && touches.length === 1) {
        const touch = touches[0] as TouchPoint;
        mode.last = touch;
        if (touch.covered !== true) context.mouse.pointerMove(above(touch));
        return PREVENT;
      }
      if (mode.kind === "one" && touches.length === 1) {
        const touch = touches[0] as TouchPoint;
        mode.last = touch;
        if (!mode.moved && Math.hypot(touch.clientX - mode.start.clientX, touch.clientY - mode.start.clientY) > TAP_SLOP) { mode.moved = true; stopTimer(); }
        if (touch.covered !== true) context.mouse.pointerMove(touch);
        return PREVENT;
      }
      if (touches.length >= 2) {
        if (mode.kind !== "two") { beginTwo(touches); return PREVENT; }
        const { mid, distance } = pairOf(touches);
        const dx = mid.x - mode.mid.x; const dy = mid.y - mode.mid.y;
        if (dx !== 0 || dy !== 0) context.emit({ kind: "pan", dx, dy });
        const factor = distance / mode.distance;
        if (Math.abs(factor - 1) > 1e-6) context.emit({ kind: "zoom", factor, anchor: mid });
        mode.mid = mid; mode.distance = distance;
        if (Math.hypot(mid.x - mode.startMid.x, mid.y - mode.startMid.y) > TAP_SLOP || Math.abs(distance - mode.startDistance) > TAP_SLOP) mode.moved = true;
      }
      return PREVENT;
    },

    end(remaining: number): Outcome {
      if (mode.kind === "place") {
        if (remaining > 0) return PREVENT;
        const ended = mode;
        mode = { kind: "idle" };
        context.emit({ kind: "select", world: canvasToWorld(local(above(ended.last)), context.camera()) });
        return PREVENT;
      }
      if (mode.kind === "one") {
        if (remaining > 0) return PREVENT;
        stopTimer();
        const ended = mode;
        mode = { kind: "idle" };
        context.mouse.pointerUp({ button: 0, clientX: ended.last.clientX, clientY: ended.last.clientY });
        if (!ended.inspected) context.mouse.click(ended.last);
        lastTap = ended.moved || ended.inspected ? null : { at: now(), point: ended.last };
        return PREVENT;
      }
      if (mode.kind === "two") {
        if (remaining > 0) return PREVENT;
        const ended = mode;
        mode = { kind: "idle" };
        lastTap = null;
        if (!ended.moved && !ended.droppedPress && now() - ended.startedAt <= TWO_TAP_MS) {
          const armed = context.armed();
          const busy = armed.zone || armed.road || armed.palisade || armed.tool === true || context.mouse.pressing();
          context.emit(busy ? { kind: "cancel" } : { kind: "cancel", world: canvasToWorld(ended.mid, context.camera()) });
        }
      }
      return PREVENT;
    },
  };
}

export type TouchTranslator = ReturnType<typeof createTouchTranslator>;
