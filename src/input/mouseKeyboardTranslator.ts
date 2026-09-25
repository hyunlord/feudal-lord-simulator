import { canvasToWorld, clientToCanvas, type CameraState, type Point, type WorldBounds } from "../render/camera";
import { isCanvasKeyboardControl } from "../render/canvasKeyboardTarget";
import {
  advanceCameraMotion, cameraDragThresholdExceeded, cameraInputKeyDown, cameraInputKeyUp, createCameraInputState,
  resetCameraInputState, updateCameraEdgePoint,
} from "../render/gameCanvasRuntimeInput";
import type { IntentContext, IntentTarget } from "./intentBus";
import type { InputIntent, StrokeToolId } from "./inputIntent";

// Mouse and keyboard -> input intents (B9). This module owns everything that is about the device: which button is
// down, Space held, the 4 px drag threshold, the click a drag must swallow, held camera keys and edge scrolling, and
// the key bindings. It decides nothing about the game: it asks `armed()` which drawing tool a left press starts and
// hands the handlers plain intents. The translation table is in docs/design/input-intents.md.
//  - Left press: zone brush (unless Space is held; Shift or the polygon toggle adds a polygon vertex, a double click
//    closes the polygon = confirm), else the palisade draft (the handler may decline: then it pans), else Space /
//    no road tool = pan, else a road stroke. Middle press pans. Right press during a road stroke is ignored.
//  - A pan emits `pan` deltas once the pointer has moved 4 px, anchored to the camera at the first move (so a pan
//    that hits the map edge and comes back tracks the pointer as before). Any drag past 4 px swallows its click.
//  - Right click (contextmenu) = cancel aimed at the map; a road stroke it cancels swallows the rest of that press.
//  - Keys: Esc cancel, Z undo, [ ] brush size, O problem view, 1-4 overlays, Enter confirm, Q / E tool step,
//    + / - zoom at the view centre, Space held = pan with the left button, Space tap = pause, WASD / arrows camera.

export type ArmedTools = {
  readonly zone: boolean;
  /** The zone brush is in polygon mode (the toggle, or a polygon already started). */
  readonly zonePolygon: boolean;
  readonly palisade: boolean;
  readonly road: boolean;
};

type CanvasRect = { readonly left: number; readonly top: number; readonly width: number; readonly height: number };

export type TranslatorContext = {
  readonly bounds: () => CanvasRect;
  readonly camera: () => CameraState;
  readonly world: () => WorldBounds;
  readonly armed: () => ArmedTools;
  readonly emit: (intent: InputIntent, context?: IntentContext) => boolean;
  readonly setTimeout?: (callback: () => void, ms: number) => number;
  readonly clearTimeout?: (handle: number) => void;
};

export type PointerData = {
  readonly button: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly shiftKey?: boolean;
  /** Click count of this press (2 = double click). */
  readonly detail?: number;
};
export type WheelData = { readonly clientX: number; readonly clientY: number; readonly deltaY: number };
export type KeyData = { readonly code: string; readonly key: string; readonly repeat?: boolean; readonly target: EventTarget | null };
/** What the DOM binding must do with the event. */
export type Outcome = { readonly preventDefault: boolean; readonly stopImmediatePropagation?: boolean };

type Gesture =
  | { readonly kind: "pan"; readonly start: Point; startCamera: CameraState | null; moved: boolean }
  | { readonly kind: "stroke"; readonly tool: StrokeToolId; readonly start: Point; moved: boolean };

const NONE: Outcome = { preventDefault: false };
const PREVENT: Outcome = { preventDefault: true };
const ZOOM_IN = 1.1;
const ZOOM_OUT = 0.9;
const OVERLAY_SLOTS: Readonly<Record<string, 1 | 2 | 3 | 4>> = { Digit1: 1, Digit2: 2, Digit3: 3, Digit4: 4 };
const ZOOM_KEYS: Readonly<Record<string, number>> = { Equal: ZOOM_IN, NumpadAdd: ZOOM_IN, Minus: ZOOM_OUT, NumpadSubtract: ZOOM_OUT };
const TOOL_STEP_KEYS: Readonly<Record<string, -1 | 1>> = { KeyQ: -1, KeyE: 1 };

export type MouseKeyboardTranslator = ReturnType<typeof createMouseKeyboardTranslator>;

