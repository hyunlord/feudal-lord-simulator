import type { Dispatch } from "react";
import type { GameState } from "../engine/engine.types";
import type { GameAction } from "../state/gameStore.types";
import type { ZoneStrokePoint } from "../zones/zone.types";
import { canvasToWorld, type CameraState, type Point } from "./camera";
import type { CanvasMutableRefs } from "./canvasRuntimeRefs";
import { screenToTile, TILE_H } from "./iso";
import { createPlacementFeedback } from "./placementFeedback";
import { ZONE_BRUSH_COPY } from "./zoneBrushCopy.ko";
import { applyZoneBrushIntent, nextBrushRadius, type ZoneBrushGesture, type ZoneBrushIntent, type ZoneBrushTool } from "./zoneBrushInteraction";
import type { ZoneBrushView } from "./zoneBrushOverlay";

// Canvas adapter for the zone brush (C1b): mouse, wheel, keys and touch -> ZoneBrushIntent. Only active while a zone
// tool is armed; otherwise every handler returns false and the canvas keeps its usual behaviour.
//  - Mouse: left drag paints (Space + drag still pans, middle drag pans); Shift+click or the polygon toggle places
//    polygon vertices, double-click closes; right click / Esc cancels the gesture; [ ] (or the card buttons) set the
//    radius 1..3; the wheel always zooms (C1d); Z undoes the last paint or erase (`zone_undo_stroke`, C1c Z-17; a
//    stroke in progress is cancelled first, like Esc).
//  - Touch: one finger paints, two fingers pan the camera (and drop a stroke in progress). No hover is needed:
//    the preview follows the finger.

export type ZoneBrushRuntime = {
  readonly toolRef: { current: ZoneBrushTool | null };
  readonly gestureRef: { current: ZoneBrushGesture | null };
  /** Pointer position in tile-edge space (null when the pointer is off the canvas). */
  readonly pointRef: { current: ZoneStrokePoint | null };
  readonly onRadiusChange?: ((radius: number) => void) | undefined;
};

type Context = {
  readonly zone: ZoneBrushRuntime;
  readonly refs: CanvasMutableRefs;
  readonly state: () => GameState;
  readonly dispatch: Dispatch<GameAction>;
  readonly clampCamera: (camera: CameraState) => CameraState;
};

export function createZoneBrushContext(input: {
  readonly toolRef: { current: ZoneBrushTool | null };
  readonly radiusRef: { current: ((radius: number) => void) | undefined };
  readonly refs: CanvasMutableRefs;
  readonly stateRef: { current: GameState };
  readonly dispatch: Dispatch<GameAction>;
  readonly clampCamera: (camera: CameraState) => CameraState;
}): Context {
  return {
    zone: { toolRef: input.toolRef, gestureRef: { current: null }, pointRef: { current: null }, onRadiusChange: radius => input.radiusRef.current?.(radius) },
    refs: input.refs, state: () => input.stateRef.current, dispatch: input.dispatch, clampCamera: input.clampCamera,
  };
}

/** What the frame draws for the brush; drops a gesture left over when the tool was disarmed mid-stroke. */
export function zoneBrushView(context: Context): ZoneBrushView | null {
  const tool = context.zone.toolRef.current;
  if (tool === null) { context.zone.gestureRef.current = null; return null; }
  return { tool, gesture: context.zone.gestureRef.current, hover: context.zone.pointRef.current };
}

/** Canvas point -> tile-edge space (cell (tx,ty) spans [tx,tx+1)). */
export function zonePointAt(point: Point, camera: CameraState): ZoneStrokePoint {
  const world = canvasToWorld(point, camera);
  // Half a tile down in screen space is +0.5 on both tile axes: tile-centre coordinates become tile-edge space.
  const tile = screenToTile(world.x, world.y + TILE_H / 2);
  return { x: tile.tx, y: tile.ty };
}

function apply(context: Context, intent: ZoneBrushIntent): void {
  const tool = context.zone.toolRef.current;
  if (tool === null) return;
  const outcome = applyZoneBrushIntent({ state: context.state(), tool, gesture: context.zone.gestureRef.current, intent });
  context.zone.gestureRef.current = outcome.gesture;
  if (outcome.action !== null) context.dispatch(outcome.action);
  if (outcome.message !== null) {
    const point = context.zone.pointRef.current;
    const tile = point === null ? { tx: 0, ty: 0 } : { tx: Math.floor(point.x), ty: Math.floor(point.y) };
    context.refs.feedbackRef.current = createPlacementFeedback({ kind: outcome.message.kind, message: outcome.message.text,
      anchor: { kind: "tile", tile }, nowMs: performance.now() });
  }
}

export function zoneMouseDown(context: Context, event: MouseEvent, point: Point): boolean {
  const tool = context.zone.toolRef.current;
  if (tool === null || event.button !== 0 || context.refs.spacePressed.current) return false;
  const at = zonePointAt(point, context.refs.cameraRef.current);
  context.zone.pointRef.current = at;
  event.preventDefault();
  const polygon = tool.polygon || event.shiftKey || context.zone.gestureRef.current?.mode === "polygon";
  if (polygon) {
    apply(context, event.detail >= 2 ? { type: "polygonClose" } : { type: "polygonPoint", point: at });
  } else {
    apply(context, { type: "strokeBegin", point: at });
    context.refs.dragRef.current = { mode: "zone", startCanvasPoint: point, startCamera: null, lastCanvasPoint: point, roadStart: null, moved: false };
  }
  context.refs.suppressClick.current = true;
  return true;
}

