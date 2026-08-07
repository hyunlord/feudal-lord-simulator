import { useEffect } from "react";

import { getTile } from "../world/grid";
import { clampPan, clientToCanvas, type CameraState, type Point } from "./camera";
import { hoveredBuildingPosition, initialCamera, resizeCanvas } from "./canvasRuntime";
import type { CanvasMutableRefs } from "./canvasRuntimeRefs";
import { pointerTile, releaseTileFromMouseUp, worldBounds, zoomAtPoint } from "./interactions";
import { bindGameCanvasEvents } from "./gameCanvasEvents";
import { preloadWorldAssets } from "./worldAssets";
import { resolveCanvasClick } from "./canvasClickResolution";
import { createCanvasContextMenuHandler } from "./canvasContextMenuHandler";
import { advanceCanvasDrag, beginCanvasDrag, finishedRoadAttempt } from "./canvasDragResolution";
import { resolveCanvasKeyDown } from "./canvasKeyboardResolution";
import { advancePalisadeDraftDrag, beginPalisadeDraftDrag } from "./canvasPalisadeDraftRuntime";
import { drawCurrentCanvasFrame } from "./canvasRuntimeFrame";
import type { GameCanvasRuntimeInput } from "./gameCanvasRuntimeInput";
import { useGameCanvasRuntimeRefs } from "./useGameCanvasRuntimeRefs";

