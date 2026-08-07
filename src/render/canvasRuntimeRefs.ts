import type { TileCoordinate } from "../world/grid";
import type { CameraState } from "./camera";
import type { DragState } from "./canvasRuntime";
import type { PlacementFeedback } from "./placementFeedback";
import type { ConstructionCompletionTracker } from "./constructionCompletionEffects";

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