export function createMouseKeyboardTranslator(context: TranslatorContext) {
  const cameraInput = createCameraInputState();
  const setTimer = context.setTimeout ?? ((callback: () => void, ms: number) => window.setTimeout(callback, ms));
  const clearTimer = context.clearTimeout ?? ((handle: number) => window.clearTimeout(handle));
  let gesture: Gesture | null = null;
  let space = false;
  /** Space went down and nothing was dragged while it was held: releasing it is a tap (pause). */
  let spaceTap = false;
  /** A road stroke was cancelled mid-press: the rest of that press does nothing. */
  let strokeCancelled = false;
  let suppressClick = false;
  let suppressTimer: number | null = null;

  const canvasPoint = (pointer: { readonly clientX: number; readonly clientY: number }): Point => clientToCanvas(pointer, context.bounds());
  const worldAt = (point: Point) => canvasToWorld(point, context.camera());
  const clearSuppressTimer = () => { if (suppressTimer !== null) { clearTimer(suppressTimer); suppressTimer = null; } };
  const targetOf = (target: EventTarget | null): IntentTarget => {
    if (target === null || typeof Element === "undefined") return "world";
    if (typeof HTMLElement !== "undefined" && target instanceof HTMLElement
      && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return "text";
    return isCanvasKeyboardControl(target) ? "control" : "world";
  };
  /** Esc / right click while a road stroke is held: the handler drops the preview, the press is spent. */
  const cancelRoadStroke = () => {
    if (gesture?.kind !== "stroke" || gesture.tool !== "road") return;
    gesture = null;
    strokeCancelled = true;
    suppressClick = true;
  };

  return {
    /** A pan gesture is in progress (keyboard and edge scrolling wait for it). */
    panning: () => gesture?.kind === "pan",

    pointerDown(pointer: PointerData): Outcome {
      if (pointer.button === 2 && gesture?.kind === "stroke" && gesture.tool === "road") return NONE;
      if (pointer.button === 0) strokeCancelled = false;
      spaceTap = false;
      const point = canvasPoint(pointer);
      updateCameraEdgePoint(cameraInput, point);
      context.emit({ kind: "point", screen: point });
      const world = worldAt(point);
      const armed = context.armed();
      if (pointer.button === 0 && armed.zone && !space) {
        const polygon = armed.zonePolygon || pointer.shiftKey === true;
        if (polygon && (pointer.detail ?? 0) >= 2) context.emit({ kind: "confirm" });
        else context.emit({ kind: "strokeBegin", toolId: "zone", world, polygon });
        if (!polygon) gesture = { kind: "stroke", tool: "zone", start: point, moved: false };
        suppressClick = true;
        return PREVENT;
      }
      if (pointer.button === 0 && armed.palisade && context.emit({ kind: "strokeBegin", toolId: "palisade", world })) {
        gesture = { kind: "stroke", tool: "palisade", start: point, moved: false };
        return PREVENT;
      }
      if (pointer.button === 1 || (pointer.button === 0 && (space || !armed.road))) {
        gesture = { kind: "pan", start: point, startCamera: null, moved: false };
        return PREVENT;
      }
      if (pointer.button === 0) {
        context.emit({ kind: "strokeBegin", toolId: "road", world });
        gesture = { kind: "stroke", tool: "road", start: point, moved: false };
        return NONE;
      }
      gesture = null;
      return NONE;
    },

    pointerMove(pointer: Pick<PointerData, "clientX" | "clientY">): Outcome {
      const point = canvasPoint(pointer);
      updateCameraEdgePoint(cameraInput, point);
      context.emit({ kind: "point", screen: point });
      if (gesture === null) return NONE;
      gesture.moved = gesture.moved || cameraDragThresholdExceeded(gesture.start, point);
      if (gesture.kind === "stroke") {
        context.emit({ kind: "strokeMove", world: worldAt(point) });
      } else {
        const camera = context.camera();
        gesture.startCamera ??= camera;
        if (gesture.moved) {
          context.emit({ kind: "pan", dx: gesture.startCamera.panX + point.x - gesture.start.x - camera.panX,
            dy: gesture.startCamera.panY + point.y - gesture.start.y - camera.panY });
        }
      }
      if (gesture.moved) { suppressClick = true; spaceTap = false; }
      return NONE;
    },

    pointerUp(pointer: PointerData): Outcome {
      if (strokeCancelled && pointer.button !== 0) return NONE;
      const cancelled = strokeCancelled;
      strokeCancelled = false;
      const ended = gesture;
      gesture = null;
      if (ended?.kind === "stroke") {
        const rect = context.bounds();
        const outside = !(pointer.clientX >= rect.left && pointer.clientX < rect.left + rect.width
          && pointer.clientY >= rect.top && pointer.clientY < rect.top + rect.height);
        context.emit({ kind: "strokeEnd", world: worldAt(canvasPoint(pointer)), ...(outside ? { outside: true } : {}) });
      }
      clearSuppressTimer();
      if (!(cancelled || (ended?.moved ?? false))) { suppressClick = false; return NONE; }
      suppressClick = true;
      suppressTimer = setTimer(() => { suppressClick = false; suppressTimer = null; }, 0);
      return NONE;
    },

    click(pointer: Pick<PointerData, "clientX" | "clientY">): Outcome {
      if (suppressClick) { suppressClick = false; clearSuppressTimer(); return NONE; }
      if (space || gesture !== null) return NONE;
      context.emit({ kind: "select", world: worldAt(canvasPoint(pointer)) });
      return NONE;
    },

    contextMenu(pointer: Pick<PointerData, "clientX" | "clientY">): Outcome {
      cancelRoadStroke();
      context.emit({ kind: "cancel", world: worldAt(canvasPoint(pointer)) });
      return PREVENT;
    },

    wheel(wheel: WheelData): Outcome {
      context.emit({ kind: "zoom", factor: wheel.deltaY > 0 ? ZOOM_OUT : ZOOM_IN, anchor: canvasPoint(wheel) });
      return PREVENT;
    },

    leave(): void {
      updateCameraEdgePoint(cameraInput, null);
      context.emit({ kind: "point", screen: null });
    },

    focusLost(): void {
      resetCameraInputState(cameraInput);
      space = false;
      spaceTap = false;
      suppressClick = false;
      clearSuppressTimer();
      gesture = null;
      context.emit({ kind: "focusLost" });
    },

    keyDown(key: KeyData): Outcome {
      const target = targetOf(key.target);
      const at = { target };
      if (key.code === "Escape") {
        if (target === "world") cancelRoadStroke();
        const consumed = context.emit({ kind: "cancel" }, at);
        return { preventDefault: true, stopImmediatePropagation: consumed };
      }
      if (key.code === "KeyZ") return { preventDefault: context.emit({ kind: "undo" }, at) };
      if (key.code === "BracketLeft" || key.code === "BracketRight") {
        return { preventDefault: context.emit({ kind: "brushSize", step: key.code === "BracketRight" ? 1 : -1 }, at) };
      }
      if (key.code === "KeyO") {
        if (key.repeat === true || target === "text") return NONE;
        return { preventDefault: context.emit({ kind: "problemView" }, at) };
      }
      const slot = OVERLAY_SLOTS[key.code];
      if (slot !== undefined) return { preventDefault: context.emit({ kind: "overlayToggle", slot }, at) };
      if (target !== "world") return NONE;
      if (key.code === "Enter") return { preventDefault: context.emit({ kind: "confirm" }, at) };
      const step = TOOL_STEP_KEYS[key.code];
      if (step !== undefined) return { preventDefault: context.emit({ kind: "toolStep", step }, at) };
      const factor = ZOOM_KEYS[key.code];
      if (factor !== undefined) {
        const rect = context.bounds();
        return { preventDefault: context.emit({ kind: "zoom", factor, anchor: { x: rect.width / 2, y: rect.height / 2 } }, at) };
      }
      const cameraKey = cameraInputKeyDown(cameraInput, key.key, performance.now());
      if (key.code === "Space") {
        if (!space && key.repeat !== true) spaceTap = true;
        space = true;
      } else if (space) spaceTap = false;
      return { preventDefault: key.code === "Space" || cameraKey };
    },

    keyUp(key: KeyData): Outcome {
      const cameraKey = cameraInputKeyUp(cameraInput, key.key, performance.now());
      const tap = key.code === "Space" && spaceTap;
      if (key.code === "Space") { space = false; spaceTap = false; }
      const target = targetOf(key.target);
      if (target !== "world") return NONE;
      if (tap) context.emit({ kind: "pauseToggle" }, { target });
      return { preventDefault: key.code === "Space" || cameraKey };
    },

    /** Held camera keys and edge scrolling, once per frame (not while a pan drag holds the camera). */
    frame(nowMs: number, previousMs: number, viewport: { readonly width: number; readonly height: number }): void {
      if (gesture?.kind === "pan") return;
      const camera = context.camera();
      const next = advanceCameraMotion({ input: cameraInput, camera, nowMs, previousMs, viewport, world: context.world() });
      if (next !== camera) context.emit({ kind: "pan", dx: next.panX - camera.panX, dy: next.panY - camera.panY });
    },
  };
}
