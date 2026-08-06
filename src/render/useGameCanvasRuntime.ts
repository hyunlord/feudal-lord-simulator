import { useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from "react";

import type { GameState, OverlayMode } from "../engine/engine.types";
import type { GameAction } from "../state/gameStore.types";
import { getTile, type TileCoordinate } from "../world/grid";
import type { HoveredBuilding } from "./BuildingInspector";
import { clampPan, clientToCanvas, type CameraState, type Point } from "./camera";
import { hoveredBuildingPosition, initialCamera, resizeCanvas, type DragState } from "./canvasRuntime";
import {
  panByKey,
  pointerTile,
  releaseTileFromMouseUp,
  resolveBuildingPlacementAttempt,
  resolveRoadPlacementAttempt,
  worldBounds,
  zoomAtPoint,
} from "./interactions";
import { isPlacementFeedbackVisible, type PlacementFeedback } from "./placementFeedback";
import type { PlacementTool } from "./renderer";
import { bindGameCanvasEvents } from "./gameCanvasEvents";
import { drawGameCanvasFrame } from "./gameCanvasFrame";
import { preloadWorldAssets } from "./worldAssets";
import { placeDiagnosticCard } from "./DiagnosticCard";
import {
  selectWorldAtTile,
  type AnchoredWorldSelection,
} from "./worldSelection";

type GameCanvasRuntimeInput = {
  readonly canvasRef: RefObject<HTMLCanvasElement | null>;
  readonly state: GameState;
  readonly dispatch: Dispatch<GameAction>;
  readonly selectedTool: PlacementTool | null;
  readonly overlayMode: OverlayMode;
  readonly setHoveredBuilding: Dispatch<SetStateAction<HoveredBuilding | null>>;
  readonly selection: AnchoredWorldSelection | null;
  readonly setSelection: Dispatch<SetStateAction<AnchoredWorldSelection | null>>;
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

  useEffect(() => {
    stateRef.current = state;
    selectedToolRef.current = selectedTool;
    overlayModeRef.current = overlayMode;
    selectionRef.current = selection;
  }, [overlayMode, selectedTool, selection, state]);

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
      const bounds = canvas.getBoundingClientRect();
      const camera = refs.cameraRef.current;
      const currentState = stateRef.current;
      const currentTool = selectedToolRef.current;
      const nowMs = performance.now();
      if (!isPlacementFeedbackVisible(refs.feedbackRef.current, nowMs)) {
        refs.feedbackRef.current = null;
      }
      drawGameCanvasFrame({
        context,
        state: currentState,
        camera,
        viewport: bounds,
        pixelRatio: refs.pixelRatioRef.current,
        hoveredTile: refs.hoverRef.current,
        roadStart: refs.dragRef.current.roadStart,
        selectedTool: currentTool,
        overlayMode: overlayModeRef.current,
        placementFeedback: refs.feedbackRef.current,
        nowMs,
        selectedBuildingId: selectionRef.current?.kind === "building"
          ? selectionRef.current.buildingId
          : null,
        selectedWalkerId: selectionRef.current?.kind === "walker"
          ? selectionRef.current.walkerId
          : null,
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
      const point = canvasPoint(event);
      const panning = event.button === 1 || (event.button === 0 && refs.spacePressed.current);
      if (panning) {
        refs.dragRef.current = { mode: "pan", lastCanvasPoint: point, roadStart: null, moved: false };
        event.preventDefault();
        return;
      }
      if (event.button === 0 && selectedToolRef.current === "road") {
        refs.dragRef.current = { mode: "road", lastCanvasPoint: point, roadStart: refs.hoverRef.current, moved: false };
      }
    };
    const movePointer = (event: MouseEvent) => {
      updateHover(event);
      const drag = refs.dragRef.current;
      if (drag.mode === "none" || drag.lastCanvasPoint === null) return;
      const point = canvasPoint(event);
      const moved = drag.moved || point.x !== drag.lastCanvasPoint.x || point.y !== drag.lastCanvasPoint.y;
      if (moved) refs.suppressClick.current = true;
      if (drag.mode === "road") {
        refs.dragRef.current = { ...drag, lastCanvasPoint: point, moved };
        return;
      }
      refs.cameraRef.current = clampCamera({
        ...refs.cameraRef.current,
        panX: refs.cameraRef.current.panX + point.x - drag.lastCanvasPoint.x,
        panY: refs.cameraRef.current.panY + point.y - drag.lastCanvasPoint.y,
      });
      refs.dragRef.current = { ...drag, lastCanvasPoint: point, moved };
    };
    const finishDrag = (event: MouseEvent) => {
      const drag = refs.dragRef.current;
      const destination = releaseTileFromMouseUp(event, canvas.getBoundingClientRect(), refs.cameraRef.current);
      if (drag.mode === "road" && drag.roadStart !== null && destination !== null) {
        const attempt = resolveRoadPlacementAttempt({
          state: stateRef.current,
          start: drag.roadStart,
          destination,
          nowMs: performance.now(),
        });
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
      if (refs.suppressClick.current) {
        refs.suppressClick.current = false;
        clearSuppressClickTimeout();
        return;
      }
      if (refs.spacePressed.current) return;
      const drag = refs.dragRef.current;
      const hover = refs.hoverRef.current;
      const currentTool = selectedToolRef.current;
      if (drag.mode === "none" && hover !== null && currentTool === null) {
        const selected = selectWorldAtTile(stateRef.current, hover);
        if (selected === null) {
          setSelection(null);
        } else {
          const bounds = canvas.getBoundingClientRect();
          const point = canvasPoint(event);
          const position = placeDiagnosticCard(
            { width: bounds.width, height: bounds.height },
            { x: point.x - 12, y: point.y - 12, width: 24, height: 24 },
            { width: 300, height: 260 },
          );
          setSelection({ ...selected, position });
        }
        return;
      }
      if (drag.mode === "none" && hover !== null && currentTool !== null && currentTool !== "road") {
        const attempt = resolveBuildingPlacementAttempt({
          state: stateRef.current,
          tool: currentTool,
          tile: hover,
          nowMs: performance.now(),
        });
        refs.feedbackRef.current = attempt.feedback;
        if (attempt.action !== null) dispatch(attempt.action);
      }
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
      if (event.code === "Space") {
        refs.spacePressed.current = true;
        event.preventDefault();
      }
      if (event.code === "Escape") setSelection(null);
      if (/^(?:w|a|s|d|ArrowUp|ArrowDown|ArrowLeft|ArrowRight)$/.test(event.key)) {
        event.preventDefault();
      }
      refs.cameraRef.current = panByKey({
        camera: refs.cameraRef.current,
        key: event.key,
        viewport: viewport(),
        world: worldBounds(stateRef.current.width, stateRef.current.height),
      });
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