export function useGameCanvasRuntime(input: GameCanvasRuntimeInput): void {
  const {
    canvasRef,
    dispatch,
    highlightedHouseIds,
    overlayMode,
    selectedTool,
    selection,
    setHoveredBuilding,
    setSelection,
    state,
    palisadeDraft = null,
    houseMaterialWave = null,
    palisadeCeremonyStartedAtMs = null,
    onPalisadeDraftChange,
    onPalisadeDraftCancel,
  } = input;
  const { highlightedHouseIdsRef, houseMaterialWaveRef, overlayModeRef, palisadeCeremonyStartedAtMsRef, palisadeDraftRef, selectedToolRef, selectionRef, stateRef } =
    useGameCanvasRuntimeRefs({ state, selectedTool, overlayMode, selection, highlightedHouseIds, palisadeDraft, houseMaterialWave, palisadeCeremonyStartedAtMs });

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d") ?? null;
    if (canvas === null || context === null) return undefined;

    void preloadWorldAssets();

    const refs: CanvasMutableRefs = {
      cameraRef: { current: initialCamera(canvas, stateRef.current) },
      hoverRef: { current: null },
      feedbackRef: { current: null },
      dragRef: { current: { mode: "none", lastCanvasPoint: null, roadStart: null, moved: false } },
      spacePressed: { current: false },
      suppressClick: { current: false },
      pixelRatioRef: { current: 1 },
    };
    let frameId = 0;
    let suppressClickTimeout: number | null = null;
    const viewport = () => {
      const bounds = canvas.getBoundingClientRect();
      return { width: bounds.width, height: bounds.height };
    };
    const clampCamera = (camera: CameraState): CameraState =>
      clampPan(camera, viewport(), worldBounds(stateRef.current.width, stateRef.current.height));
    const resize = () => {
      refs.pixelRatioRef.current = resizeCanvas(canvas, context);
      refs.cameraRef.current = clampCamera(refs.cameraRef.current);
    };
    const drawFrame = () => {
      drawCurrentCanvasFrame({
        canvas,
        context,
        refs,
        state: stateRef.current,
        selectedTool: selectedToolRef.current,
        overlayMode: overlayModeRef.current,
        selection: selectionRef.current,
        highlightedHouseIds: highlightedHouseIdsRef.current,
        palisadeDraft: palisadeDraftRef.current,
        houseMaterialWave: houseMaterialWaveRef.current,
        palisadeCeremonyStartedAtMs: palisadeCeremonyStartedAtMsRef.current,
      });
      frameId = requestAnimationFrame(drawFrame);
    };
    const canvasPoint = (event: MouseEvent | WheelEvent): Point =>
      clientToCanvas(event, canvas.getBoundingClientRect());
    const updateHover = (event: MouseEvent) => {
      refs.hoverRef.current = pointerTile(event, canvas.getBoundingClientRect(), refs.cameraRef.current);
      const buildingId = refs.hoverRef.current === null
        ? null : getTile(stateRef.current, refs.hoverRef.current)?.buildingId ?? null;
      if (buildingId === null) {
        setHoveredBuilding(null);
        return;
      }
      setHoveredBuilding({ buildingId, ...hoveredBuildingPosition(event, canvas.getBoundingClientRect()) });
    };
    const clearSuppressClickTimeout = () => {
      if (suppressClickTimeout !== null) {
        window.clearTimeout(suppressClickTimeout);
        suppressClickTimeout = null;
      }
    };
    const resetDrag = () => {
      refs.dragRef.current = { mode: "none", lastCanvasPoint: null, roadStart: null, moved: false };
    };
    const startDrag = (event: MouseEvent) => {
      updateHover(event);
      const palisadeDrag = beginPalisadeDraftDrag({
        button: event.button,
        hover: refs.hoverRef.current,
        draft: palisadeDraftRef.current,
        point: canvasPoint(event),
      });
      if (palisadeDrag !== null) {
        palisadeDraftRef.current = palisadeDrag.draft;
        onPalisadeDraftChange?.(palisadeDrag.draft);
        refs.dragRef.current = palisadeDrag.drag;
        event.preventDefault();
        return;
      }
      const result = beginCanvasDrag({
        button: event.button,
        point: canvasPoint(event),
        hover: refs.hoverRef.current,
        spacePressed: refs.spacePressed.current,
        selectedTool: selectedToolRef.current,
      });
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
      refs.dragRef.current = result.drag;
      refs.cameraRef.current = clampCamera(result.camera);
      if (result.suppressClick) refs.suppressClick.current = true;
    };
    const finishDrag = (event: MouseEvent) => {
      const drag = refs.dragRef.current;
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
        setSelection(resolution.selection);
        return;
      }
      refs.feedbackRef.current = resolution.attempt.feedback;
      if (resolution.attempt.action !== null) dispatch(resolution.attempt.action);
    };
    const contextMenuCanvas = createCanvasContextMenuHandler({
      canvas, dispatch, refs, selectedToolRef, setSelection, stateRef,
    });
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      refs.cameraRef.current = zoomAtPoint({
        camera: refs.cameraRef.current,
        canvasPoint: canvasPoint(event),
        deltaY: event.deltaY,
        viewport: viewport(),
        world: worldBounds(stateRef.current.width, stateRef.current.height),
      });
    };
    const keyDown = (event: KeyboardEvent) => {
      const result = resolveCanvasKeyDown({
        code: event.code,
        key: event.key,
        camera: refs.cameraRef.current,
        spacePressed: refs.spacePressed.current,
        viewport: viewport(),
        world: worldBounds(stateRef.current.width, stateRef.current.height),
      });
      refs.cameraRef.current = result.camera;
      refs.spacePressed.current = result.spacePressed;
      if (result.dismissSelection) setSelection(null);
      if (event.code === "Escape" && palisadeDraftRef.current !== null) {
        palisadeDraftRef.current = null;
        onPalisadeDraftCancel?.();
      }
      if (result.preventDefault) event.preventDefault();
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      refs.spacePressed.current = false; event.preventDefault();
    };
    const leaveCanvas = () => {
      refs.hoverRef.current = null; setHoveredBuilding(null);
    };
    const blurWindow = () => {
      refs.spacePressed.current = false;
      refs.hoverRef.current = null;
      setHoveredBuilding(null);
      refs.suppressClick.current = false;
      clearSuppressClickTimeout();
      resetDrag();
    };

    resize();
    const disposeEvents = bindGameCanvasEvents({
      canvas,
      handlers: { resize, keyDown, keyUp, blurWindow, startDrag, movePointer, leaveCanvas, clickCanvas, contextMenuCanvas, wheel, finishDrag },
    });
    frameId = requestAnimationFrame(drawFrame);
    return () => {
      cancelAnimationFrame(frameId);
      disposeEvents();
      clearSuppressClickTimeout();
    };
  }, [canvasRef, dispatch, onPalisadeDraftCancel, onPalisadeDraftChange, setHoveredBuilding, setSelection]);
}
