import { causeMarkerAtCanvasPoint } from "./causeMapInteraction";
import { resolveCanvasClick } from "./canvasClickResolution";
import { worldToCanvas } from "./camera";
import type { CanvasMutableRefs } from "./canvasRuntimeRefs";
import type { GameCanvasRuntimeInput } from "./gameCanvasRuntimeInput";
import type { WorldPoint } from "../input/inputIntent";
import { getTile } from "../world/grid";
import { createPlacementFeedback } from "./placementFeedback";
import { townLandscapeAssetReady } from "./townLandscapeAssets";
import { townLandscapeAt, TOWN_LANDSCAPE_TOOLTIP } from "./townLandscape";
import { playPlacementSound } from "../audio/soundDirector";
import { resolveRoadPlacementAttempt } from "./interactions";
import { lastInputDevice } from "../input/inputDevice";

type SelectRuntimeInput = {
  readonly world: WorldPoint;
  readonly canvas: HTMLCanvasElement;
  readonly refs: CanvasMutableRefs;
  readonly stateRef: { current: GameCanvasRuntimeInput["state"] };
  readonly selectedToolRef: { current: GameCanvasRuntimeInput["selectedTool"] };
  readonly palisadeDraftRef: { current: GameCanvasRuntimeInput["palisadeDraft"] };
  readonly setSelection: GameCanvasRuntimeInput["setSelection"];
  readonly dispatch: GameCanvasRuntimeInput["dispatch"];
  readonly setPending?: (tile: { readonly tx: number; readonly ty: number } | null) => void;
};

/** The `select` intent on the map: select what is there, or place with the armed tool. */
export function handleCanvasSelect(input: SelectRuntimeInput): void {
  const { world, canvas, refs, stateRef, selectedToolRef, palisadeDraftRef, setSelection, dispatch } = input;
  if (palisadeDraftRef.current !== null) return;
  // UX-3R2 road click-click (UX3R 4절, S-23): a click on open ground lays that one tile as before and anchors a chain
  // there (a click on a road only anchors, to draw on from it); each next click lays the road from the anchor and
  // anchors there; a click on the anchor itself is the old single-click toggle (places or removes it) and ends the
  // chain; Enter, a double click, Esc or a right click end it. A drag still lays one line on its own.
  const hover = refs.hoverRef.current;
  let startChain = false;
  if (selectedToolRef.current === "road" && hover !== null) {
    const anchor = refs.roadChain.current;
    if (anchor === null && getTile(stateRef.current, hover)?.hasRoad === true) { refs.roadChain.current = hover; return; }
    if (anchor !== null && (anchor.tx !== hover.tx || anchor.ty !== hover.ty)) {
      const attempt = resolveRoadPlacementAttempt({ state: stateRef.current, start: anchor, destination: hover, nowMs: performance.now() });
      refs.feedbackRef.current = attempt.feedback;
      playPlacementSound(attempt);
      if (attempt.action !== null) { dispatch(attempt.action); refs.roadChain.current = hover; }
      return;
    }
    // The single-tile toggle below; a tile laid on open ground (no chain yet) starts the chain there.
    startChain = anchor === null;
    refs.roadChain.current = null;
  }
  // UX-3R2 tablet placement (UX3R 8절): a finger's tap or drag leaves the ghost where it ends (80 px above the finger);
  // lifting does not build — the confirm bar's ✓ does (the `confirm` intent).
  const tool = selectedToolRef.current;
  if (tool !== null && tool !== "road" && hover !== null && input.setPending !== undefined && lastInputDevice() === "touch") {
    input.setPending(hover);
    return;
  }
  const point = worldToCanvas(world, refs.cameraRef.current);
  const resolution = resolveCanvasClick({
    // The translator already swallowed clicks that ended a drag and clicks while Space is held.
    suppressClick: false,
    spacePressed: false,
    dragMode: "none",
    hover: refs.hoverRef.current,
    selectedTool: selectedToolRef.current,
    state: stateRef.current,
    point,
    camera: refs.cameraRef.current,
    viewport: canvas.getBoundingClientRect(),
    nowMs: performance.now(),
  });
  if (resolution.kind === "ignored") return;
  if (resolution.kind === "selection") {
    const buildingId = selectedToolRef.current === null ? causeMarkerAtCanvasPoint(stateRef.current, refs.cameraRef.current, point)?.buildingIds[0] : undefined;
    if (buildingId !== undefined) {
      setSelection({ kind: "building", buildingId, position: point });
      return;
    }
    setSelection(resolution.selection);
    // Nothing to select on town landscape: its line (once a hover tooltip) answers the tap instead.
    const tile = refs.hoverRef.current;
    const ground = resolution.selection === null && selectedToolRef.current === null && tile !== null ? getTile(stateRef.current, tile) : null;
    const landscape = ground === null ? null : townLandscapeAt(stateRef.current, ground);
    if (tile !== null && landscape !== null && townLandscapeAssetReady(landscape)) {
      refs.feedbackRef.current = createPlacementFeedback({ kind: "success", message: TOWN_LANDSCAPE_TOOLTIP, anchor: { kind: "tile", tile }, nowMs: performance.now() });
    }
    return;
  }
  refs.feedbackRef.current = resolution.attempt.feedback;
  playPlacementSound(resolution.attempt);
  if (resolution.attempt.action !== null) dispatch(resolution.attempt.action);
  if (startChain && resolution.attempt.action !== null) refs.roadChain.current = hover;
}
