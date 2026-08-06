import { useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from "react";

import type { GameState, OverlayMode } from "../engine/engine.types";
import type { GameAction } from "../state/gameStore.types";
import { getTile, type TileCoordinate } from "../world/grid";
import type { HoveredBuilding } from "./BuildingInspector";
import { clampPan, clientToCanvas, type CameraState, type Point } from "./camera";
import { hoveredBuildingPosition, initialCamera, resizeCanvas, type DragState } from "./canvasRuntime";
import {
  pointerTile,
  releaseTileFromMouseUp,
  worldBounds,
  zoomAtPoint,
} from "./interactions";
import type { PlacementFeedback } from "./placementFeedback";
import type { PlacementTool } from "./renderer";
import { bindGameCanvasEvents } from "./gameCanvasEvents";
import { preloadWorldAssets } from "./worldAssets";
import type { AnchoredWorldSelection } from "./worldSelection";
import { resolveCanvasClick } from "./canvasClickResolution";
import { advanceCanvasDrag, beginCanvasDrag, finishedRoadAttempt } from "./canvasDragResolution";
import { resolveCanvasKeyDown } from "./canvasKeyboardResolution";
import { drawCurrentCanvasFrame } from "./canvasRuntimeFrame";

type GameCanvasRuntimeInput = {
  readonly canvasRef: RefObject<HTMLCanvasElement | null>;
  readonly state: GameState;
  readonly dispatch: Dispatch<GameAction>;
  readonly selectedTool: PlacementTool | null;
  readonly overlayMode: OverlayMode;
  readonly setHoveredBuilding: Dispatch<SetStateAction<HoveredBuilding | null>>;
  readonly selection: AnchoredWorldSelection | null;
  readonly setSelection: Dispatch<SetStateAction<AnchoredWorldSelection | null>>;
  readonly highlightedHouseIds: readonly string[];
};

type CanvasMutableRefs = {
  readonly cameraRef: { current: CameraState };
  readonly hoverRef: { current: TileCoordinate | null };
  readonly feedbackRef: { current: PlacementFeedback | null };
  readonly dragRef: { current: DragState };
  readonly spacePressed: { current: boolean };
  readonly suppressClick: { current: boolean };
  readonly pixelRatioRef: { current: number };
};

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
  } = input;
  const stateRef = useRef(state);
  const selectedToolRef = useRef(selectedTool);
  const overlayModeRef = useRef(overlayMode);
  const selectionRef = useRef(selection);
  const highlightedHouseIdsRef = useRef(highlightedHouseIds);

  useEffect(() => {
    stateRef.current = state;
    selectedToolRef.current = selectedTool;
    overlayModeRef.current = overlayMode;
    selectionRef.current = selection;
    highlightedHouseIdsRef.current = highlightedHouseIds;
  }, [highlightedHouseIds, overlayMode, selectedTool, selection, state]);

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
      const bounds = canvas.getBoundingClientRect();
      const resolution = resolveCanvasClick({
        suppressClick: refs.suppressClick.current,
        spacePressed: refs.spacePressed.current,
        dragMode: refs.dragRef.current.mode,
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
      handlers: { resize, keyDown, keyUp, blurWindow, startDrag, movePointer, leaveCanvas, clickCanvas, wheel, finishDrag },
    });
    frameId = requestAnimationFrame(drawFrame);
    return () => {
      cancelAnimationFrame(frameId);
      disposeEvents();
      clearSuppressClickTimeout();
    };
  }, [canvasRef, dispatch, setHoveredBuilding, setSelection]);
}
