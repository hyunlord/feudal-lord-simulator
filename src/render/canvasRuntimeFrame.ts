import type { GameState, OverlayMode } from "../engine/engine.types";
import type { TileCoordinate } from "../world/grid";
import type { CameraState } from "./camera";
import type { DragState } from "./canvasRuntime";
import { drawGameCanvasFrame } from "./gameCanvasFrame";
import { isPlacementFeedbackVisible, type PlacementFeedback } from "./placementFeedback";
import type { PalisadeDraftState } from "./palisadeDraftInteraction";
import type { PlacementTool } from "./renderer";
import type { AnchoredWorldSelection } from "./worldSelection";

export type CanvasFrameRefs = Readonly<{
  cameraRef: { current: CameraState };
  hoverRef: { current: TileCoordinate | null };
  feedbackRef: { current: PlacementFeedback | null };
  dragRef: { current: DragState };
  pixelRatioRef: { current: number };
}>;

export function drawCurrentCanvasFrame(input: Readonly<{
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  refs: CanvasFrameRefs;
  state: GameState;
  selectedTool: PlacementTool | null;
  overlayMode: OverlayMode;
  selection: AnchoredWorldSelection | null;
  highlightedHouseIds: readonly string[];
  palisadeDraft?: PalisadeDraftState | null;
}>): void {
  const nowMs = performance.now();
  if (!isPlacementFeedbackVisible(input.refs.feedbackRef.current, nowMs)) {
    input.refs.feedbackRef.current = null;
  }
  drawGameCanvasFrame({
    context: input.context,
    state: input.state,
    camera: input.refs.cameraRef.current,
    viewport: input.canvas.getBoundingClientRect(),
    pixelRatio: input.refs.pixelRatioRef.current,
    hoveredTile: input.refs.hoverRef.current,
    roadStart: input.refs.dragRef.current.roadStart,
    selectedTool: input.selectedTool,
    overlayMode: input.overlayMode,
    placementFeedback: input.refs.feedbackRef.current,
    nowMs,
    selectedBuildingId: input.selection?.kind === "building" ? input.selection.buildingId : null,
    selectedWalkerId: input.selection?.kind === "walker" ? input.selection.walkerId : null,
    highlightedHouseIds: input.highlightedHouseIds,
    palisadeDraft: input.palisadeDraft ?? null,
  });
}
