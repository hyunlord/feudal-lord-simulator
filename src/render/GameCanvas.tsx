import { useEffect, useRef, useState } from "react";

import type { OverlayMode } from "../engine/engine.types";
import { clampPan, clientToCanvas, type CameraState, type Point } from "./camera";
import {
  DEFAULT_PLACEMENT_TOOL,
  panByKey,
  placementPreview,
  pointerTile,
  releaseTileFromMouseUp,
  worldBounds,
  zoomAtPoint,
} from "./interactions";
import type { PlacementTool } from "./renderer";
import { renderFrame } from "./renderer";
import { useGameStore } from "../state/gameStore";
import { CANVAS_SURROUND_COLOR } from "./worldBackdrop";
import type { TileCoordinate } from "../world/grid";
import { getTile } from "../world/grid";
import { BuildingInspector, type HoveredBuilding } from "./BuildingInspector";
import {
  hoveredBuildingPosition,
  initialCamera,
  resizeCanvas,
  type DragState,
} from "./canvasRuntime";
import { preloadWorldAssets } from "./worldAssets";
type GameCanvasProps = { readonly selectedTool?: PlacementTool; readonly overlayMode?: OverlayMode };

export function GameCanvas({ selectedTool = DEFAULT_PLACEMENT_TOOL, overlayMode = "none" }: GameCanvasProps) {
  const { state, dispatch } = useGameStore();
  const [hoveredBuilding, setHoveredBuilding] = useState<HoveredBuilding | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null), stateRef = useRef(state);
  const selectedToolRef = useRef(selectedTool), overlayModeRef = useRef(overlayMode);

  useEffect(() => {
    stateRef.current = state;
    selectedToolRef.current = selectedTool;
    overlayModeRef.current = overlayMode;
  }, [overlayMode, selectedTool, state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d") ?? null;
    if (canvas === null || context === null) return undefined;

    void preloadWorldAssets();

    const cameraRef = { current: initialCamera(canvas, stateRef.current) };
    const hoverRef: { current: TileCoordinate | null } = { current: null };
    const dragRef: { current: DragState } = {
      current: { mode: "none", lastCanvasPoint: null, roadStart: null, moved: false },
    };
    const spacePressed = { current: false };
    const suppressClick = { current: false };
    const pixelRatioRef = { current: 1 };
    let frameId = 0;
    let suppressClickTimeout: number | null = null;
    const viewport = () => {
      const bounds = canvas.getBoundingClientRect();
      return { width: bounds.width, height: bounds.height };
    };
    const clampCamera = (camera: CameraState): CameraState =>
      clampPan(camera, viewport(), worldBounds(stateRef.current.width, stateRef.current.height));
    const resize = () => {
      pixelRatioRef.current = resizeCanvas(canvas, context);
      cameraRef.current = clampCamera(cameraRef.current);
    };
    const drawFrame = () => {
      const bounds = canvas.getBoundingClientRect();
      const camera = cameraRef.current;
      const currentState = stateRef.current;
      const currentTool = selectedToolRef.current;
      context.fillStyle = CANVAS_SURROUND_COLOR;
      context.fillRect(0, 0, bounds.width, bounds.height);
      context.save();
      context.setTransform(pixelRatioRef.current, 0, 0, pixelRatioRef.current, 0, 0);
      context.translate(camera.panX, camera.panY);
      context.scale(camera.zoom, camera.zoom);
      const hoveredTile = hoverRef.current;
      const inspectingBuilding = hoveredTile !== null && getTile(currentState, hoveredTile)?.buildingId !== null;
      const preview = placementPreview(
        currentState,
        currentTool,
        inspectingBuilding ? null : hoveredTile,
        dragRef.current.roadStart,
      );
      renderFrame({
        context,
        state: currentState,
        camera,
        viewport: bounds,
        preview,
        overlayMode: overlayModeRef.current,
      });
      context.restore();
      frameId = requestAnimationFrame(drawFrame);
    };
    const canvasPoint = (event: MouseEvent | WheelEvent): Point =>
      clientToCanvas(event, canvas.getBoundingClientRect());
    const updateHover = (event: MouseEvent) => {
      hoverRef.current = pointerTile(event, canvas.getBoundingClientRect(), cameraRef.current);
      const buildingId = hoverRef.current === null
        ? null : getTile(stateRef.current, hoverRef.current)?.buildingId ?? null;
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
      dragRef.current = { mode: "none", lastCanvasPoint: null, roadStart: null, moved: false };
    };
    const startDrag = (event: MouseEvent) => {
      updateHover(event);
      const point = canvasPoint(event);
      const panning = event.button === 1 || (event.button === 0 && spacePressed.current);
      if (panning) {
        dragRef.current = { mode: "pan", lastCanvasPoint: point, roadStart: null, moved: false };
        event.preventDefault();
        return;
      }
      if (event.button === 0 && selectedToolRef.current === "road") {
        dragRef.current = { mode: "road", lastCanvasPoint: point, roadStart: hoverRef.current, moved: false };
      }
    };
    const movePointer = (event: MouseEvent) => {
      updateHover(event);
      const drag = dragRef.current;
      if (drag.mode === "none" || drag.lastCanvasPoint === null) return;
      const point = canvasPoint(event);
      const moved = drag.moved || point.x !== drag.lastCanvasPoint.x || point.y !== drag.lastCanvasPoint.y;
      if (moved) suppressClick.current = true;
      if (drag.mode === "road") {
        dragRef.current = { ...drag, lastCanvasPoint: point, moved };
        return;
      }
      cameraRef.current = clampCamera({
        ...cameraRef.current,
        panX: cameraRef.current.panX + point.x - drag.lastCanvasPoint.x,
        panY: cameraRef.current.panY + point.y - drag.lastCanvasPoint.y,
      });
      dragRef.current = { ...drag, lastCanvasPoint: point, moved };
    };
    const finishDrag = (event: MouseEvent) => {
      const drag = dragRef.current;
      const destination = releaseTileFromMouseUp(event, canvas.getBoundingClientRect(), cameraRef.current);
      if (drag.mode === "road" && drag.roadStart !== null && destination !== null) {
        dispatch({ type: "place_road_line", start: drag.roadStart, destination });
      }
      resetDrag();
      clearSuppressClickTimeout();
      if (!drag.moved) {
        suppressClick.current = false;
        return;
      }
      suppressClick.current = true;
      suppressClickTimeout = window.setTimeout(() => {
        suppressClick.current = false;
        suppressClickTimeout = null;
      }, 0);
    };
    const clickCanvas = () => {
      if (suppressClick.current) {
        suppressClick.current = false;
        clearSuppressClickTimeout();
        return;
      }
      if (spacePressed.current) return;
      const drag = dragRef.current;
      const hover = hoverRef.current;
      const currentTool = selectedToolRef.current;
      if (drag.mode === "none" && hover !== null && currentTool !== "road") {
        dispatch({ type: "place_building", kind: currentTool, tx: hover.tx, ty: hover.ty });
      }
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      cameraRef.current = zoomAtPoint({
        camera: cameraRef.current,
        canvasPoint: canvasPoint(event),
        deltaY: event.deltaY,
        viewport: viewport(),
        world: worldBounds(stateRef.current.width, stateRef.current.height),
      });
    };
    const keyDown = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        spacePressed.current = true;
        event.preventDefault();
      }
      if (/^(?:w|a|s|d|ArrowUp|ArrowDown|ArrowLeft|ArrowRight)$/.test(event.key)) {
        event.preventDefault();
      }
      cameraRef.current = panByKey({
        camera: cameraRef.current,
        key: event.key,
        viewport: viewport(),
        world: worldBounds(stateRef.current.width, stateRef.current.height),
      });
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      spacePressed.current = false;
      event.preventDefault();
    };
    const leaveCanvas = () => {
      hoverRef.current = null;
      setHoveredBuilding(null);
    };
    const blurWindow = () => {
      spacePressed.current = false;
      hoverRef.current = null;
      setHoveredBuilding(null);
      suppressClick.current = false;
      clearSuppressClickTimeout();
      resetDrag();
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", blurWindow);
    canvas.addEventListener("mousedown", startDrag);
    canvas.addEventListener("mousemove", movePointer);
    canvas.addEventListener("mouseleave", leaveCanvas);
    canvas.addEventListener("click", clickCanvas);
    canvas.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("mouseup", finishDrag);
    frameId = requestAnimationFrame(drawFrame);
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", blurWindow);
      canvas.removeEventListener("mousedown", startDrag);
      canvas.removeEventListener("mousemove", movePointer);
      canvas.removeEventListener("mouseleave", leaveCanvas);
      canvas.removeEventListener("click", clickCanvas);
      canvas.removeEventListener("wheel", wheel);
      window.removeEventListener("mouseup", finishDrag);
      clearSuppressClickTimeout();
    };
  }, [dispatch]);

  return (
    <>
      <canvas ref={canvasRef} className="game-canvas" aria-label="Simulation canvas" />
      <BuildingInspector state={state} hover={hoveredBuilding} />
    </>
  );
}
