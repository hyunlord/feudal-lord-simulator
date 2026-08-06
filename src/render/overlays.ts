import type { GameState, OverlayMode } from "../engine/engine.types";
import { isPlacementFeedbackVisible, type PlacementFeedback } from "./placementFeedback";
import type { PlacementTool } from "./renderer";
import {
  drawPlacementFeedbackFailure,
  drawPlacementFeedbackSuccess,
  drawPlacementPreviewOverlay,
} from "./placementFeedbackOverlay";
import { drawLabourOverlay, drawWaterOverlay } from "./economyOverlays";
import { drawDistributionReach, drawSelectedRoadComponent } from "./diagnosticOverlays";

export { wellCoverageTiles } from "./economyOverlays";

export type EconomyOverlayRenderInput = {
  readonly context: CanvasRenderingContext2D;
  readonly state: GameState;
  readonly mode: OverlayMode;
  readonly zoom: number;
  readonly selectedBuildingId?: string | null;
};

export function drawOverlay(input: EconomyOverlayRenderInput): void {
  switch (input.mode) {
    case "none":
    case "food":
    case "roads":
      return;
    case "water":
      drawWaterOverlay(input);
      return;
    case "labour":
      drawLabourOverlay(input);
      return;
    case "distribution":
      drawDistributionReach({ ...input, selectedBuildingId: input.selectedBuildingId ?? null });
      return;
    case "road_component":
      drawSelectedRoadComponent({ ...input, selectedBuildingId: input.selectedBuildingId ?? null });
      return;
  }
}

export type PlacementPreview = {
  readonly tool: PlacementTool | null;
  readonly tile: { readonly tx: number; readonly ty: number } | null;
  readonly footprint: readonly { readonly tx: number; readonly ty: number }[];
  readonly roadPath: readonly { readonly tx: number; readonly ty: number }[];
  readonly ok: boolean;
  readonly reason: import("../world/placement").PlacementFailure | null;
  readonly cursor: { readonly tx: number; readonly ty: number } | null;
  readonly timberCost?: number | null;
};

export type PlacementOverlayInput = {
  readonly preview: PlacementPreview;
  readonly zoom: number;
};

export function drawPlacementOverlay(
  context: CanvasRenderingContext2D,
  input: PlacementOverlayInput,
): void {
  drawPlacementPreviewOverlay(context, input.preview, input.zoom);
}

export type PlacementFeedbackOverlayInput = {
  readonly feedback: PlacementFeedback | null;
  readonly nowMs: number;
  readonly zoom: number;
};

export function drawPlacementFeedbackOverlay(
  context: CanvasRenderingContext2D,
  input: PlacementFeedbackOverlayInput,
): void {
  const feedback = input.feedback;
  if (feedback === null || !isPlacementFeedbackVisible(feedback, input.nowMs)) return;

  switch (feedback.kind) {
    case "success":
      drawPlacementFeedbackSuccess(context, feedback, input.nowMs, input.zoom);
      return;
    case "failure":
      drawPlacementFeedbackFailure(context, feedback, input.zoom);
      return;
  }
}
