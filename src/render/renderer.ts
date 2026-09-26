import { drawZoneBrushOverlay, type ZoneBrushView } from "./zoneBrushOverlay";
import { drawPlacementPrediction } from "./placementPredictionOverlay";
import { drawCauseMap } from "./causeMapOverlay";
import type { Walker } from "../agents/walker.types";
import type { BuildingKind } from "../content/buildingConfig";
import type { GameState, OverlayMode } from "../engine/engine.types";
import { availableStock } from '../economy/storage';
import type { TileCoordinate } from "../world/grid";
import type { CameraState } from "./camera";
import { drawObjectRenderItems } from "./drawObjectRenderItems";
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
import { setTutorialTargetCanvasPoint, tutorialMapTarget } from "../ui/tutorial/tutorialMapChannel";
import { tileToScreen } from "./iso";
import { drawSelectedWalkerPath } from "./diagnosticPathOverlay";
import { drawHighlightedHouses } from "./diagnosticOverlays";
import {
  createConstructionCompletionTracker,
  constructionCompletionEffectsForFrame,
  drawConstructionCompletionEffects,
  type ConstructionCompletionTracker,
} from "./constructionCompletionEffects";
import { drawPalisadeGateFlourish, drawPalisadeRun } from "./drawPalisadeSegments";
import { previewPalisadeDraftRouteAccess, type PalisadeRouteAccess } from "../engine/palisadeRouteAccess";
import { nearestWallAnchorCandidate } from '../ui/wallPrediction';
import { drawPalisadeRoutePreviewOverlay } from "./palisadeRoutePreviewOverlay";
import { drawPalisadeDraftOverlay } from './palisadeDraftOverlay';
import type { PalisadeDraftState } from "./palisadeDraftInteraction";
import type { HouseMaterialWave } from "./buildingMaterialWave";
import { renderStageProbe } from "./renderStageProbe";
import { forgetGoneConstructionSites } from "./constructionMoments";
import { drawSeasonalDecals, drawWorldSigns } from "./worldSigns";

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
  readonly problemOnly?: boolean;
  readonly placementFeedback?: PlacementFeedback | null;
  readonly nowMs?: number;
  readonly selectedBuildingId?: string | null;
  readonly selectedWalkerId?: string | null;
  readonly renderWalkers?: readonly Walker[] | undefined;
  readonly constructionProgress?: ReadonlyMap<string, number> | undefined;
  readonly highlightedHouseIds?: readonly string[];
  readonly palisadeDraft?: PalisadeDraftState | null;
  readonly zoneBrush?: ZoneBrushView | null;
  readonly houseMaterialWave?: HouseMaterialWave | null;
  readonly palisadeCeremonyStartedAtMs?: number | null;
  readonly completionTracker?: ConstructionCompletionTracker;
  readonly hoveredTile?: TileCoordinate | null;
  readonly selectionMode?: boolean;
};

let objectPassForProof = true;
/** Proof hook (C1d gate 1): skip the object pass and every overlay so a wedge check can read the ground layer alone. */
export function setObjectPassForProof(enabled: boolean): void { objectPassForProof = enabled; }

