import type { GameState } from "../engine/engine.types";
import type { TileCoordinate } from "../world/grid";
import type { CameraState, Point } from "./camera";
import type { DragState } from "./canvasRuntime";
import { resolveRoadPlacementAttempt, type PlacementAttemptOutcome } from "./interactions";
import type { PlacementTool } from "./renderer";

export function beginCanvasDrag(input: Readonly<{
  button: number;
  point: Point;
  hover: TileCoordinate | null;
  spacePressed: boolean;
  selectedTool: PlacementTool | null;
}>): { readonly drag: DragState; readonly preventDefault: boolean } {
  const panning = input.button === 1 || (input.button === 0 && input.spacePressed);
  if (panning) {
    return {
      drag: { mode: "pan", lastCanvasPoint: input.point, roadStart: null, moved: false },
      preventDefault: true,
    };
  }
  if (input.button === 0 && input.selectedTool === "road") {
    return {
      drag: { mode: "road", lastCanvasPoint: input.point, roadStart: input.hover, moved: false },
      preventDefault: false,
    };
  }
  return {
    drag: { mode: "none", lastCanvasPoint: null, roadStart: null, moved: false },
    preventDefault: false,
  };
}

export function advanceCanvasDrag(input: Readonly<{
  drag: DragState;
  point: Point;
  camera: CameraState;
}>): Readonly<{ drag: DragState; camera: CameraState; suppressClick: boolean }> {
  const { drag } = input;
  if (drag.mode === "none" || drag.lastCanvasPoint === null) {
    return { drag, camera: input.camera, suppressClick: false };
  }
  const moved = drag.moved
    || input.point.x !== drag.lastCanvasPoint.x
    || input.point.y !== drag.lastCanvasPoint.y;
  const nextDrag = { ...drag, lastCanvasPoint: input.point, moved };
  if (drag.mode === "road" || drag.mode === "palisade") {
    return { drag: nextDrag, camera: input.camera, suppressClick: moved };
  }
  return {
    drag: nextDrag,
    camera: {
      ...input.camera,
      panX: input.camera.panX + input.point.x - drag.lastCanvasPoint.x,
      panY: input.camera.panY + input.point.y - drag.lastCanvasPoint.y,
    },
    suppressClick: moved,
  };
}

export function finishedRoadAttempt(
  state: GameState,
  drag: DragState,
  destination: TileCoordinate | null,
  nowMs: number,
): PlacementAttemptOutcome | null {
  return drag.mode === "road" && drag.roadStart !== null && destination !== null
    ? resolveRoadPlacementAttempt({ state, start: drag.roadStart, destination, nowMs })
    : null;
}
