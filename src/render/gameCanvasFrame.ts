import type { GameState, OverlayMode } from "../engine/engine.types";
import { getTile, type TileCoordinate } from "../world/grid";
import type { CameraState } from "./camera";
import { placementPreview } from "./interactions";
import type { PlacementFeedback } from "./placementFeedback";
import type { PalisadeDraftState } from "./palisadeDraftInteraction";
import type { HouseMaterialWave } from "./buildingMaterialWave";
import { renderFrame, type PlacementTool } from "./renderer";
import { CANVAS_SURROUND_COLOR } from "./worldBackdrop";

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
  readonly placementFeedback: PlacementFeedback | null;
  readonly nowMs: number;
  readonly selectedBuildingId?: string | null;
  readonly selectedWalkerId?: string | null;
  readonly highlightedHouseIds?: readonly string[];
  readonly palisadeDraft?: PalisadeDraftState | null;
  readonly houseMaterialWave?: HouseMaterialWave | null;
  readonly palisadeCeremonyStartedAtMs?: number | null;
};

export function drawGameCanvasFrame(input: GameCanvasFrameInput): void {
  const inspectingBuilding =
    input.hoveredTile !== null && getTile(input.state, input.hoveredTile)?.buildingId !== null;
  const preview = placementPreview(
    input.state,
    input.selectedTool,
    inspectingBuilding ? null : input.hoveredTile,
    input.roadStart,
  );

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
    placementFeedback: input.placementFeedback,
    nowMs: input.nowMs,
    selectedBuildingId: input.selectedBuildingId ?? null,
    selectedWalkerId: input.selectedWalkerId ?? null,
    highlightedHouseIds: input.highlightedHouseIds ?? [],
    palisadeDraft: input.palisadeDraft ?? null,
    houseMaterialWave: input.houseMaterialWave ?? null,
    palisadeCeremonyStartedAtMs: input.palisadeCeremonyStartedAtMs ?? null,
  });
  input.context.restore();
}