export const renderFrame = (input: RenderFrameInput): void => {
  const probe = renderStageProbe.current;
  probe?.enter("objects.sort");
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
    renderWalkers: input.renderWalkers,
  });
  forgetGoneConstructionSites(input.state.constructionSites);
  const constructionEffects = constructionCompletionEffectsForFrame(
    input.completionTracker ?? createConstructionCompletionTracker(),
    input.state.constructionSites,
    input.nowMs ?? performance.now(),
    input.state.buildings.map(building => building.id),
  );
  probe?.noteScene(visibleTiles.length, objectRenderItems);
  runRenderPasses({
    ground: () => {
      probe?.enter("terrain.water");
      drawWorldVignette(input.context, input.state);
      drawTerrain(input.context, {
        state: input.state,
        tiles: visibleTiles,
        range,
        zoom: input.camera.zoom,
        objectRenderItems,
      });
      drawSeasonalDecals(input.context, input.state, visibleTiles, input.camera.zoom); // INSTALL-7 frost, leaves, dry grass
    },
    objects: () => objectPassForProof &&
      drawObjectRenderItems(input.context, {
        state: input.state,
        problemOnly: input.problemOnly ?? false,
        tiles: visibleTiles,
        range,
        zoom: input.camera.zoom,
        camera: input.camera,
        dpr: devicePixelRatioFor(input.context, input.viewport),
        viewport: input.viewport,
        objectRenderItems,
        constructionProgress: input.constructionProgress,
        houseMaterialWave: input.houseMaterialWave ?? null,
        nowMs: input.nowMs ?? 0,
        hoveredTile: input.hoveredTile ?? null,
      selectionMode: input.selectionMode ?? false,
      }),
    overhang: () => {
      probe?.enter("effects");
      drawWorldSigns(input.context, input.state, input.camera, input.viewport); // F0-V world signs
      drawConstructionCompletionEffects(input.context, {
        effects: constructionEffects,
        zoom: input.camera.zoom,
      });
    },
  });
  if (!objectPassForProof) return;
  probe?.enter("overlay.mode");
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
  drawHighlightedHouses({
    context: input.context,
    state: input.state,
    zoom: input.camera.zoom,
    selectedBuildingId: input.selectedBuildingId ?? null,
    houseIds: input.highlightedHouseIds ?? [],
  });
  probe?.enter("overlay.wallDraft");
  if (input.palisadeDraft !== undefined && input.palisadeDraft !== null) {
    const path = input.palisadeDraft.path;
    const routeAccess = path.length >= 2 ? cachedPalisadeRoutePreview(input.state, path) : null;
    drawPalisadeRun(input.context, {
      path,
      style: "plot",
      zoom: input.camera.zoom,
    });
    const unreachablePaths = routeAccess?.segments
      .filter(segment => segment.status === 'unreachable').map(segment => segment.path) ?? [];
    drawPalisadeRoutePreviewOverlay(input.context, unreachablePaths, input.camera.zoom);
    drawPalisadeDraftOverlay(input.context, input.state, input.palisadeDraft,
      input.camera.zoom, routeAccess?.gates ?? [], routeAccess?.segments ?? [],
      routeAccess === null ? null : nearestWallAnchorCandidate(routeAccess)?.siteId ?? null);
  }
  if (input.zoneBrush !== undefined && input.zoneBrush !== null) {
    drawZoneBrushOverlay(input.context, input.state, input.zoneBrush, input.camera.zoom);
  }
  if (input.palisadeCeremonyStartedAtMs !== undefined && input.palisadeCeremonyStartedAtMs !== null && input.state.palisade !== null) {
    drawPalisadeGateFlourish(input.context, {
      gate: input.state.palisade.gate,
      zoom: input.camera.zoom,
      progress: Math.max(0, Math.min(1, ((input.nowMs ?? 0) - input.palisadeCeremonyStartedAtMs) / 2_000)),
    });
  }
  probe?.enter("overlay.placement");
  drawPlacementOverlay(input.context, { preview: input.preview, zoom: input.camera.zoom });
  if (input.preview.prediction !== undefined) drawPlacementPrediction(input.context, input.state, input.preview.prediction, input.camera.zoom);
  probe?.enter("overlay.cause");
  drawCauseMap(input.context, input.state, input.camera.zoom, input.problemOnly ?? false);
  probe?.enter("overlay.onboarding");
  // UX-1: the tutorial step's halo (the goal card's suggested spot) replaces the old per-task map guidance, which had
  // no card of its own any more (UX-0: it pointed at spots off the road).
  const tutorialTarget = tutorialMapTarget();
  if (tutorialTarget === null) setTutorialTargetCanvasPoint(null);
  else {
    const focus = tileToScreen(tutorialTarget.focus.tx, tutorialTarget.focus.ty);
    setTutorialTargetCanvasPoint({ x: focus.sx * input.camera.zoom + input.camera.panX, y: focus.sy * input.camera.zoom + input.camera.panY });
  }
  drawOnboardingGuidanceOverlay(input.context, {
    targets: tutorialTarget === null ? [] : [{ kind: "road", label: tutorialTarget.label, origin: tutorialTarget.focus,
      ...(tutorialTarget.tiles.length > 1 ? { region: tutorialTarget.tiles } : {}) }],
    zoom: input.camera.zoom,
  });
  probe?.enter("overlay.feedback");
  drawPlacementFeedbackOverlay(input.context, {
    feedback: input.placementFeedback ?? null,
    nowMs: input.nowMs ?? 0,
    zoom: input.camera.zoom,
  });
};

let lastPalisadeRoutePreview: {
  readonly path: PalisadeDraftState['path'];
  readonly tiles: GameState['tiles'];
  readonly key: string;
  readonly access: PalisadeRouteAccess;
} | null = null;

function cachedPalisadeRoutePreview(state: GameState, path: PalisadeDraftState['path']): PalisadeRouteAccess {
  const key = [state.era, state.roadRevision, state.nextConstructionOrdinal, state.treasuryTimber > 0,
    state.buildings.map(building => `${building.id}:${building.tx}:${building.ty}:${building.kind}:${availableStock(building, 'timber') > 0}`).join('|'),
    state.constructionSites.map(site => site.id).join('|')].join('/');
  if (lastPalisadeRoutePreview?.path === path && lastPalisadeRoutePreview.tiles === state.tiles
    && lastPalisadeRoutePreview.key === key) return lastPalisadeRoutePreview.access;
  const access = previewPalisadeDraftRouteAccess(state, path);
  lastPalisadeRoutePreview = { path, tiles: state.tiles, key, access };
  return access;
}

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
