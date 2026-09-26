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
  readonly roadCancelled: { current: boolean };
  /** UX-3R2 road click-click: the tile the next click draws a road from (null: no chain). */
  readonly roadChain: { current: TileCoordinate | null };
  /** UX-3R2 tablet placement (UX3R 8절): the tile a tap put the ghost on, waiting for ✓ (null: none). */
  readonly pendingPlacement: { current: TileCoordinate | null };
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
    roadCancelled: { current: false },
    roadChain: { current: null },
    pendingPlacement: { current: null },
    spacePressed: { current: false },
    suppressClick: { current: false },
    pixelRatioRef: { current: 1 },
    completionTracker: createConstructionCompletionTracker(),
  };
}
