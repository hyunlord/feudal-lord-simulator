import type { Dispatch } from "react";
import type { GameState } from "../engine/engine.types";
import type { GameAction } from "../state/gameStore.types";
import type { ZoneStrokePoint } from "../zones/zone.types";
import { canvasToWorld, worldToCanvas, type CameraState, type Point } from "./camera";
import type { WorldPoint } from "../input/inputIntent";
import type { CanvasMutableRefs } from "./canvasRuntimeRefs";
import { screenToTile, TILE_H } from "./iso";
import { createPlacementFeedback } from "./placementFeedback";
import { ZONE_BRUSH_COPY } from "./zoneBrushCopy.ko";
import { applyZoneBrushIntent, nextBrushRadius, type ZoneBrushGesture, type ZoneBrushIntent, type ZoneBrushTool } from "./zoneBrushInteraction";
import type { ZoneBrushView } from "./zoneBrushOverlay";
import { zoneEditHistory } from "./zoneEditHistory";

// Canvas adapter for the zone brush (C1b): input intents -> ZoneBrushIntent (B9: the mouse, keyboard and touch
// translators in src/input produce the intents). Only active while a zone tool is armed; otherwise every function
// returns false and the canvas keeps its usual behaviour.
//  - strokeBegin paints (Space + drag still pans, middle drag pans: the translator decides); `polygon` (Shift+click
//    or the polygon toggle) places polygon vertices, confirm (double-click) closes; cancel (right click / Esc) drops
//    the gesture; brushSize ([ ], or the card buttons) sets the radius 1..3; the wheel always zooms (C1d); undo (Z)
//    undoes the last paint or erase (`zone_undo_stroke`, C1c Z-17; a stroke in progress is cancelled first, like Esc).
//  - UX-3R2: redo (Shift+Z / Y, the toolbar) re-sends the edit the last undo took back (zoneEditHistory); a right
//    click with no gesture in progress erases a dab of the brush's size there (UX3R 5절 "우클릭 = 지우기"; with a
//    gesture in progress it drops the gesture, as before).
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
  return zonePointAtWorld(canvasToWorld(point, camera));
}

/** World screen point -> tile-edge space. */
export function zonePointAtWorld(world: WorldPoint): ZoneStrokePoint {
  // Half a tile down in screen space is +0.5 on both tile axes: tile-centre coordinates become tile-edge space.
  const tile = screenToTile(world.x, world.y + TILE_H / 2);
  return { x: tile.tx, y: tile.ty };
}

function apply(context: Context, intent: ZoneBrushIntent): void {
  const tool = context.zone.toolRef.current;
  if (tool === null) return;
  const outcome = applyZoneBrushIntent({ state: context.state(), tool, gesture: context.zone.gestureRef.current, intent });
  context.zone.gestureRef.current = outcome.gesture;
  if (outcome.action !== null) { context.dispatch(outcome.action); zoneEditHistory.record(outcome.action); }
  if (outcome.message !== null) {
    const point = context.zone.pointRef.current;
    const tile = point === null ? { tx: 0, ty: 0 } : { tx: Math.floor(point.x), ty: Math.floor(point.y) };
    context.refs.feedbackRef.current = createPlacementFeedback({ kind: outcome.message.kind, message: outcome.message.text,
      anchor: { kind: "tile", tile }, nowMs: performance.now() });
  }
}

/** The pointer moved (hover preview; `point` intent). */
export function zonePointer(context: Context, point: Point | null): void {
  if (context.zone.toolRef.current === null || point === null) { context.zone.pointRef.current = null; return; }
  context.zone.pointRef.current = zonePointAt(point, context.refs.cameraRef.current);
}

/** `strokeBegin` with the zone tool: a brush stroke, or a polygon vertex (`polygon`, the toggle or a polygon started). */
export function zoneStrokeBegin(context: Context, world: WorldPoint, polygonHint: boolean): boolean {
  const tool = context.zone.toolRef.current;
  if (tool === null) return false;
  const at = zonePointAtWorld(world);
  context.zone.pointRef.current = at;
  const polygon = tool.polygon || polygonHint || context.zone.gestureRef.current?.mode === "polygon";
  if (polygon) {
    apply(context, { type: "polygonPoint", point: at });
  } else {
    apply(context, { type: "strokeBegin", point: at });
    const point = worldToCanvas(world, context.refs.cameraRef.current);
    context.refs.dragRef.current = { mode: "zone", startCanvasPoint: point, startCamera: null, lastCanvasPoint: point, roadStart: null, moved: false };
  }
  return true;
}

