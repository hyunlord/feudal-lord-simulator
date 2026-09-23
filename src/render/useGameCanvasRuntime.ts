import { isCanvasKeyboardControl } from "./canvasKeyboardTarget";
import { updateCanvasHover } from "./canvasHoverRuntime";
import { cancelRoadPreview } from "./cancelRoadPreview";
import { createPredictionPublisher } from "./placementPredictionRuntime";
import { causeMarkerAtCanvasPoint } from "./causeMapInteraction";
import { proofFrameWork } from "../testing/proofFrameWork";
import { useEffect } from "react";

import { clampPan, clientToCanvas, type CameraState, type Point } from "./camera";
import { cameraAfterViewportResize, initialCamera, resizeCanvas } from "./canvasRuntime";
import { createCanvasMutableRefs } from "./canvasRuntimeRefs";
import { releaseTileFromMouseUp, worldBounds, zoomAtPoint } from "./interactions";
import { installMinimapCameraJumpRuntime, publishMinimapViewport } from "./minimapCameraJump";
import { bindGameCanvasEvents } from "./gameCanvasEvents";
import { preloadGameArt } from "./preloadGameArt";
import { resolveCanvasClick } from "./canvasClickResolution";
import { createCanvasContextMenuHandler } from "./canvasContextMenuHandler";
import { advanceCanvasDrag, beginCanvasDrag, finishedRoadAttempt } from "./canvasDragResolution";
import { resolveCanvasKeyDown } from "./canvasKeyboardResolution";
import { advancePalisadeDraftDrag, beginPalisadeDraftDrag } from "./canvasPalisadeDraftRuntime";
import { drawCurrentCanvasFrame } from "./canvasRuntimeFrame";
import type { GameCanvasRuntimeInput } from "./gameCanvasRuntimeInput";
import { useGameCanvasRuntimeRefs } from "./useGameCanvasRuntimeRefs";
import { toggleObjectRenderViewMode } from "./objectRenderViewMode";
import { installPhase10ProofRuntime } from "../testing/phase10ProofRuntime";
import { installAutoplayPulseRuntime } from "./autoplayPulseRuntime";
import { advanceCameraMotion, cameraInputKeyDown, cameraInputKeyUp, createCameraInputState, resetCameraInputState, shouldAdvanceCameraMotion, updateCameraEdgePoint } from "./gameCanvasRuntimeInput";

