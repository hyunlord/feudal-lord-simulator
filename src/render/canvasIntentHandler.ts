import type { IntentHandler } from "../input/intentBus";
import type { InputIntent } from "../input/inputIntent";
import { worldToCanvas, type CameraState, type WorldBounds } from "./camera";
import { cancelRoadPreview } from "./cancelRoadPreview";
import { handleCanvasSelect } from "./canvasClickRuntime";
import { handleAimedCancel } from "./canvasContextMenuHandler";
import { advanceCanvasDrag, beginCanvasDrag, finishedRoadAttempt } from "./canvasDragResolution";
import { updateCanvasHover } from "./canvasHoverRuntime";
import { advancePalisadeDraftDrag, beginPalisadeDraftDrag, finishPalisadeDraftDrag } from "./canvasPalisadeDraftRuntime";
import type { CanvasMutableRefs } from "./canvasRuntimeRefs";
import {
  createZoneBrushContext, zoneBrushSize, zoneCancel, zoneConfirm, zoneEscape, zonePointer, zoneStrokeBegin, zoneStrokeEnd,
  zoneStrokeMove, zoneUndo,
} from "./canvasZoneBrushRuntime";
import type { GameCanvasRuntimeInput } from "./gameCanvasRuntimeInput";
import { zoomByFactor } from "./interactions";
import { cameraForMinimapTileJump } from "./minimapCameraJump";
import { applyPalisadeIntent, type PalisadeDraftState } from "./palisadeDraftInteraction";
import { pickTile } from "./picking";

// The map's intent handler (B9): what the canvas used to do in its mouse and key callbacks, fed by input intents
// only. Device questions (button, Space held, drag threshold, which click a drag swallows) were answered by the
// translator; this decides what an intent means for the game: hover, strokes with the road / palisade / zone tools,
// selection and placement, cancel, undo, camera. It runs first on the intent bus (INTENT_ORDER.world); keyboard
// intents aimed at a native control or a text field are left to the app shell, as the old key callback did.

type Deps = {
  readonly canvas: HTMLCanvasElement;
  readonly refs: CanvasMutableRefs;
  readonly stateRef: { current: GameCanvasRuntimeInput["state"] };
  readonly selectedToolRef: { current: GameCanvasRuntimeInput["selectedTool"] };
  readonly palisadeDraftRef: { current: PalisadeDraftState | null };
  readonly zone: ReturnType<typeof createZoneBrushContext>;
  readonly dispatch: GameCanvasRuntimeInput["dispatch"];
  readonly setSelection: GameCanvasRuntimeInput["setSelection"];
  readonly setHoveredBuilding: GameCanvasRuntimeInput["setHoveredBuilding"];
  readonly onPalisadeDraftChange: GameCanvasRuntimeInput["onPalisadeDraftChange"];
  readonly clampCamera: (camera: CameraState) => CameraState;
  readonly viewport: () => { readonly width: number; readonly height: number };
  readonly world: () => WorldBounds;
  readonly markUserControlled: () => void;
};

