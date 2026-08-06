import type { BuildingKind } from "../content/buildingConfig";
import type { GameState, OverlayMode } from "../engine/engine.types";
import type { CameraState } from "./camera";
import { drawBuildings } from "./drawBuildings";
import { drawTerrain } from "./drawTerrain";
import { drawWorldVignette } from "./worldBackdrop";
import {
  drawOverlay,
  drawPlacementFeedbackOverlay,
  drawPlacementOverlay,
  type PlacementPreview,
} from "./overlays";
import type { PlacementFeedback } from "./placementFeedback";
import { renderDetailLevel } from "./buildingVisualState";
import { drawOnboardingGuidanceOverlay } from "./onboardingGuidanceOverlay";
import { objectRenderItemsForFrame } from "./renderObjectFrameCache";
import { computeVisibleTileRange, visibleTilesInDrawOrder } from "./renderVisibility";
import type { ViewportSize } from "./renderVisibility";
import { onboardingWorldGuidanceTargets } from "../ui/onboardingWorldGuidance";
import { drawSelectedWalkerPath } from "./diagnosticPathOverlay";

export { ambientOffset, objectPhase, type AmbientInput } from "./renderMotion";
export {
  computeVisibleTileRange,
  visibleTilesInDrawOrder,
  type TileRange,
  type ViewportSize,
  type VisibleRangeInput,
  type WorldSize,
} from "./renderVisibility";
export { objectRenderItemsForFrame } from "./renderObjectFrameCache";

export type PlacementTool = BuildingKind | "road";

export type RenderPasses = {
  readonly ground: () => void;
  readonly objects: () => void;
  readonly overhang: () => void;
};
export type RenderFrameInput = {
  readonly context: CanvasRenderingContext2D;
  readonly state: GameState;
  readonly camera: CameraState;
  readonly viewport: ViewportSize;
  readonly preview: PlacementPreview;
  readonly overlayMode?: OverlayMode;
  readonly placementFeedback?: PlacementFeedback | null;
  readonly nowMs?: number;
  readonly selectedBuildingId?: string | null;
  readonly selectedWalkerId?: string | null;
};

export const renderFrame = (input: RenderFrameInput): void => {
  const range = computeVisibleTileRange({
    camera: input.camera,
    viewport: input.viewport,
    world: input.state,
  });
  const visibleTiles = visibleTilesInDrawOrder({ grid: input.state, range });
  const objectRenderItems = objectRenderItemsForFrame({
    state: input.state,
    visibleTiles,
    range,
    includeGroundCover: renderDetailLevel(input.camera.zoom) === "full",
  });
  runRenderPasses({
    ground: () => {
      drawWorldVignette(input.context, input.state);
      drawTerrain(input.context, {
        state: input.state,
        tiles: visibleTiles,
        range,
        zoom: input.camera.zoom,
        objectRenderItems,
      });
    },
    objects: () =>
      drawBuildings(input.context, {
        state: input.state,
        tiles: visibleTiles,
        range,
        zoom: input.camera.zoom,
        camera: input.camera,
        dpr: devicePixelRatioFor(input.context, input.viewport),
        viewport: input.viewport,
        objectRenderItems,
      }),
    overhang: () => undefined,
  });
  drawOverlay({
    context: input.context,
    state: input.state,
    mode: input.overlayMode ?? "none",
    zoom: input.camera.zoom,
    selectedBuildingId: input.selectedBuildingId ?? null,
  });
  const selectedWalker = input.selectedWalkerId === undefined || input.selectedWalkerId === null
    ? undefined
    : input.state.walkers.find((walker) => walker.id === input.selectedWalkerId);
  if (selectedWalker !== undefined) {
    drawSelectedWalkerPath(input.context, selectedWalker, input.camera.zoom);
  }
  drawPlacementOverlay(input.context, { preview: input.preview, zoom: input.camera.zoom });
  drawOnboardingGuidanceOverlay(input.context, {
    targets: onboardingWorldGuidanceTargets(input.state),
    zoom: input.camera.zoom,
  });
  drawPlacementFeedbackOverlay(input.context, {
    feedback: input.placementFeedback ?? null,
    nowMs: input.nowMs ?? 0,
    zoom: input.camera.zoom,
  });
};

export const runRenderPasses = (passes: RenderPasses): void => {
  passes.ground();
  passes.objects();
  passes.overhang();
};

const devicePixelRatioFor = (
  context: CanvasRenderingContext2D,
  viewport: ViewportSize,
): number => {
  if (viewport.width <= 0) return 1;
  const dpr = context.canvas.width / viewport.width;
  return Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
};