/** `confirm` with the zone tool: closes the polygon in progress (anything else has nothing to confirm). */
export function zoneConfirm(context: Context): boolean {
  if (context.zone.toolRef.current === null || context.zone.gestureRef.current?.mode !== "polygon") return false;
  apply(context, { type: "polygonClose" });
  return true;
}

export function zoneStrokeMove(context: Context, world: WorldPoint): void {
  if (context.zone.toolRef.current === null) return;
  const at = zonePointAtWorld(world);
  context.zone.pointRef.current = at;
  if (context.refs.dragRef.current.mode === "zone") apply(context, { type: "strokeMove", point: at });
}

export function zoneStrokeEnd(context: Context): boolean {
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

/** `brushSize`: radius one step ([ / ]). */
export function zoneBrushSize(context: Context, step: -1 | 1): boolean {
  const tool = context.zone.toolRef.current;
  if (tool === null) return false;
  context.zone.onRadiusChange?.(nextBrushRadius(tool.radius, step));
  return true;
}

/** `undo`: the last paint or erase (`zone_undo_stroke`); a stroke in progress is dropped instead, as Esc does. */
export function zoneUndo(context: Context): boolean {
  if (context.zone.toolRef.current === null) return false;
  if (context.zone.gestureRef.current !== null) { zoneCancel(context); return true; }
  const undoable = (context.state().zoneUndo?.length ?? 0) > 0;
  if (undoable) { context.dispatch({ type: "zone_undo_stroke" }); zoneEditHistory.undid(); }
  const point = context.zone.pointRef.current;
  context.refs.feedbackRef.current = createPlacementFeedback({ kind: undoable ? "success" : "failure",
    message: undoable ? ZONE_BRUSH_COPY.undone : ZONE_BRUSH_COPY.nothingToUndo,
    anchor: { kind: "tile", tile: point === null ? { tx: 0, ty: 0 } : { tx: Math.floor(point.x), ty: Math.floor(point.y) } }, nowMs: performance.now() });
  return true;
}

/** `redo`: the edit the last undo took back, sent again. */
export function zoneRedo(context: Context): boolean {
  if (context.zone.toolRef.current === null) return false;
  if (context.zone.gestureRef.current !== null) { zoneCancel(context); return true; }
  const action = zoneEditHistory.takeRedo();
  if (action !== null) { context.dispatch(action); zoneEditHistory.record(action); }
  const point = context.zone.pointRef.current;
  context.refs.feedbackRef.current = createPlacementFeedback({ kind: action !== null ? "success" : "failure",
    message: action !== null ? ZONE_BRUSH_COPY.redone : ZONE_BRUSH_COPY.nothingToRedo,
    anchor: { kind: "tile", tile: point === null ? { tx: 0, ty: 0 } : { tx: Math.floor(point.x), ty: Math.floor(point.y) } }, nowMs: performance.now() });
  return true;
}

/** Right click on the map with the zone tool: drops a gesture in progress, else erases a brush-sized dab there. */
export function zoneAimedCancel(context: Context, world: WorldPoint): boolean {
  const tool = context.zone.toolRef.current;
  if (tool === null) return false;
  if (context.zone.gestureRef.current !== null) { zoneCancel(context); return true; }
  const at = zonePointAtWorld(world);
  context.zone.pointRef.current = at;
  const eraser = { ...tool, target: "erase" as const, polygon: false };
  const outcome = applyZoneBrushIntent({ state: context.state(), tool: eraser, gesture: { mode: "brush", points: [at] }, intent: { type: "strokeEnd" } });
  if (outcome.action !== null) { context.dispatch(outcome.action); zoneEditHistory.record(outcome.action); }
  if (outcome.message !== null && outcome.action !== null) {
    context.refs.feedbackRef.current = createPlacementFeedback({ kind: outcome.message.kind, message: outcome.message.text,
      anchor: { kind: "tile", tile: { tx: Math.floor(at.x), ty: Math.floor(at.y) } }, nowMs: performance.now() });
  }
  return true;
}

/** Global cancel (Esc): drops a gesture in progress only; true = nothing else may react to this Esc. */
export function zoneEscape(context: Context): boolean {
  if (context.zone.toolRef.current === null || context.zone.gestureRef.current === null) return false;
  zoneCancel(context);
  return true;
}
