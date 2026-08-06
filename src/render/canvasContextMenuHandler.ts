import type { Dispatch, SetStateAction } from "react";

import type { GameState } from "../engine/engine.types";
import type { GameAction } from "../state/gameStore.types";
import type { PlacementTool } from "./renderer";
import type { AnchoredWorldSelection } from "./worldSelection";
import { pointerTile } from "./interactions";
import type { CanvasMutableRefs } from "./canvasRuntimeRefs";
import { resolveCanvasContextMenu } from "./canvasContextMenuResolution";

type ContextMenuHandlerInput = Readonly<{
  canvas: HTMLCanvasElement;
  dispatch: Dispatch<GameAction>;
  refs: Pick<CanvasMutableRefs, "cameraRef">;
  selectedToolRef: { current: PlacementTool | null };
  setSelection: Dispatch<SetStateAction<AnchoredWorldSelection | null>>;
  stateRef: { current: GameState };
}>;

export function createCanvasContextMenuHandler(input: ContextMenuHandlerInput): (event: MouseEvent) => void {
  return (event) => {
    event.preventDefault();
    const resolution = resolveCanvasContextMenu({
      state: input.stateRef.current,
      tile: pointerTile(event, input.canvas.getBoundingClientRect(), input.refs.cameraRef.current),
      selectedTool: input.selectedToolRef.current,
    });
    if (resolution.action !== null) input.dispatch(resolution.action);
    input.setSelection(null);
  };
}