export function createCanvasIntentHandler(deps: Deps): IntentHandler {
  const { canvas, refs, stateRef, selectedToolRef, palisadeDraftRef, zone } = deps;
  const setDraft = (draft: PalisadeDraftState | null) => { palisadeDraftRef.current = draft; deps.onPalisadeDraftChange?.(draft); };
  const resetDrag = () => { refs.dragRef.current = { mode: "none", startCanvasPoint: null, startCamera: null, lastCanvasPoint: null, roadStart: null, moved: false }; };
  const canvasPoint = (world: { readonly x: number; readonly y: number }) => worldToCanvas(world, refs.cameraRef.current);

  const strokeBegin = (intent: Extract<InputIntent, { kind: "strokeBegin" }>) => {
    if (intent.toolId === "zone") return zoneStrokeBegin(zone, intent.world, intent.polygon === true);
    const point = canvasPoint(intent.world);
    if (intent.toolId === "palisade") {
      const started = beginPalisadeDraftDrag({ button: 0, hover: refs.hoverRef.current, draft: palisadeDraftRef.current,
        point, camera: refs.cameraRef.current, state: stateRef.current });
      if (started === null) return false;
      setDraft(started.draft);
      refs.dragRef.current = started.drag;
      return true;
    }
    refs.dragRef.current = beginCanvasDrag({ button: 0, point, hover: refs.hoverRef.current, spacePressed: false, selectedTool: "road" }).drag;
    return true;
  };

  const strokeMove = (world: { readonly x: number; readonly y: number }) => {
    const point = canvasPoint(world);
    zoneStrokeMove(zone, world);
    const nextDraft = advancePalisadeDraftDrag({ drag: refs.dragRef.current, state: stateRef.current, draft: palisadeDraftRef.current,
      hover: refs.hoverRef.current, point, camera: refs.cameraRef.current });
    if (nextDraft !== null) setDraft(nextDraft);
    refs.dragRef.current = advanceCanvasDrag({ drag: refs.dragRef.current, point, camera: refs.cameraRef.current }).drag;
  };

  const strokeEnd = (intent: Extract<InputIntent, { kind: "strokeEnd" }>) => {
    const drag = refs.dragRef.current;
    zoneStrokeEnd(zone);
    if (drag.mode === "palisade") {
      const nextDraft = finishPalisadeDraftDrag(stateRef.current, palisadeDraftRef.current);
      if (nextDraft !== palisadeDraftRef.current) setDraft(nextDraft);
    }
    const destination = intent.outside === true ? null : pickTile(intent.world);
    const attempt = finishedRoadAttempt(stateRef.current, drag, destination, performance.now());
    if (attempt !== null) {
      refs.feedbackRef.current = attempt.feedback;
      if (attempt.action !== null) deps.dispatch(attempt.action);
    }
    resetDrag();
  };

  const moveCamera = (camera: CameraState) => { refs.cameraRef.current = camera; deps.markUserControlled(); };

  return (intent, context) => {
    const onMap = context.target === "world";
    switch (intent.kind) {
      case "point": {
        if (intent.screen === null) {
          zonePointer(zone, null);
          canvas.title = "";
          refs.hoverRef.current = null;
          deps.setHoveredBuilding(null);
          return;
        }
        updateCanvasHover(intent.screen, canvas, refs, stateRef.current, selectedToolRef.current, deps.setHoveredBuilding);
        zonePointer(zone, intent.screen);
        // As before, every pointer move re-clamps the camera (a resize may have left it outside the map).
        refs.cameraRef.current = deps.clampCamera(refs.cameraRef.current);
        return;
      }
      case "inspect":
        // A long press (TOUCH-1): the hover card of what is there, as the mouse pointer resting on it shows.
        updateCanvasHover(worldToCanvas(intent.world, refs.cameraRef.current), canvas, refs, stateRef.current, selectedToolRef.current, deps.setHoveredBuilding);
        return "handled";
      case "strokeBegin": return strokeBegin(intent) ? "handled" : undefined;
      case "strokeMove": strokeMove(intent.world); return "handled";
      case "strokeEnd": strokeEnd(intent); return "handled";
      case "select":
        if (zone.zone.toolRef.current !== null) return;
        handleCanvasSelect({ world: intent.world, canvas, refs, stateRef, selectedToolRef, palisadeDraftRef,
          setSelection: deps.setSelection, dispatch: deps.dispatch });
        return "handled";
      case "confirm": return onMap && zoneConfirm(zone) ? "handled" : undefined;
      case "cancel": {
        if (intent.world !== undefined) {
          if (palisadeDraftRef.current !== null) {
            setDraft(applyPalisadeIntent({ state: stateRef.current, draft: palisadeDraftRef.current, intent: { type: "cancel" } }));
            return "handled";
          }
          if (zone.zone.toolRef.current !== null) { zoneCancel(zone); return "handled"; }
          if (cancelRoadPreview(refs)) return "handled";
          handleAimedCancel({ world: intent.world, dispatch: deps.dispatch, selectedToolRef, setSelection: deps.setSelection, stateRef });
          return "handled";
        }
        if (!onMap) return;
        // The zone brush's Esc drops only its own gesture: the tool stays armed (nothing after this sees it).
        if (zoneEscape(zone)) return "consumed";
        cancelRoadPreview(refs);
        deps.setSelection(null);
        return "handled";
      }
      case "undo": return onMap && zoneUndo(zone) ? "handled" : undefined;
      case "brushSize": return onMap && zoneBrushSize(zone, intent.step) ? "handled" : undefined;
      case "pan":
        moveCamera(deps.clampCamera({ ...refs.cameraRef.current, panX: refs.cameraRef.current.panX + intent.dx, panY: refs.cameraRef.current.panY + intent.dy }));
        return "handled";
      case "zoom":
        moveCamera(zoomByFactor({ camera: refs.cameraRef.current, anchor: intent.anchor, factor: intent.factor, viewport: deps.viewport(), world: deps.world() }));
        return "handled";
      case "lookAt":
        moveCamera(cameraForMinimapTileJump({ camera: refs.cameraRef.current, tile: intent.tile, viewport: deps.viewport(), world: deps.world() }));
        return "handled";
      case "focusLost": {
        if (palisadeDraftRef.current !== null && palisadeDraftRef.current.activeGesture !== null) {
          setDraft(finishPalisadeDraftDrag(stateRef.current, palisadeDraftRef.current));
        }
        refs.hoverRef.current = null;
        deps.setHoveredBuilding(null);
        resetDrag();
        return;
      }
      default:
        return;
    }
  };
}

