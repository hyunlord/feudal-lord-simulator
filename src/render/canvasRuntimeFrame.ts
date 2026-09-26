import type { Walker } from "../agents/walker.types";
import type { GameState, OverlayMode } from "../engine/engine.types";
import type { TileCoordinate } from "../world/grid";
import type { CameraState } from "./camera";
import type { DragState } from "./canvasRuntime";
import { drawGameCanvasFrame } from "./gameCanvasFrame";
import { isPlacementFeedbackVisible, type PlacementFeedback } from "./placementFeedback";
import type { PalisadeDraftState } from "./palisadeDraftInteraction";
import type { HouseMaterialWave } from "./buildingMaterialWave";
import type { PlacementTool } from "./renderer";
import type { AnchoredWorldSelection } from "./worldSelection";
import type { ConstructionCompletionTracker } from "./constructionCompletionEffects";
import { interpolatedConstructionProgress } from "./constructionInterpolation";
import { interpolatedWalkerPositions } from "./walkerInterpolation";
import { zoneBrushPreview } from "./zoneBrushOverlay";
import { boundaryV2Enabled } from "./renderBoundaryFlag";
import { roadAlignedWalkers } from "./walkerRoadAlignment";
import { renderStageProbe } from "./renderStageProbe";
import { beginGroundSceneFrame } from "./groundBoundaryScene";
import { observeSoundFrame } from "../audio/soundDirector";

export type CanvasFrameRefs = Readonly<{
  cameraRef: { current: CameraState };
  hoverRef: { current: TileCoordinate | null };
  feedbackRef: { current: PlacementFeedback | null };
  dragRef: { current: DragState };
  /** UX-3R2 road click-click anchor (absent in callers without one). */
  roadChain?: { current: TileCoordinate | null };
  pendingPlacement?: { current: TileCoordinate | null };
  pixelRatioRef: { current: number };
  completionTracker: ConstructionCompletionTracker;
}>;

export function drawCurrentCanvasFrame(input: Readonly<{
  canvas: HTMLCanvasElement;
  publishPrediction?: (preview: import("./overlays").PlacementPreview, camera: CameraState) => void;
  context: CanvasRenderingContext2D;
  refs: CanvasFrameRefs;
  state: GameState;
  selectedTool: PlacementTool | null;
  overlayMode: OverlayMode;
  problemOnly?: boolean;
  selection: AnchoredWorldSelection | null;
  previousRenderState: Pick<GameState, "constructionSites" | "walkers">;
  interpolationAlpha: () => number;
  highlightedHouseIds: readonly string[];
  palisadeDraft?: PalisadeDraftState | null;
  /** Armed zone brush with its gesture and pointer (C1b), or null. */
  zoneBrush?: import("./zoneBrushOverlay").ZoneBrushView | null;
  houseMaterialWave?: HouseMaterialWave | null;
  palisadeCeremonyStartedAtMs?: number | null;
}>): void {
  const probe = renderStageProbe.current;
  probe?.frameStart();
  if (boundaryV2Enabled()) beginGroundSceneFrame();
  const nowMs = performance.now();
  if (!isPlacementFeedbackVisible(input.refs.feedbackRef.current, nowMs)) {
    input.refs.feedbackRef.current = null;
  }
  // A road chain belongs to the road tool: another tool (or none) drops it.
  if (input.selectedTool !== "road" && input.refs.roadChain !== undefined) input.refs.roadChain.current = null;
  if ((input.selectedTool === null || input.selectedTool === "road") && input.refs.pendingPlacement !== undefined) input.refs.pendingPlacement.current = null;
  const interpolationAlpha = input.interpolationAlpha();
  const preview = drawGameCanvasFrame({
    context: input.context,
    state: input.state,
    camera: input.refs.cameraRef.current,
    viewport: input.canvas.getBoundingClientRect(),
    pixelRatio: input.refs.pixelRatioRef.current,
    hoveredTile: input.refs.hoverRef.current,
    // UX-3R2: a click-click road chain previews from its anchor like a drag from its start.
    roadStart: input.refs.dragRef.current.roadStart ?? (input.selectedTool === "road" ? input.refs.roadChain?.current ?? null : null),
    selectedTool: input.selectedTool,
    overlayMode: input.overlayMode,
    problemOnly: input.problemOnly ?? false,
    placementFeedback: input.refs.feedbackRef.current,
    nowMs,
    selectedBuildingId: input.selection?.kind === "building" ? input.selection.buildingId : null,
    selectedWalkerId: input.selection?.kind === "walker" ? input.selection.walkerId : null,
    selectedConstructionSiteId: input.selection?.kind === 'construction_site' ? input.selection.siteId : null,
    renderWalkers: displayWalkers(input.state, interpolatedWalkerPositions({
      previous: input.previousRenderState,
      current: input.state,
      alpha: interpolationAlpha,
    })),
    constructionProgress: interpolatedConstructionProgress({
      previous: input.previousRenderState.constructionSites,
      current: input.state.constructionSites,
      alpha: interpolationAlpha,
    }),
    highlightedHouseIds: input.highlightedHouseIds,
    palisadeDraft: input.palisadeDraft ?? null,
    zoneBrush: input.zoneBrush ?? null,
    houseMaterialWave: input.houseMaterialWave ?? null,
    palisadeCeremonyStartedAtMs: input.palisadeCeremonyStartedAtMs ?? null,
    completionTracker: input.refs.completionTracker,
  });
  probe?.enter("frame.publish");
  const zoneBrush = input.zoneBrush ?? null;
  if (zoneBrush === null) input.publishPrediction?.(preview, input.refs.cameraRef.current);
  else {
    // While a zone tool is armed the prediction panel shows the paint lines at the pointer.
    const lines = zoneBrushPreview(input.state, zoneBrush).lines;
    const cursor = zoneBrush.hover === null ? null : { tx: Math.floor(zoneBrush.hover.x), ty: Math.floor(zoneBrush.hover.y) };
    const { prediction: _placementPrediction, ...base } = preview;
    // The publisher only reads `lines` from the prediction (PredictionPanel shows lines at a position).
    input.publishPrediction?.(lines.length === 0 ? { ...base, cursor }
      : { ...base, cursor, prediction: { lines } as unknown as NonNullable<typeof preview.prediction> }, input.refs.cameraRef.current);
  }
  // F0-V: the frame's world sounds (deliveries, stages, completions, hammering, carts, spring).
  observeSoundFrame(input.state, input.refs.cameraRef.current, input.canvas.getBoundingClientRect(), nowMs);
  probe?.frameEnd();
}

/** With curved ground on, walkers on roads are drawn on the ribbon centreline (display only). */
function displayWalkers(state: GameState, walkers: readonly Walker[]): readonly Walker[] {
  return boundaryV2Enabled() ? roadAlignedWalkers(state, walkers) : walkers;
}
