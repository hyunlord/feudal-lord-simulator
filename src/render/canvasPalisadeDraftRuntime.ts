import type { GameState } from "../engine/engine.types";
import { palisadeFootprintsForState } from "../ui/eraConsoleModel";
import type { TileCoordinate } from "../world/grid";
import type { Point } from "./camera";
import type { DragState } from "./canvasRuntime";
import {
  dragDraftRunByTiles,
  selectDraftRun,
  type PalisadeDraftState,
} from "./palisadeDraftInteraction";

export type PalisadeDraftDragStart = {
  readonly draft: PalisadeDraftState;
  readonly drag: DragState;
};

export function beginPalisadeDraftDrag(input: {
  readonly button: number;
  readonly hover: TileCoordinate | null;
  readonly draft: PalisadeDraftState | null;
  readonly point: Point;
}): PalisadeDraftDragStart | null {
  if (input.button !== 0 || input.draft === null || input.hover === null) return null;
  return {
    draft: selectDraftRun({
      draft: input.draft,
      point: { x: input.hover.tx, y: input.hover.ty },
    }),
    drag: { mode: "palisade", lastCanvasPoint: input.point, roadStart: null, moved: false },
  };
}

export function advancePalisadeDraftDrag(input: {
  readonly drag: DragState;
  readonly state: GameState;
  readonly draft: PalisadeDraftState | null;
  readonly hover: TileCoordinate | null;
}): PalisadeDraftState | null {
  if (
    input.drag.mode !== "palisade"
    || input.draft === null
    || input.draft.dragStartTile === null
    || input.hover === null
  ) {
    return null;
  }
  return dragDraftRunByTiles({
    grid: input.state,
    draft: input.draft,
    startTile: input.draft.dragStartTile,
    currentTile: input.hover,
    footprints: palisadeFootprintsForState(input.state),
  });
}
