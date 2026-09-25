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

type SelectRuntimeInput = {
  readonly world: WorldPoint;
  readonly canvas: HTMLCanvasElement;
  readonly refs: CanvasMutableRefs;
  readonly stateRef: { current: GameCanvasRuntimeInput["state"] };
  readonly selectedToolRef: { current: GameCanvasRuntimeInput["selectedTool"] };
  readonly palisadeDraftRef: { current: GameCanvasRuntimeInput["palisadeDraft"] };
  readonly setSelection: GameCanvasRuntimeInput["setSelection"];
  readonly dispatch: GameCanvasRuntimeInput["dispatch"];
};

/** The `select` intent on the map: select what is there, or place with the armed tool. */
export function handleCanvasSelect(input: SelectRuntimeInput): void {
  const { world, canvas, refs, stateRef, selectedToolRef, palisadeDraftRef, setSelection, dispatch } = input;
  if (palisadeDraftRef.current !== null) return;
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
}
