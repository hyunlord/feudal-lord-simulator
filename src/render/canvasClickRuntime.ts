import { causeMarkerAtCanvasPoint } from "./causeMapInteraction";
import { resolveCanvasClick } from "./canvasClickResolution";
import type { Point } from "./camera";
import type { CanvasMutableRefs } from "./canvasRuntimeRefs";
import type { GameCanvasRuntimeInput } from "./gameCanvasRuntimeInput";

type ClickRuntimeInput = {
  readonly event: MouseEvent;
  readonly canvas: HTMLCanvasElement;
  readonly refs: CanvasMutableRefs;
  readonly stateRef: { current: GameCanvasRuntimeInput["state"] };
  readonly selectedToolRef: { current: GameCanvasRuntimeInput["selectedTool"] };
  readonly palisadeDraftRef: { current: GameCanvasRuntimeInput["palisadeDraft"] };
  readonly setSelection: GameCanvasRuntimeInput["setSelection"];
  readonly dispatch: GameCanvasRuntimeInput["dispatch"];
  readonly canvasPoint: (event: MouseEvent) => Point;
  readonly clearSuppressClickTimeout: () => void;
};

export function handleCanvasClick(input: ClickRuntimeInput): void {
  const { event, canvas, refs, stateRef, selectedToolRef, palisadeDraftRef,
    setSelection, dispatch, canvasPoint, clearSuppressClickTimeout } = input;
  if (palisadeDraftRef.current !== null) return;
  const bounds = canvas.getBoundingClientRect();
  const resolution = resolveCanvasClick({
    suppressClick: refs.suppressClick.current,
    spacePressed: refs.spacePressed.current,
    dragMode: refs.dragRef.current.mode === "palisade" || refs.dragRef.current.mode === "zone" ? "none" : refs.dragRef.current.mode,
    hover: refs.hoverRef.current,
    selectedTool: selectedToolRef.current,
    state: stateRef.current,
    point: canvasPoint(event),
    camera: refs.cameraRef.current,
    viewport: bounds,
    nowMs: performance.now(),
  });
  if (resolution.kind === "ignored") {
    if (!resolution.clearSuppression) return;
    refs.suppressClick.current = false;
    clearSuppressClickTimeout();
    return;
  }
  if (resolution.kind === "selection") {
    const buildingId = selectedToolRef.current === null ? causeMarkerAtCanvasPoint(stateRef.current, refs.cameraRef.current, canvasPoint(event))?.buildingIds[0] : undefined;
    if (buildingId !== undefined) {
      setSelection({ kind: "building", buildingId, position: canvasPoint(event) });
      return;
    }
    setSelection(resolution.selection);
    return;
  }
  refs.feedbackRef.current = resolution.attempt.feedback;
  if (resolution.attempt.action !== null) dispatch(resolution.attempt.action);
}
