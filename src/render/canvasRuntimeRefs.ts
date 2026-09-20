import type { TileCoordinate } from "../world/grid";
import type { CameraState } from "./camera";
import type { DragState } from "./canvasRuntime";
import type { PlacementFeedback } from "./placementFeedback";
import { createConstructionCompletionTracker, type ConstructionCompletionTracker } from "./constructionCompletionEffects";

export type CanvasMutableRefs = {
  readonly cameraRef: { current: CameraState };
  readonly hoverRef: { current: TileCoordinate | null };
  readonly feedbackRef: { current: PlacementFeedback | null };
  readonly dragRef: { current: DragState };
  readonly spacePressed: { current: boolean };
  readonly suppressClick: { current: boolean };
  readonly pixelRatioRef: { current: number };
  readonly completionTracker: ConstructionCompletionTracker;
};

export function createCanvasMutableRefs(camera: CameraState): CanvasMutableRefs {
  return {
    cameraRef: { current: camera },
    hoverRef: { current: null },
    feedbackRef: { current: null },
    dragRef: { current: { mode: "none", startCanvasPoint: null, startCamera: null, lastCanvasPoint: null, roadStart: null, moved: false } },
    spacePressed: { current: false },
    suppressClick: { current: false },
    pixelRatioRef: { current: 1 },
    completionTracker: createConstructionCompletionTracker(),
  };
}