export function zoneMouseMove(context: Context, point: Point): void {
  if (context.zone.toolRef.current === null) { context.zone.pointRef.current = null; return; }
  const at = zonePointAt(point, context.refs.cameraRef.current);
  context.zone.pointRef.current = at;
  if (context.refs.dragRef.current.mode === "zone") apply(context, { type: "strokeMove", point: at });
}

export function zoneMouseUp(context: Context): boolean {
  if (context.refs.dragRef.current.mode !== "zone") return false;
  apply(context, { type: "strokeEnd" });
  return true;
}

export function zoneCancel(context: Context): boolean {
  if (context.zone.toolRef.current === null) return false;
  const had = context.zone.gestureRef.current !== null;
  apply(context, { type: "cancel" });
  if (context.refs.dragRef.current.mode === "zone") context.refs.dragRef.current = { ...context.refs.dragRef.current, mode: "none" };
  return had;
}

export function zoneKeyDown(context: Context, event: KeyboardEvent): boolean {
  const tool = context.zone.toolRef.current;
  if (tool === null) return false;
  if (event.code === "BracketLeft" || event.code === "BracketRight") {
    event.preventDefault();
    context.zone.onRadiusChange?.(nextBrushRadius(tool.radius, event.code === "BracketRight" ? 1 : -1));
    return true;
  }
  if (event.code === "KeyZ") {
    event.preventDefault();
    // A stroke in progress is not recorded yet: Z drops it, as Esc does, and undoes nothing.
    if (context.zone.gestureRef.current !== null) { zoneCancel(context); return true; }
    const undoable = (context.state().zoneUndo?.length ?? 0) > 0;
    if (undoable) context.dispatch({ type: "zone_undo_stroke" });
    const point = context.zone.pointRef.current;
    context.refs.feedbackRef.current = createPlacementFeedback({ kind: undoable ? "success" : "failure",
      message: undoable ? ZONE_BRUSH_COPY.undone : ZONE_BRUSH_COPY.nothingToUndo,
      anchor: { kind: "tile", tile: point === null ? { tx: 0, ty: 0 } : { tx: Math.floor(point.x), ty: Math.floor(point.y) } }, nowMs: performance.now() });
    return true;
  }
  if (event.code === "Escape" && context.zone.gestureRef.current !== null) {
    zoneCancel(context);
    event.preventDefault();
    event.stopImmediatePropagation();
    return true;
  }
  return false;
}

/** Touch: one finger paints, two fingers pan. Returns the unbind function. */
export function bindZoneTouch(canvas: HTMLCanvasElement, context: Context): () => void {
  let pan: { readonly start: Point; readonly camera: CameraState } | null = null;
  const local = (touch: Touch): Point => { const rect = canvas.getBoundingClientRect(); return { x: touch.clientX - rect.left, y: touch.clientY - rect.top }; };
  const midpoint = (touches: TouchList): Point => {
    const a = local(touches[0] as Touch); const b = local(touches[1] as Touch);
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };
  const start = (event: TouchEvent) => {
    if (context.zone.toolRef.current === null) return;
    event.preventDefault();
    if (event.touches.length >= 2) {
      if (context.zone.gestureRef.current?.mode === "brush") zoneCancel(context);
      pan = { start: midpoint(event.touches), camera: context.refs.cameraRef.current };
      return;
    }
    const at = zonePointAt(local(event.touches[0] as Touch), context.refs.cameraRef.current);
    context.zone.pointRef.current = at;
    const tool = context.zone.toolRef.current;
    if (tool.polygon) apply(context, { type: "polygonPoint", point: at });
    else apply(context, { type: "strokeBegin", point: at });
  };
  const move = (event: TouchEvent) => {
    if (context.zone.toolRef.current === null) return;
    event.preventDefault();
    if (pan !== null && event.touches.length >= 2) {
      const now = midpoint(event.touches);
      context.refs.cameraRef.current = context.clampCamera({ ...pan.camera, panX: pan.camera.panX + now.x - pan.start.x, panY: pan.camera.panY + now.y - pan.start.y });
      return;
    }
    if (event.touches.length === 1 && pan === null) {
      const at = zonePointAt(local(event.touches[0] as Touch), context.refs.cameraRef.current);
      context.zone.pointRef.current = at;
      apply(context, { type: "strokeMove", point: at });
    }
  };
  const end = (event: TouchEvent) => {
    if (context.zone.toolRef.current === null) return;
    event.preventDefault();
    if (pan !== null) { if (event.touches.length === 0) pan = null; return; }
    if (event.touches.length === 0 && context.zone.gestureRef.current?.mode === "brush") apply(context, { type: "strokeEnd" });
  };
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