export function useGameCanvasRuntime(input: GameCanvasRuntimeInput): void {
  const {
    canvasRef,
    setPrediction,
    dispatch,
    highlightedHouseIds,
    overlayMode,
    problemOnly = false,
    selectedTool,
    selection,
    setHoveredBuilding,
    setSelection,
    state,
    palisadeDraft = null,
    houseMaterialWave = null,
    palisadeCeremonyStartedAtMs = null,
    onPalisadeDraftChange,
    onPalisadeDraftCancel, previousRenderState, interpolationAlpha,
  } = input;
  const { problemOnlyRef, highlightedHouseIdsRef, houseMaterialWaveRef, overlayModeRef, palisadeCeremonyStartedAtMsRef, palisadeDraftRef, previousRenderStateRef, selectedToolRef, selectionRef, stateRef } =
    useGameCanvasRuntimeRefs({ state, previousRenderState, selectedTool, overlayMode, problemOnly, selection, highlightedHouseIds, palisadeDraft, houseMaterialWave, palisadeCeremonyStartedAtMs });

  useEffect(() => {
    const canvas = canvasRef.current, context = canvas?.getContext("2d") ?? null;
    if (canvas === null || context === null) return undefined;

    void preloadGameArt();

    const refs = createCanvasMutableRefs(initialCamera(canvas, stateRef.current));
    const cameraInput = createCameraInputState();
    const publishPrediction = createPredictionPublisher(value => setPrediction?.(value));
    let frameId = 0, lastFrameAtMs = performance.now(), suppressClickTimeout: number | null = null, userControlledCamera = false;
    const viewport = () => {
      const rect = canvas.getBoundingClientRect(); return { width: rect.width, height: rect.height };
    };
    const clampCamera = (camera: CameraState): CameraState => clampPan(camera, viewport(), worldBounds(stateRef.current.width, stateRef.current.height));
    const resize = () => {
      refs.pixelRatioRef.current = resizeCanvas(canvas, context);
      refs.cameraRef.current = cameraAfterViewportResize({ camera: refs.cameraRef.current, canvas, state: stateRef.current, userControlled: userControlledCamera });
    };
    const drawFrame = () => {
      const nowMs = performance.now();
      if (shouldAdvanceCameraMotion(refs.dragRef.current)) {
        const nextCamera = advanceCameraMotion({ input: cameraInput, camera: refs.cameraRef.current, nowMs, previousMs: lastFrameAtMs, viewport: viewport(), world: worldBounds(stateRef.current.width, stateRef.current.height) });
        if (nextCamera !== refs.cameraRef.current) {
          refs.cameraRef.current = nextCamera;
          userControlledCamera = true;
        }
      }
      lastFrameAtMs = nowMs;
      const work = proofFrameWork.current;
      const startedAt = work === null ? 0 : performance.now();
      drawCurrentCanvasFrame({ canvas, context, refs, publishPrediction, state: stateRef.current, selectedTool: selectedToolRef.current, overlayMode: overlayModeRef.current, problemOnly: problemOnlyRef.current, selection: selectionRef.current, previousRenderState: previousRenderStateRef.current, interpolationAlpha, highlightedHouseIds: highlightedHouseIdsRef.current, palisadeDraft: palisadeDraftRef.current, houseMaterialWave: houseMaterialWaveRef.current, palisadeCeremonyStartedAtMs: palisadeCeremonyStartedAtMsRef.current });
      if (work !== null) work.recordFrame(performance.now() - startedAt);
      publishMinimapViewport({ target: window, camera: refs.cameraRef.current, viewport: viewport(), world: worldBounds(stateRef.current.width, stateRef.current.height), grid: stateRef.current });
      frameId = requestAnimationFrame(drawFrame);
    };
    const canvasPoint = (event: MouseEvent | WheelEvent): Point => clientToCanvas(event, canvas.getBoundingClientRect());
    const updateHover = (event: MouseEvent) => updateCanvasHover(event, canvas, refs, cameraInput, stateRef.current, selectedToolRef.current, setHoveredBuilding);
    const clearSuppressClickTimeout = () => {
      if (suppressClickTimeout !== null) {
        window.clearTimeout(suppressClickTimeout);
        suppressClickTimeout = null;
      }
    };
    const resetDrag = () => { refs.dragRef.current = { mode: "none", startCanvasPoint: null, startCamera: null, lastCanvasPoint: null, roadStart: null, moved: false }; };
    const startDrag = (event: MouseEvent) => {
      if (event.button === 2 && refs.dragRef.current.mode === "road") return;
      if (event.button === 0) refs.roadCancelled.current = false;
      updateHover(event);
      const palisadeDrag = beginPalisadeDraftDrag({ button: event.button, hover: refs.hoverRef.current, draft: palisadeDraftRef.current, point: canvasPoint(event) });
      if (palisadeDrag !== null) {
        palisadeDraftRef.current = palisadeDrag.draft;
        onPalisadeDraftChange?.(palisadeDrag.draft);
        refs.dragRef.current = palisadeDrag.drag;
        event.preventDefault();
        return;
      }
      const result = beginCanvasDrag({ button: event.button, point: canvasPoint(event), hover: refs.hoverRef.current, spacePressed: refs.spacePressed.current, selectedTool: selectedToolRef.current });
      refs.dragRef.current = result.drag;
      if (result.preventDefault) event.preventDefault();
    };
    const movePointer = (event: MouseEvent) => {
      updateHover(event);
      const nextDraft = advancePalisadeDraftDrag({
        drag: refs.dragRef.current,
        state: stateRef.current,
        draft: palisadeDraftRef.current,
        hover: refs.hoverRef.current,
      });
      if (nextDraft !== null) {
        palisadeDraftRef.current = nextDraft;
        onPalisadeDraftChange?.(nextDraft);
      }
      const result = advanceCanvasDrag({
        drag: refs.dragRef.current,
        point: canvasPoint(event),
        camera: refs.cameraRef.current,
      });
      if (refs.dragRef.current.mode === "pan" && result.drag.moved) userControlledCamera = true;
      refs.dragRef.current = result.drag;
      refs.cameraRef.current = clampCamera(result.camera);
      if (result.suppressClick) refs.suppressClick.current = true;
    };
    const finishDrag = (event: MouseEvent) => {
      if (refs.roadCancelled.current && event.button !== 0) return;
      const drag = refs.roadCancelled.current ? { ...refs.dragRef.current, moved: true } : refs.dragRef.current;
      refs.roadCancelled.current = false;
      const destination = releaseTileFromMouseUp(event, canvas.getBoundingClientRect(), refs.cameraRef.current);
      const attempt = finishedRoadAttempt(stateRef.current, drag, destination, performance.now());
      if (attempt !== null) {
        refs.feedbackRef.current = attempt.feedback;
        if (attempt.action !== null) dispatch(attempt.action);
      }
      resetDrag();
      clearSuppressClickTimeout();
      if (!drag.moved) {
        refs.suppressClick.current = false;
        return;
      }
      refs.suppressClick.current = true;
      suppressClickTimeout = window.setTimeout(() => {
        refs.suppressClick.current = false;
        suppressClickTimeout = null;
      }, 0);
    };
    const clickCanvas = (event: MouseEvent) => {
      if (palisadeDraftRef.current !== null) return;
      const bounds = canvas.getBoundingClientRect();
      const resolution = resolveCanvasClick({
        suppressClick: refs.suppressClick.current,
        spacePressed: refs.spacePressed.current,
        dragMode: refs.dragRef.current.mode === "palisade" ? "none" : refs.dragRef.current.mode,
        hover: refs.hoverRef.current,
        selectedTool: selectedToolRef.current,
        state: stateRef.current,
        point: canvasPoint(event),
        camera: refs.cameraRef.current,
        viewport: bounds,
        nowMs: performance.now(),
      });
      if (resolution.kind === "ignored") {
        if (!resolution.clearSuppression) return;
        refs.suppressClick.current = false;
        clearSuppressClickTimeout();
        return;
      }
      if (resolution.kind === "selection") {
        const marker = selectedToolRef.current === null ? causeMarkerAtCanvasPoint(stateRef.current, refs.cameraRef.current, canvasPoint(event)) : null;
        const buildingId = marker?.buildingIds[0];
        if (buildingId !== undefined) {
          setSelection({ kind: 'building', buildingId, position: canvasPoint(event) });
          return;
        }
        setSelection(resolution.selection);
        return;
      }
      refs.feedbackRef.current = resolution.attempt.feedback;
      if (resolution.attempt.action !== null) dispatch(resolution.attempt.action);
    };
    const defaultContextMenu = createCanvasContextMenuHandler({ canvas, dispatch, refs, selectedToolRef, setSelection, stateRef });
    const contextMenuCanvas = (event: MouseEvent) => {
      if (cancelRoadPreview(refs)) event.preventDefault(); else defaultContextMenu(event);
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      userControlledCamera = true;
      refs.cameraRef.current = zoomAtPoint({
        camera: refs.cameraRef.current,
        canvasPoint: canvasPoint(event),
        deltaY: event.deltaY,
        viewport: viewport(),
        world: worldBounds(stateRef.current.width, stateRef.current.height),
      });
    };
    const keyDown = (event: KeyboardEvent) => {
      if (isCanvasKeyboardControl(event.target)) return;
      if (event.code === "Escape") cancelRoadPreview(refs);
      const cameraKey = cameraInputKeyDown(cameraInput, event.key, performance.now());
      const result = resolveCanvasKeyDown({
        code: event.code,
        key: event.key,
        camera: refs.cameraRef.current,
        spacePressed: refs.spacePressed.current,
        viewport: viewport(),
        world: worldBounds(stateRef.current.width, stateRef.current.height),
      });
      if (result.camera !== refs.cameraRef.current) userControlledCamera = true;
      refs.cameraRef.current = result.camera;
      refs.spacePressed.current = result.spacePressed;
      toggleObjectRenderViewMode(result.toggleOutlinesView);
      if (result.dismissSelection) setSelection(null);
      if (event.code === "Escape" && palisadeDraftRef.current !== null) {
        palisadeDraftRef.current = null;
        onPalisadeDraftCancel?.();
      }
      if (result.preventDefault || cameraKey) event.preventDefault();
    };
    const keyUp = (event: KeyboardEvent) => {
      const cameraKey = cameraInputKeyUp(cameraInput, event.key, performance.now());
      if (event.code === "Space") refs.spacePressed.current = false;
      if (isCanvasKeyboardControl(event.target)) return;
      if (event.code === "Space" || cameraKey) event.preventDefault();
    };
    const leaveCanvas = () => { canvas.title = ""; updateCameraEdgePoint(cameraInput, null); refs.hoverRef.current = null; setHoveredBuilding(null); };
    const blurWindow = () => {
      resetCameraInputState(cameraInput);
      refs.spacePressed.current = false;
      refs.hoverRef.current = null;
      setHoveredBuilding(null);
      refs.suppressClick.current = false;
      clearSuppressClickTimeout();
      resetDrag();
    };
    resize();
    const disposeAutoplayPulse = installAutoplayPulseRuntime(refs.feedbackRef);
    const disposeProofRuntime = installPhase10ProofRuntime({ canvas, cameraRef: refs.cameraRef, stateRef, location: window.location });
    const disposeMinimapJump = installMinimapCameraJumpRuntime({ cameraRef: refs.cameraRef, markUserControlled: () => { userControlledCamera = true; }, target: window, viewport, world: () => worldBounds(stateRef.current.width, stateRef.current.height) });
    const disposeEvents = bindGameCanvasEvents({
      canvas,
      handlers: { resize, keyDown, keyUp, blurWindow, startDrag, movePointer, leaveCanvas, clickCanvas, contextMenuCanvas, wheel, finishDrag },
    });
    frameId = requestAnimationFrame(drawFrame);
    return () => {
      cancelAnimationFrame(frameId); disposeAutoplayPulse(); disposeMinimapJump(); disposeEvents(); disposeProofRuntime(); clearSuppressClickTimeout();
    };
  }, [canvasRef, dispatch, onPalisadeDraftCancel, onPalisadeDraftChange, setHoveredBuilding, setSelection, setPrediction]);
}
