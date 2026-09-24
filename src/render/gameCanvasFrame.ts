import type { Walker } from "../agents/walker.types";
import type { GameState, OverlayMode } from "../engine/engine.types";
import type { TileCoordinate } from "../world/grid";
import type { CameraState } from "./camera";
import { cachedPlacementPreview } from "./placementPredictionRuntime";
import type { PlacementPreview } from "./overlays";
import type { PlacementFeedback } from "./placementFeedback";
import type { PalisadeDraftState } from "./palisadeDraftInteraction";
import type { HouseMaterialWave } from "./buildingMaterialWave";
import { renderFrame, type PlacementTool } from "./renderer";
import { CANVAS_SURROUND_COLOR } from "./worldBackdrop";
import type { ConstructionCompletionTracker } from "./constructionCompletionEffects";
import { drawConstructionAccessOverlay } from './constructionAccessOverlay';
import { renderStageProbe } from "./renderStageProbe";

type GameCanvasFrameInput = {
  readonly context: CanvasRenderingContext2D;
  readonly state: GameState;
  readonly camera: CameraState;
  readonly viewport: DOMRect;
  readonly pixelRatio: number;
  readonly hoveredTile: TileCoordinate | null;
  readonly roadStart: TileCoordinate | null;
  readonly selectedTool: PlacementTool | null;
  readonly overlayMode: OverlayMode;
  readonly problemOnly?: boolean;
  readonly placementFeedback: PlacementFeedback | null;
  readonly nowMs: number;
  readonly selectedBuildingId?: string | null;
  readonly selectedWalkerId?: string | null;
  readonly selectedConstructionSiteId?: string | null;
  readonly renderWalkers?: readonly Walker[] | undefined;
  readonly constructionProgress?: ReadonlyMap<string, number> | undefined;
  readonly highlightedHouseIds?: readonly string[];
  readonly palisadeDraft?: PalisadeDraftState | null;
  readonly zoneBrush?: import("./zoneBrushOverlay").ZoneBrushView | null;
  readonly houseMaterialWave?: HouseMaterialWave | null;
  readonly palisadeCeremonyStartedAtMs?: number | null;
  readonly completionTracker: ConstructionCompletionTracker;
};

export function drawGameCanvasFrame(input: GameCanvasFrameInput): PlacementPreview {
  const probe = renderStageProbe.current;
  probe?.enter("frame.placementPreview");
  const preview = cachedPlacementPreview(
    input.state,
    input.selectedTool,
    input.hoveredTile,
    input.roadStart,
    input.selectedConstructionSiteId ?? null,
  );

  probe?.enter("frame.clear");
  input.context.fillStyle = CANVAS_SURROUND_COLOR;
  input.context.fillRect(0, 0, input.viewport.width, input.viewport.height);
  input.context.save();
  input.context.setTransform(input.pixelRatio, 0, 0, input.pixelRatio, 0, 0);
  input.context.translate(input.camera.panX, input.camera.panY);
  input.context.scale(input.camera.zoom, input.camera.zoom);
  renderFrame({
    context: input.context,
    state: input.state,
    camera: input.camera,
    viewport: input.viewport,
    preview,
    overlayMode: input.overlayMode,
    problemOnly: input.problemOnly ?? false,
    placementFeedback: input.placementFeedback,
    nowMs: input.nowMs,
    selectedBuildingId: input.selectedBuildingId ?? null,
    selectedWalkerId: input.selectedWalkerId ?? null,
    renderWalkers: input.renderWalkers,
    constructionProgress: input.constructionProgress,
    highlightedHouseIds: input.highlightedHouseIds ?? [],
    palisadeDraft: input.palisadeDraft ?? null,
    zoneBrush: input.zoneBrush ?? null,
    houseMaterialWave: input.houseMaterialWave ?? null,
    palisadeCeremonyStartedAtMs: input.palisadeCeremonyStartedAtMs ?? null,
    completionTracker: input.completionTracker,
    hoveredTile: input.hoveredTile,
    selectionMode: input.selectedTool === null && input.palisadeDraft == null && input.zoneBrush == null,
  });
  if (input.selectedConstructionSiteId !== undefined && input.selectedConstructionSiteId !== null) {
    probe?.enter("overlay.constructionAccess");
    drawConstructionAccessOverlay(input.context, input.state, input.selectedConstructionSiteId, input.camera.zoom);
  }
  input.context.restore();
  return preview;
}
